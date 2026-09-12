"""
Wires the Planner and Critic together: some input (text, or now a video)
goes in, a full Report comes out. The Critic never needs to know which
kind of input a claim originally came from.

on_progress is an optional callback (Milestone 7b) for reporting live
status as each stage runs. It defaults to None everywhere, so cli.py,
enqueue.py, and every existing test call these functions completely
unchanged -- only worker.py passes a real one.
"""

from collections.abc import Callable

from google import genai

from app.agents.critic import investigate_claim
from app.agents.models import Report, VideoUnderstanding
from app.agents.planner import extract_claims
from app.agents.video_planner import understand_video

OnProgress = Callable[[str], None] | None


def _report_progress(on_progress: OnProgress, message: str) -> None:
    if on_progress:
        on_progress(message)


def _build_report(
    input_description: str, claims: list[str], client: genai.Client, on_progress: OnProgress = None
) -> Report:
    if not claims:
        _report_progress(on_progress, "No checkable factual claims found.")
        return Report(
            input_text=input_description,
            verdicts=[],
            summary="No checkable factual claims found.",
        )

    _report_progress(on_progress, f"Found {len(claims)} claim(s) to check.")
    verdicts = []
    for i, claim in enumerate(claims, start=1):
        preview = claim if len(claim) <= 70 else claim[:67] + "..."
        _report_progress(on_progress, f"Researching claim {i} of {len(claims)}: {preview}")
        verdicts.append(investigate_claim(client, claim))

    counts: dict[str, int] = {}
    for v in verdicts:
        counts[v.label] = counts.get(v.label, 0) + 1
    breakdown = ", ".join(f"{n} {label}" for label, n in counts.items())
    summary = f"{len(verdicts)} claim(s) checked: {breakdown}."

    return Report(input_text=input_description, verdicts=verdicts, summary=summary)


def run_verification(client: genai.Client, text: str, on_progress: OnProgress = None) -> Report:
    _report_progress(on_progress, "Extracting claims...")
    claims = extract_claims(client, text)
    return _build_report(text, claims, client, on_progress)


def run_verification_from_video(
    client: genai.Client, video_path: str, on_progress: OnProgress = None
) -> tuple[VideoUnderstanding, Report]:
    _report_progress(on_progress, "Watching the video and extracting claims...")
    understanding = understand_video(client, video_path)
    description = f"[video: {video_path}] Topic: {understanding.topic}. Transcript: {understanding.transcript}"
    report = _build_report(description, understanding.claims, client, on_progress)
    return understanding, report


def print_report(report: Report) -> None:
    print(f"\nInput: {report.input_text}\n")

    if not report.verdicts:
        print(report.summary)
        return

    for i, v in enumerate(report.verdicts, start=1):
        print(f"Claim {i}: {v.claim}")
        print(f"  Verdict: {v.label}")
        print(f"  Why: {v.explanation}")
        if v.sources:
            print("  Sources:")
            for s in v.sources:
                print(f"    - {s.title or '(untitled)'}: {s.url}")
        print()

    print(f"Summary: {report.summary}")
