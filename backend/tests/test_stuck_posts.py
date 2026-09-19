"""
Fast, no-network tests for spotting posts whose job got lost (see
app/core/stuck.py) -- pure logic, so they run in CI alongside test_gate.py.
"""

from datetime import datetime, timedelta, timezone

from app.core.stuck import find_stuck

NOW = datetime(2026, 9, 19, 12, 0, tzinfo=timezone.utc)


def post(post_id: str, status: str, minutes_ago: float) -> dict:
    return {"id": post_id, "status": status, "queued_at": (NOW - timedelta(minutes=minutes_ago)).isoformat()}


def ids(posts: list[dict]) -> list[str]:
    return [p["id"] for p in posts]


def test_processing_post_past_the_limit_is_stuck():
    assert ids(find_stuck([post("a", "processing", 11)], 10, NOW)) == ["a"]


def test_recently_queued_post_is_not_stuck():
    assert find_stuck([post("a", "processing", 2)], 10, NOW) == []


def test_exactly_at_the_limit_is_not_stuck_yet():
    assert find_stuck([post("a", "processing", 10)], 10, NOW) == []


def test_only_processing_posts_can_be_stuck():
    posts = [post("done", "published", 60), post("bad", "failed", 60), post("held", "hidden", 60)]
    assert find_stuck(posts, 10, NOW) == []


def test_picks_out_just_the_stuck_ones():
    posts = [post("old", "processing", 30), post("new", "processing", 1), post("done", "published", 30)]
    assert ids(find_stuck(posts, 10, NOW)) == ["old"]


def test_post_with_no_queued_at_is_never_stuck():
    assert find_stuck([{"id": "a", "status": "processing"}], 10, NOW) == []
    assert find_stuck([{"id": "a", "status": "processing", "queued_at": None}], 10, NOW) == []


def test_reads_the_timestamp_format_the_database_returns():
    stuck = {"id": "a", "status": "processing", "queued_at": "2026-09-19T11:20:05.123+00:00"}
    assert ids(find_stuck([stuck], 10, NOW)) == ["a"]
