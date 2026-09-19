"""
Fast, no-network tests for the daily posting limits (see app/core/limits.py)
-- pure logic, so they run in CI alongside test_gate.py.
"""

from app.core.limits import daily_limit_error


def test_under_both_limits_is_fine():
    assert daily_limit_error(["video", "text"], "video", video_limit=5, post_limit=20) is None


def test_a_fresh_day_is_fine():
    assert daily_limit_error([], "video", video_limit=5, post_limit=20) is None


def test_video_limit_stops_another_video():
    error = daily_limit_error(["video"] * 5, "video", video_limit=5, post_limit=20)
    assert error is not None and "5 video uploads" in error


def test_video_limit_does_not_stop_a_text_post():
    assert daily_limit_error(["video"] * 5, "text", video_limit=5, post_limit=20) is None


def test_text_posts_do_not_use_up_the_video_allowance():
    assert daily_limit_error(["text"] * 10, "video", video_limit=5, post_limit=20) is None


def test_overall_limit_stops_any_kind_of_post():
    recent = ["text"] * 20
    for kind in ("text", "video"):
        error = daily_limit_error(recent, kind, video_limit=5, post_limit=20)
        assert error is not None and "20 posts" in error


def test_wording_is_singular_for_a_limit_of_one():
    assert "1 video upload " in daily_limit_error(["video"], "video", video_limit=1, post_limit=20)
    assert "1 post " in daily_limit_error(["text"], "text", video_limit=5, post_limit=1)
