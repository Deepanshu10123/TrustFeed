"""
Spotting posts whose verification job got lost.

A post that's still "processing" long after it was queued almost always
means its job never finished -- the worker crashed or was restarted
mid-check, and nothing retries a lost job, so nothing will ever update the
post again. Kept as a plain function (no database, no clock of its own) so
it can be tested directly.
"""

from datetime import datetime, timedelta, timezone


def find_stuck(posts: list[dict], minutes: int, now: datetime | None = None) -> list[dict]:
    """The posts still processing more than `minutes` after they were queued.
    A post with no queued_at at all (the column doesn't exist yet) is never
    counted as stuck."""
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(minutes=minutes)
    return [
        post
        for post in posts
        if post.get("status") == "processing"
        and post.get("queued_at")
        and datetime.fromisoformat(post["queued_at"]) < cutoff
    ]
