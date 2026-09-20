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
import time
from collections.abc import Callable

from google import genai

from app.agents.gate import decide_gate
from app.agents.models import Verdict
from app.agents.pipeline import run_verification, run_verification_from_video
from app.agents.relevance import score_relevance
from app.core.config import get_gemini_api_key
from app.core.keep_awake import start_keep_awake
from app.core.monitoring import init_error_tracking, report_error
from app.core.video_optimize import speed_up_video
from app.db.supabase_client import VIDEO_BUCKET, get_supabase_client
from app.jobs.models import Job
from app.jobs.progress import END_OF_STREAM, publish_progress
from app.jobs.queue import listen


def _make_video_quick_to_play(storage_path: str, local_path: str, on_progress: Callable[[str], None]) -> str | None:
    """Swaps the uploaded video in storage for a small, quick-to-play copy (see
    core/video_optimize.py) and returns that copy's local path -- it's smaller, so
    it's also the better file to analyse. None means the video was left as it was.

    This must never fail a post: someone's video being slow to load is a shame, but
    their post not being checked at all is worse. So any problem is reported and the
    original carries on."""

    def store(new_path: str) -> None:
        get_supabase_client().storage.from_(VIDEO_BUCKET).upload(
            storage_path, new_path, {"content-type": "video/mp4", "upsert": "true"}
        )

    try:
        return speed_up_video(local_path, store, on_progress)
    except Exception as e:
        print(f"[worker] couldn't make the video quick to play, keeping the original: {e}", flush=True)
        report_error(e)
        return None


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
        del video_bytes  # a big upload shouldn't stay in memory while it is converted
        temp_files = [tmp_path]
        try:
            # Whatever the phone recorded (often huge, sometimes HEVC, index at the
            # end) is what every viewer would otherwise have to download. Fix it once, here.
            quick_path = _make_video_quick_to_play(job.content, tmp_path, on_progress)
            if quick_path:
                temp_files.append(quick_path)
            understanding, report = run_verification_from_video(client, quick_path or tmp_path, on_progress)
        finally:
            for path in temp_files:
                if os.path.exists(path):
                    os.unlink(path)
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
    init_error_tracking("worker")
    client = genai.Client(api_key=get_gemini_api_key())
    # flush=True on every print here: stdout is fully buffered (not
    # line-buffered) when it isn't attached to a real terminal, so without
    # this a long-running service's logs would only appear in bursts
    # instead of as things actually happen.
    print("[worker] Verification Service started, waiting for jobs...", flush=True)
    # This service never sleeps, so it keeps the free API from sleeping (see keep_awake.py).
    if start_keep_awake():
        print("[worker] keeping the API awake by visiting it every few minutes", flush=True)

    while True:
        try:
            job = listen()
        except Exception as e:
            # A cloud Redis connection over TLS can get reset by the
            # remote host or network in between calls -- this is a real,
            # observed failure mode (a BRPOP call died mid-loop with
            # WinError 10054), not a hypothetical one. Losing the queue
            # connection should never take down the whole service: log it,
            # back off briefly, and let the next attempt get a fresh
            # connection rather than crashing the process.
            print(f"[worker] lost connection to the queue, retrying: {e}", flush=True)
            time.sleep(2)
            continue

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
            report_error(e)  # handled here, but still worth knowing about
            _save_failure(job.job_id, str(e))
        finally:
            publish_progress(job.job_id, END_OF_STREAM)


if __name__ == "__main__":
    run_worker()
