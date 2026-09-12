"""
The shape of one unit of work handed from whatever produces jobs (today:
enqueue.py; from Milestone 4 on: the real API Service) to the Verification
Service.
"""

from typing import Literal

from pydantic import BaseModel


class Job(BaseModel):
    job_id: str
    kind: Literal["text", "video"]
    content: str  # the text to check, or a path to a video file
    declared_topic: str  # what the uploader tagged this as -- used by Milestone 4b's relevance gate
