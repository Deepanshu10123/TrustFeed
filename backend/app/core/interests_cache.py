"""
Keeps each person's chosen topics in memory for a few minutes, so most feed
requests don't have to ask the database for them first -- every question the API
asks the database is a round trip across the Pacific (0.1-0.3 seconds).

Correct because there is one API process and every change goes through
set_interests, which updates this straight away; the short lifetime covers
anything that changes them some other way (say, by hand in Supabase). If the API
is ever run as several copies, each keeps its own, so a change could take up to
TTL_SECONDS to show up on the others.
"""

import time

TTL_SECONDS = 300
_MAX_PEOPLE = 5000  # a safety cap on memory, not something a normal day reaches

_entries: dict[str, tuple[float, list[str]]] = {}


def cached_topics(user_id: str) -> list[str] | None:
    """The remembered topics, or None if there's nothing fresh remembered."""
    entry = _entries.get(user_id)
    if entry is None:
        return None
    stored_at, topics = entry
    if time.monotonic() - stored_at >= TTL_SECONDS:
        del _entries[user_id]
        return None
    return list(topics)


def remember_topics(user_id: str, topics: list[str]) -> None:
    if len(_entries) >= _MAX_PEOPLE:
        _entries.clear()
    _entries[user_id] = (time.monotonic(), list(topics))


def forget_all_topics() -> None:
    _entries.clear()
