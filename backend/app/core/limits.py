"""
Daily posting limits -- a guardrail on the free-tier services this app runs
on (every video costs a burst of Gemini calls, and Gemini's free tier only
allows so many a minute and a day). Kept as a plain function, with no
database and no clock, so it can be tested directly.
"""


def daily_limit_error(recent_kinds: list[str], new_kind: str, video_limit: int, post_limit: int) -> str | None:
    """Why one more post of `new_kind` would go over the limits, in words a
    person can act on -- or None if it's fine. `recent_kinds` is the kind
    ("text" or "video") of each post this person made in the last 24 hours."""
    if new_kind == "video" and recent_kinds.count("video") >= video_limit:
        noun = "video upload" if video_limit == 1 else "video uploads"
        return f"You've used all {video_limit} {noun} for the last 24 hours. Try again later."
    if len(recent_kinds) >= post_limit:
        noun = "post" if post_limit == 1 else "posts"
        return f"You've reached the limit of {post_limit} {noun} in 24 hours. Try again later."
    return None
