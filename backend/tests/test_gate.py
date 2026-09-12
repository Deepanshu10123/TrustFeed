"""
decide_gate() is a pure function -- these tests use hand-built Verdict
objects, no LLM calls, no network. Fast and free, unlike the golden-set
and queue tests elsewhere in this project.
"""

from app.agents.gate import decide_gate
from app.agents.models import Verdict

WELL_SUPPORTED = Verdict(claim="a", label="Well Supported", explanation="", sources=[])
MIXED = Verdict(claim="b", label="Mixed Evidence", explanation="", sources=[])
UNABLE = Verdict(claim="c", label="Unable to Verify", explanation="", sources=[])
UNSUPPORTED = Verdict(claim="d", label="Unsupported", explanation="", sources=[])


def test_both_gates_pass():
    status, reason = decide_gate(relevance_score=90, verdicts=[WELL_SUPPORTED, MIXED])
    assert status == "published"
    assert reason is None


def test_low_relevance_fails():
    status, reason = decide_gate(relevance_score=20, verdicts=[WELL_SUPPORTED])
    assert status == "rejected"
    assert "Relevance" in reason


def test_unsupported_claim_fails_even_if_relevant():
    status, reason = decide_gate(relevance_score=95, verdicts=[WELL_SUPPORTED, UNSUPPORTED])
    assert status == "rejected"
    assert "unsupported" in reason.lower()


def test_mixed_and_unable_to_verify_do_not_fail_credibility():
    status, reason = decide_gate(relevance_score=80, verdicts=[MIXED, UNABLE])
    assert status == "published"
    assert reason is None


def test_zero_claims_auto_passes_credibility():
    status, reason = decide_gate(relevance_score=70, verdicts=[])
    assert status == "published"
    assert reason is None


def test_both_gates_fail_reports_both_reasons():
    status, reason = decide_gate(relevance_score=10, verdicts=[UNSUPPORTED])
    assert status == "rejected"
    assert "Relevance" in reason
    assert "unsupported" in reason.lower()


# Milestone 8b: the human-in-the-loop borderline band (40-59 inclusive)


def test_borderline_relevance_needs_review():
    status, reason = decide_gate(relevance_score=50, verdicts=[WELL_SUPPORTED])
    assert status == "needs_review"
    assert "borderline" in reason.lower()


def test_borderline_lower_boundary_needs_review():
    status, reason = decide_gate(relevance_score=40, verdicts=[])
    assert status == "needs_review"


def test_borderline_upper_boundary_needs_review():
    status, reason = decide_gate(relevance_score=59, verdicts=[])
    assert status == "needs_review"


def test_just_below_reject_threshold_is_rejected_not_review():
    status, reason = decide_gate(relevance_score=39, verdicts=[])
    assert status == "rejected"


def test_just_at_publish_threshold_is_published_not_review():
    status, reason = decide_gate(relevance_score=60, verdicts=[])
    assert status == "published"
    assert reason is None


def test_unsupported_claim_hard_rejects_even_in_borderline_relevance_band():
    status, reason = decide_gate(relevance_score=50, verdicts=[UNSUPPORTED])
    assert status == "rejected"
    assert "unsupported" in reason.lower()
