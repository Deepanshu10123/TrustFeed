"""
The API Service (ADR 0003). Accepts uploads, stores them, and hands the
slow verification work off to the queue -- it never waits for that work
to finish. See docs/milestones/milestone-4a-api-service.md for the design.

Run it:
    uvicorn app.api.main:app --reload
"""

import uuid

from fastapi import Depends, FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.api.auth import get_current_user, get_current_user_from_query
from app.core.config import get_allowed_origins
from app.core.topics import TOPICS
from app.db.supabase_client import VIDEO_BUCKET, get_supabase_client
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
        data = await video.read()
        storage_path = f"{user.id}/{post_id}/{video.filename}"
        # Without an explicit content-type, Supabase Storage serves the
        # file as text/plain, which browsers refuse to play as video.
        content_type = video.content_type or "video/mp4"
        supabase.storage.from_(VIDEO_BUCKET).upload(storage_path, data, {"content-type": content_type})
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
