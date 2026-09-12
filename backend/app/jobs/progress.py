"""
Live progress updates for one post's verification, via Redis pub/sub --
reuses the same Upstash Redis already integrated for the job queue
(Milestone 3), no new infrastructure.

publish_progress() is called synchronously from the worker (a plain,
blocking process). subscribe_progress() is an async generator used by the
API's SSE endpoint, since forwarding messages to a browser connection
needs to not block FastAPI's event loop while waiting for the next one.
"""

from collections.abc import AsyncGenerator

import redis
import redis.asyncio as aredis

from app.core.config import get_redis_url

END_OF_STREAM = "__DONE__"  # tells subscribers to stop listening and close

_sync_client: redis.Redis | None = None


def _get_sync_client() -> redis.Redis:
    global _sync_client
    if _sync_client is None:
        _sync_client = redis.from_url(get_redis_url(), decode_responses=True)
    return _sync_client


def _channel(post_id: str) -> str:
    return f"progress:{post_id}"


def publish_progress(post_id: str, message: str) -> None:
    _get_sync_client().publish(_channel(post_id), message)


async def subscribe_progress(post_id: str) -> AsyncGenerator[str]:
    """Yields progress messages for one post as they're published, and
    stops (without yielding it) once it sees the end-of-stream sentinel."""
    client = aredis.from_url(get_redis_url(), decode_responses=True)
    pubsub = client.pubsub()
    await pubsub.subscribe(_channel(post_id))
    try:
        async for item in pubsub.listen():
            if item["type"] != "message":
                continue
            if item["data"] == END_OF_STREAM:
                break
            yield item["data"]
    finally:
        await pubsub.unsubscribe(_channel(post_id))
        await client.aclose()
