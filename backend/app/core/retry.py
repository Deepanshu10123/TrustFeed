"""
A small retry-with-backoff helper for the external AI/search APIs this
project depends on (Gemini, Tavily) -- both have rate limits that are real
and already observed in practice (Milestone 7a hit a genuine 429
RESOURCE_EXHAUSTED from Gemini's free tier during testing), not a
hypothetical risk. A transient rate-limit or network hiccup shouldn't
permanently fail an entire verification job when trying again a few
seconds later would likely have worked.
"""

import time
from collections.abc import Callable
from typing import TypeVar

T = TypeVar("T")

MAX_ATTEMPTS = 4
BASE_DELAY_S = 2.0


def with_retries(fn: Callable[[], T], *, label: str) -> T:
    """Calls fn(), retrying up to MAX_ATTEMPTS times with exponential
    backoff (2s, 4s, 8s) on any failure. Re-raises the last error if every
    attempt fails -- this is for surviving a transient hiccup, not for
    silently masking a persistently broken call."""
    for attempt in range(1, MAX_ATTEMPTS + 1):
        try:
            return fn()
        except Exception as e:
            if attempt == MAX_ATTEMPTS:
                raise
            delay = BASE_DELAY_S * (2 ** (attempt - 1))
            print(f"[retry] {label} failed (attempt {attempt}/{MAX_ATTEMPTS}): {e} -- retrying in {delay:.0f}s", flush=True)
            time.sleep(delay)
