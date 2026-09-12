"""
The Verification Service (ADR 0003): a real, independently-runnable
process that waits for jobs and processes them one at a time.

Two stages per job:
  1. The unchanged Milestone 1/2 pipeline (Planner -> Critic) decides
     whether the claims in the content hold up.
  2. Milestone 4b's gate: score relevance against the declared topic,
     then combine with the credibility verdicts into a publish/reject
     decision.

Milestone 7b: publishes a live progress message at each stage, so the
frontend can show what's actually happening instead of a static spinner
(see app/jobs/progress.py). Always publishes the end-of-stream sentinel
when done, success or failure, so a connected SSE stream always closes.

Usage:
    python -m app.worker
"""

import os
import tempfile
from collections.abc import Callable

from google import genai

from app.agents.gate import decide_gate
from app.agents.models import Verdict
from app.agents.pipeline import run_verification, run_verification_from_video
from app.agents.relevance import score_relevance
from app.core.config import get_gemini_api_key
from app.db.supabase_client import VIDEO_BUCKET, get_supabase_client
from app.jobs.models import Job
from app.jobs.progress import END_OF_STREAM, publish_progress
from app.jobs.queue import listen


def _process(
    client: genai.Client, job: Job, on_progress: Callable[[str], None]
) -> tuple[dict, list[Verdict], str]:
    """Returns (result_for_storage, verdicts, content_for_relevance_check)."""
    if job.kind == "video":
        # Video jobs carry a Supabase Storage path, not a local file path --
        # the API Service and this worker are separate processes (and will
        # be separate deployments), so they can't share a local temp file.
        # Download it here, then hand the unchanged Milestone 2 function a
        # real local path, same as it's always expected.
        on_progress("Downloading video...")
        video_bytes = get_supabase_client().storage.from_(VIDEO_BUCKET).download(job.content)
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(video_bytes)
            tmp_path = tmp.name
        try:
            understanding, report = run_verification_from_video(client, tmp_path, on_progress)
        finally:
            os.unlink(tmp_path)
        result = {"understanding": understanding.model_dump(), "report": report.model_dump()}
        return result, report.verdicts, understanding.transcript
    else:
        report = run_verification(client, job.content, on_progress)
        result = {"report": report.model_dump()}
        return result, report.verdicts, job.content


def _save_result(post_id: str, result: dict, status: str, relevance_score: int, rejection_reason: str | None) -> None:
    get_supabase_client().table("posts").update({
        "status": status,
        "report": result,
        "relevance_score": relevance_score,
        "rejection_reason": rejection_reason,
    }).eq("id", post_id).execute()


def _save_failure(post_id: str, error: str) -> None:
    get_supabase_client().table("posts").update({
        "status": "failed",
        "report": {"error": error},
    }).eq("id", post_id).execute()


def run_worker() -> None:
    client = genai.Client(api_key=get_gemini_api_key())
    # flush=True on every print here: stdout is fully buffered (not
    # line-buffered) when it isn't attached to a real terminal, so without
    # this a long-running service's logs would only appear in bursts
    # instead of as things actually happen.
    print("[worker] Verification Service started, waiting for jobs...", flush=True)

    while True:
        job = listen()
        if job is None:
            continue  # nothing arrived within the poll timeout -- just keep waiting

        print(f"[worker] picked up job {job.job_id} ({job.kind})", flush=True)
        on_progress = lambda msg: publish_progress(job.job_id, msg)  # noqa: E731
        try:
            result, verdicts, content_for_relevance = _process(client, job, on_progress)
            on_progress(f"Scoring relevance to '{job.declared_topic}'...")
            relevance = score_relevance(client, job.declared_topic, content_for_relevance)
            on_progress("Making final decision...")
            status, rejection_reason = decide_gate(relevance.score, verdicts)
            _save_result(job.job_id, result, status, relevance.score, rejection_reason)
            print(f"[worker] finished job {job.job_id} -> {status}", flush=True)
        except Exception as e:
            print(f"[worker] job {job.job_id} failed: {e}", flush=True)
            _save_failure(job.job_id, str(e))
        finally:
            publish_progress(job.job_id, END_OF_STREAM)


if __name__ == "__main__":
    run_worker()
