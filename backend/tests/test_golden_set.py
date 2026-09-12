"""
Runs the real pipeline (real Gemini + Tavily calls -- not mocked, on
purpose, since the point is to catch the actual system being wrong, not
just a mock agreeing with itself) against the golden set.

This costs a small amount and takes real time -- run deliberately:
    pytest -v backend/tests/test_golden_set.py
"""

import pytest
from google import genai

from app.agents.pipeline import run_verification
from app.core.config import get_gemini_api_key
from tests.golden_claims import GOLDEN_CLAIMS


@pytest.fixture(scope="module")
def client() -> genai.Client:
    return genai.Client(api_key=get_gemini_api_key())


@pytest.mark.parametrize("text,expected_labels", GOLDEN_CLAIMS)
def test_golden_claim(client, text, expected_labels):
    report = run_verification(client, text)

    if expected_labels is None:
        assert report.verdicts == [], f"expected no checkable claims, got: {report.verdicts}"
        return

    assert len(report.verdicts) >= 1, "expected at least one checkable claim to be extracted"
    assert report.verdicts[0].label in expected_labels, (
        f"claim {text!r} got label {report.verdicts[0].label!r}, expected one of {expected_labels}"
    )
