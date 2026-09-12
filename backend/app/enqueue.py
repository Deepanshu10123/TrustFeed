"""
A quick way to test the worker/queue mechanics in isolation, without
needing the full API + auth + storage stack running.

Video jobs are no longer created here (Milestone 4a): a real video upload
has to go through the API Service first, since the worker now expects
video jobs to carry a Supabase Storage path, not a local file path -- so
"just point at a local file" stopped being a meaningful shortcut once a
real API exists to do this properly.

Usage:
    python -m app.enqueue "Vitamin D prevents COVID infection." --topic health
"""

import argparse
import uuid

from app.jobs.models import Job
from app.jobs.queue import enqueue


def main() -> None:
    parser = argparse.ArgumentParser(description="Queue a text verification job (run app.worker to process it).")
    parser.add_argument("text", help="The text to check.")
    parser.add_argument("--topic", default="general", help="Declared topic, for the Milestone 4b relevance gate.")
    args = parser.parse_args()

    job = Job(job_id=str(uuid.uuid4()), kind="text", content=args.text, declared_topic=args.topic)
    enqueue(job)

    print(f"Queued job {job.job_id}. A running `python -m app.worker` will pick it up.")


if __name__ == "__main__":
    main()
