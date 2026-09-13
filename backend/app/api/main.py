"""
The API Service (ADR 0003). Accepts uploads, stores them, and hands the
slow verification work off to the queue -- it never waits for that work
to finish. See docs/milestones/milestone-4a-api-service.md for the design.

Run it:
    uvicorn app.api.main:app --reload
"""

import os
import tempfile
import uuid

from fastapi import Depends, FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from storage3.exceptions import StorageApiError

from app.api.auth import get_current_user, get_current_user_from_query
from app.core.config import get_allowed_origins
from app.core.topics import TOPICS
from app.db.supabase_client import AVATAR_BUCKET, VIDEO_BUCKET, get_supabase_client
from app.jobs.models import Job
from app.jobs.progress import subscribe_progress
from app.jobs.queue import enqueue

app = FastAPI(title="TrustFeed API Service")

VIDEO_URL_EXPIRY_S = 3600  # how long a signed video URL stays valid


def _attach_video_urls(posts: list[dict]) -> list[dict]:
    """The videos bucket is private, so a raw storage path isn't a
    playable URL -- generate a temporary signed one for each video post
    being returned. Only ever called on posts a caller is already
    authorized to see (this adds no new access, it just makes existing
    access playable)."""
    supabase = get_supabase_client()
    for post in posts:
        if post["kind"] == "video":
            signed = supabase.storage.from_(VIDEO_BUCKET).create_signed_url(post["content"], VIDEO_URL_EXPIRY_S)
            post["video_url"] = signed.get("signedUrl") or signed.get("signedURL")
    return posts

# The frontend (Vite dev server locally, a deployed Vercel origin in
# production) runs on a different origin than this API, so the browser
# needs explicit permission to call it -- see get_allowed_origins().
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/posts")
async def create_post(
    kind: str = Form(..., description="'text' or 'video'"),
    declared_topic: str = Form(..., description="The topic this post is being tagged as"),
    text: str | None = Form(None),
    video: UploadFile | None = None,
    user=Depends(get_current_user),
):
    if kind not in ("text", "video"):
        raise HTTPException(status_code=400, detail="kind must be 'text' or 'video'")
    if declared_topic not in TOPICS:
        raise HTTPException(status_code=400, detail=f"declared_topic must be one of {TOPICS}")

    post_id = str(uuid.uuid4())
    supabase = get_supabase_client()

    if kind == "video":
        if video is None:
            raise HTTPException(status_code=400, detail="video file required when kind='video'")
        # Only the extension survives from the original filename -- a
        # real upload's name can carry spaces, unicode, or emoji (seen in
        # practice: a downloaded clip named with one), and some of that is
        # risky as a raw Storage object path. The post id is already a
        # unique, safe name on its own.
        ext = os.path.splitext(video.filename or "")[1] or ".mp4"
        storage_path = f"{user.id}/{post_id}{ext}"
        # Without an explicit content-type, Supabase Storage serves the
        # file as text/plain, which browsers refuse to play as video.
        content_type = video.content_type or "video/mp4"
        # Stream to a temp file on disk in chunks instead of `await
        # video.read()`-ing the whole thing into one Python bytes object --
        # this API runs on a small, fixed memory budget (Render's free
        # tier), and loading a full video into RAM on top of this app's
        # already-heavy import footprint (Gemini/Supabase/Redis clients)
        # was enough to OOM-crash the whole process on a real upload, not
        # just fail that one request. Passing a file path lets the
        # underlying storage client stream it instead.
        fd, tmp_path = tempfile.mkstemp()
        try:
            with os.fdopen(fd, "wb") as tmp:
                while chunk := await video.read(1024 * 1024):
                    tmp.write(chunk)
            try:
                supabase.storage.from_(VIDEO_BUCKET).upload(storage_path, tmp_path, {"content-type": content_type})
            except StorageApiError as e:
                if e.status == 413:
                    raise HTTPException(
                        status_code=413, detail="That video is too large to upload. Try a shorter clip."
                    ) from e
                print(f"[upload] video storage error: status={e.status} code={e.code} message={e.message}", flush=True)
                raise HTTPException(status_code=502, detail="Video upload failed, please try again.") from e
        finally:
            os.unlink(tmp_path)
        content = storage_path
    else:
        if not text:
            raise HTTPException(status_code=400, detail="text required when kind='text'")
        content = text

    supabase.table("posts").insert({
        "id": post_id,
        "user_id": user.id,
        "kind": kind,
        "content": content,
        "declared_topic": declared_topic,
        "status": "processing",
    }).execute()

    # The post's own id doubles as the job id -- the worker always knows
    # exactly which row to update, no separate mapping needed.
    enqueue(Job(job_id=post_id, kind=kind, content=content, declared_topic=declared_topic))

    return {"post_id": post_id, "status": "processing"}


@app.get("/posts/{post_id}")
async def get_post(post_id: str, user=Depends(get_current_user)):
    result = (
        get_supabase_client()
        .table("posts")
        .select("*")
        .eq("id", post_id)
        .eq("user_id", user.id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Post not found")
    return _attach_video_urls(result.data)[0]


@app.get("/posts/{post_id}/stream")
async def stream_post_progress(post_id: str, user=Depends(get_current_user_from_query)):
    """Server-Sent Events: live progress while a post is being verified
    (Milestone 7b). Token comes from a query param, not the Authorization
    header -- browsers' native EventSource can't send custom headers."""
    result = (
        get_supabase_client()
        .table("posts")
        .select("status")
        .eq("id", post_id)
        .eq("user_id", user.id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Post not found")

    async def event_stream():
        # Already finished by the time anyone connected -- pub/sub has no
        # history, so waiting on the channel here would hang forever.
        if result.data[0]["status"] != "processing":
            yield f"data: Already {result.data[0]['status']}.\n\n"
            return
        async for message in subscribe_progress(post_id):
            yield f"data: {message}\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.delete("/posts/{post_id}")
async def delete_post(post_id: str, user=Depends(get_current_user)):
    supabase = get_supabase_client()
    result = (
        supabase.table("posts")
        .select("*")
        .eq("id", post_id)
        .eq("user_id", user.id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Post not found")
    post = result.data[0]

    if post["kind"] == "video":
        try:
            supabase.storage.from_(VIDEO_BUCKET).remove([post["content"]])
        except Exception:
            pass  # the post disappearing is what matters; an orphaned file isn't worth failing the delete over

    supabase.table("posts").delete().eq("id", post_id).eq("user_id", user.id).execute()
    return {"deleted": post_id}


@app.get("/posts")
async def list_my_posts(user=Depends(get_current_user)):
    result = (
        get_supabase_client()
        .table("posts")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", desc=True)
        .execute()
    )
    return _attach_video_urls(result.data)


class InterestsBody(BaseModel):
    topics: list[str]


class CommentBody(BaseModel):
    text: str


@app.get("/interests")
async def get_interests(user=Depends(get_current_user)):
    result = get_supabase_client().table("user_preferences").select("topics").eq("user_id", user.id).execute()
    return {"topics": result.data[0]["topics"] if result.data else []}


@app.put("/interests")
async def set_interests(body: InterestsBody, user=Depends(get_current_user)):
    invalid = [t for t in body.topics if t not in TOPICS]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unknown topic(s): {invalid}")
    get_supabase_client().table("user_preferences").upsert({
        "user_id": user.id,
        "topics": body.topics,
    }).execute()
    return {"topics": body.topics}


@app.get("/profile")
async def get_profile(user=Depends(get_current_user)):
    result = get_supabase_client().table("user_preferences").select("avatar_url").eq("user_id", user.id).execute()
    return {"avatar_url": result.data[0]["avatar_url"] if result.data else None}


@app.post("/profile/avatar")
async def upload_avatar(avatar: UploadFile, user=Depends(get_current_user)):
    supabase = get_supabase_client()
    content_type = avatar.content_type or "image/jpeg"
    ext = os.path.splitext(avatar.filename or "")[1] or ".jpg"
    # One fixed path per user (not one-per-upload like videos) with
    # upsert=true -- a new avatar replaces the old file in place instead
    # of piling up orphaned ones.
    storage_path = f"{user.id}/avatar{ext}"

    fd, tmp_path = tempfile.mkstemp()
    try:
        with os.fdopen(fd, "wb") as tmp:
            while chunk := await avatar.read(1024 * 1024):
                tmp.write(chunk)
        try:
            supabase.storage.from_(AVATAR_BUCKET).upload(
                storage_path, tmp_path, {"content-type": content_type, "upsert": "true"}
            )
        except StorageApiError as e:
            raise HTTPException(status_code=502, detail="Avatar upload failed, please try again.") from e
    finally:
        os.unlink(tmp_path)

    avatar_url = supabase.storage.from_(AVATAR_BUCKET).get_public_url(storage_path)
    supabase.table("user_preferences").upsert({"user_id": user.id, "avatar_url": avatar_url}).execute()
    return {"avatar_url": avatar_url}


@app.get("/feed")
async def get_feed(user=Depends(get_current_user)):
    """Published posts from every user -- the shared feed, not just your own.
    Filtered to the caller's chosen interests once they've set any; an
    empty/unset preference list means "show everything", not "show
    nothing", so a brand-new user isn't met with an empty feed."""
    supabase = get_supabase_client()

    prefs = supabase.table("user_preferences").select("topics").eq("user_id", user.id).execute()
    topics = prefs.data[0]["topics"] if prefs.data else []

    query = supabase.table("posts").select("*").eq("status", "published")
    if topics:
        query = query.in_("declared_topic", topics)
    result = query.order("created_at", desc=True).limit(50).execute()

    return _attach_video_urls(result.data)


@app.get("/posts/{post_id}/comments")
async def list_comments(post_id: str, user=Depends(get_current_user)):
    result = (
        get_supabase_client()
        .table("comments")
        .select("*")
        .eq("post_id", post_id)
        .order("created_at")
        .execute()
    )
    return result.data


@app.post("/posts/{post_id}/comments")
async def add_comment(post_id: str, body: CommentBody, user=Depends(get_current_user)):
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comment text is required")
    if len(text) > 500:
        raise HTTPException(status_code=400, detail="Comments are limited to 500 characters")

    comment = {
        "id": str(uuid.uuid4()),
        "post_id": post_id,
        "user_id": user.id,
        "text": text,
    }
    get_supabase_client().table("comments").insert(comment).execute()
    return comment


@app.delete("/comments/{comment_id}")
async def delete_comment(comment_id: str, user=Depends(get_current_user)):
    """A comment can be removed by whoever wrote it, or by the owner of
    the post it's on -- same as most real comment sections."""
    supabase = get_supabase_client()
    result = supabase.table("comments").select("*, posts!inner(user_id)").eq("id", comment_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Comment not found")
    comment = result.data[0]
    if comment["user_id"] != user.id and comment["posts"]["user_id"] != user.id:
        raise HTTPException(status_code=404, detail="Comment not found")

    supabase.table("comments").delete().eq("id", comment_id).execute()
    return {"deleted": comment_id}
