"""
A thin wrapper around a Redis list, used as a queue:
  - enqueue() pushes a job onto one end
  - listen() blocks, waiting to pop one from the other end

Using a real hosted queue (Upstash Redis) rather than anything local means
this works identically whether the producer and the worker are two
processes on one laptop (today) or two separately deployed services
later (Milestone 4+) -- see ADR 0003 and the Milestone 3 doc for why that
matters.
"""

import redis

from app.core.config import get_redis_url
from app.jobs.models import Job

QUEUE_KEY = "trustfeed:verification-jobs"
POLL_TIMEOUT_S = 5  # how long one blocking pop waits before giving worker.py a chance to loop

_client: redis.Redis | None = None


def _get_client() -> redis.Redis:
    global _client
    if _client is None:
        # socket_timeout must be longer than POLL_TIMEOUT_S -- otherwise the
        # connection's own read timeout fires before BRPOP's server-side
        # timeout gets a chance to reply cleanly with "no job", and raises a
        # low-level TimeoutError instead of just returning None.
        _client = redis.from_url(get_redis_url(), decode_responses=True, socket_timeout=POLL_TIMEOUT_S + 10)
    return _client


def enqueue(job: Job) -> None:
    _get_client().lpush(QUEUE_KEY, job.model_dump_json())


def listen() -> Job | None:
    """Block up to POLL_TIMEOUT_S waiting for a job. Returns None on timeout
    (so the caller's loop can check for e.g. a shutdown signal and try again)."""
    try:
        result = _get_client().brpop([QUEUE_KEY], timeout=POLL_TIMEOUT_S)
    except redis.exceptions.TimeoutError:
        return None
    if result is None:
        return None
    _key, raw_job = result
    return Job.model_validate_json(raw_job)
