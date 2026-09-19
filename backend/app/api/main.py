"""
The API Service (ADR 0003). Accepts uploads, stores them, and hands the
slow verification work off to the queue -- it never waits for that work
to finish. See docs/milestones/milestone-4a-api-service.md for the design.

Run it:
    uvicorn app.api.main:app --reload
"""

import asyncio
import os
import tempfile
import uuid

from fastapi import Depends, FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from storage3.exceptions import StorageApiError

from app.api.auth import get_current_user, get_current_user_from_query
from app.core.config import get_allowed_origins, get_report_hide_threshold
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
    access playable).

    Batched into one call instead of one request per video -- the
    original per-post loop meant a feed page of, say, 10 videos cost 10
    separate network round-trips to Supabase on top of the posts query
    itself, a real N+1 pattern and a genuine source of slow load times."""
    video_paths = [post["content"] for post in posts if post["kind"] == "video"]
    if not video_paths:
        return posts
    signed = get_supabase_client().storage.from_(VIDEO_BUCKET).create_signed_urls(video_paths, VIDEO_URL_EXPIRY_S)
    url_by_path = {item["path"]: item.get("signedUrl") or item.get("signedURL") for item in signed}
    for post in posts:
        if post["kind"] == "video":
            post["video_url"] = url_by_path.get(post["content"])
    return posts


def _like_info(post_ids: list[str], user_id: str) -> dict[str, dict]:
    """like_count and liked_by_me for a batch of posts in one database
    call (the like_info() function in schema.sql), keyed by post id."""
    if not post_ids:
        return {}
    rows = get_supabase_client().rpc("like_info", {"post_ids": post_ids, "me": user_id}).execute().data
    return {row["post_id"]: row for row in rows}


def _like_state(post_id: str, user_id: str) -> dict:
    info = _like_info([post_id], user_id).get(post_id, {})
    return {"liked": info.get("liked_by_me", False), "like_count": info.get("like_count", 0)}


def _reported_by(post_ids: list[str], user_id: str) -> set[str]:
    """Which of these posts this user has already reported."""
    rows = (
        get_supabase_client()
        .table("reports")
        .select("post_id")
        .eq("user_id", user_id)
        .in_("post_id", post_ids)
        .execute()
        .data
    )
    return {row["post_id"] for row in rows}


async def _optional(label: str, default, fn, *args):
    """Runs a blocking lookup in a thread. If it fails, logs it and returns
    `default` instead -- for add-ons to the feed (likes, your own reports)
    that shouldn't be able to take the whole feed down, e.g. before the SQL
    they need has been run."""
    try:
        return await asyncio.to_thread(fn, *args)
    except Exception as e:
        print(f"[{label}] lookup failed, carrying on without it: {e}", flush=True)
        return default


def _avatar_urls(user_ids: list[str]) -> dict[str, str | None]:
    """Uploader avatars for a batch of users in one query -- users who
    never set one simply aren't in the result."""
    rows = (
        get_supabase_client()
        .table("user_preferences")
        .select("user_id,avatar_url")
        .in_("user_id", user_ids)
        .execute()
        .data
    )
    return {row["user_id"]: row["avatar_url"] for row in rows}

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
    # Tagging isn't limited to the fixed list -- a post can be tagged with
    # any short custom topic, shown on the post exactly like any other tag.
    # It's deliberately *not* added to the fixed list interests are picked
    # from (see Milestone 6): a custom-tagged post is discoverable by
    # anyone with no interests set (which shows everything), just not
    # through anyone's interest filter specifically.
    declared_topic = declared_topic.strip()
    if not declared_topic:
        raise HTTPException(status_code=400, detail="declared_topic is required")
    if len(declared_topic) > 40:
        raise HTTPException(status_code=400, detail="declared_topic must be 40 characters or fewer")

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
    posts = result.data
    if not posts:
        return posts

    # The lookups below only need the posts just fetched, not each other --
    # run them at once instead of one after another, since each is a full
    # round trip to a database on the other side of the world.
    post_ids = [p["id"] for p in posts]
    user_ids = list({p["user_id"] for p in posts})

    like_info, avatars, reported, _ = await asyncio.gather(
        _optional("likes", {}, _like_info, post_ids, user.id),
        asyncio.to_thread(_avatar_urls, user_ids),
        _optional("reports", set(), _reported_by, post_ids, user.id),
        asyncio.to_thread(_attach_video_urls, posts),
    )
    # A post you've reported stays out of your feed, not just until you refresh.
    posts = [p for p in posts if p["id"] not in reported]
    for post in posts:
        info = like_info.get(post["id"], {})
        post["like_count"] = info.get("like_count", 0)
        post["liked_by_me"] = info.get("liked_by_me", False)
        post["uploader_avatar_url"] = avatars.get(post["user_id"])
    return posts


REPORT_REASONS = {"misleading", "hateful", "dangerous", "spam", "other"}


class ReportBody(BaseModel):
    reason: str
    note: str | None = None


@app.post("/posts/{post_id}/report")
async def report_post(post_id: str, body: ReportBody, user=Depends(get_current_user)):
    if body.reason not in REPORT_REASONS:
        raise HTTPException(status_code=400, detail=f"reason must be one of {sorted(REPORT_REASONS)}")
    note = (body.note or "").strip()
    if len(note) > 300:
        raise HTTPException(status_code=400, detail="note must be 300 characters or fewer")

    supabase = get_supabase_client()
    # (post_id, user_id) is the table's primary key: one report per person
    # per post, so nobody can hide a post on their own by reporting it over
    # and over -- it takes several different people.
    supabase.table("reports").upsert(
        {"post_id": post_id, "user_id": user.id, "reason": body.reason, "note": note or None},
        on_conflict="post_id,user_id",
        ignore_duplicates=True,
    ).execute()

    total = supabase.table("reports").select("user_id", count="exact", head=True).eq("post_id", post_id).execute().count
    if total is not None and total >= get_report_hide_threshold():
        # Only a live post gets hidden -- never one that's still being
        # checked or was already decided some other way.
        supabase.table("posts").update({"status": "hidden"}).eq("id", post_id).eq("status", "published").execute()
    return {"reported": True}


@app.put("/posts/{post_id}/like")
async def like_post(post_id: str, user=Depends(get_current_user)):
    # (post_id, user_id) is the table's primary key, so liking something
    # you've already liked is a harmless no-op rather than a second like.
    get_supabase_client().table("likes").upsert(
        {"post_id": post_id, "user_id": user.id}, on_conflict="post_id,user_id", ignore_duplicates=True
    ).execute()
    return _like_state(post_id, user.id)


@app.delete("/posts/{post_id}/like")
async def unlike_post(post_id: str, user=Depends(get_current_user)):
    get_supabase_client().table("likes").delete().eq("post_id", post_id).eq("user_id", user.id).execute()
    return _like_state(post_id, user.id)


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
