"""
A fast round-trip test for the queue itself -- no LLM calls, so unlike
test_golden_set.py this is cheap enough to run often. Just checks that a
Job pushed by enqueue() comes back out of listen() intact.
"""

import uuid

from app.jobs.models import Job
from app.jobs.queue import enqueue, listen


def test_enqueue_then_listen_roundtrip():
    job = Job(job_id=str(uuid.uuid4()), kind="text", content="round-trip test claim", declared_topic="testing")

    enqueue(job)
    received = listen()

    assert received is not None, "expected a job back, got None (timed out)"
    assert received == job
