"""
Entry point for Milestones 1 and 2.

Usage:
    python -m app.cli "Vitamin D prevents COVID infection."
    python -m app.cli "The Great Wall of China is visible from space." --json
    python -m app.cli --video path/to/clip.mp4
"""

import argparse
import sys

from google import genai

from app.agents.pipeline import print_report, run_verification, run_verification_from_video
from app.core.config import get_gemini_api_key


def main() -> None:
    parser = argparse.ArgumentParser(description="Check the factual claims in a piece of text or a video.")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("text", nargs="?", help="The text to check.")
    source.add_argument("--video", help="Path to a local video file to check instead of text.")
    parser.add_argument("--json", action="store_true", help="Print the raw JSON report instead of plain text.")
    args = parser.parse_args()

    if args.text is None and args.video is None:
        sys.exit("Provide either text to check or --video <path>.")

    client = genai.Client(api_key=get_gemini_api_key())

    if args.video:
        understanding, report = run_verification_from_video(client, args.video)
        if not args.json:
            print(f"Topic: {understanding.topic}")
            print(f"Transcript: {understanding.transcript}")
    else:
        report = run_verification(client, args.text)

    if args.json:
        print(report.model_dump_json(indent=2))
    else:
        print_report(report)


if __name__ == "__main__":
    main()
