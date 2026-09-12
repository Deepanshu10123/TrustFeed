"""
The actual publish/reject decision -- the core product idea. A pure
function on purpose: no API calls, no I/O, so it's fast and free to test
directly with hand-built data (see tests/test_gate.py), separate from the
slow, real-API tests for the LLM-backed pieces elsewhere in this project.

Milestone 8b: not every decision is fully automatic. A relevance score
that's genuinely borderline gets flagged for a human to look at
(`needs_review`) instead of being forced into a confident publish or
reject. The credibility rule is unchanged -- any Unsupported claim still
hard-rejects regardless of relevance; a demonstrably false claim doesn't
deserve "maybe."
"""

from app.agents.models import Verdict

RELEVANCE_REJECT_BELOW = 40  # confidently off-topic
RELEVANCE_PUBLISH_AT_OR_ABOVE = 60  # confidently on-topic
# Between the two: genuinely uncertain, not yet tuned on real usage data.


def decide_gate(relevance_score: int, verdicts: list[Verdict]) -> tuple[str, str | None]:
    """Returns (status, reason). status is 'published', 'rejected', or 'needs_review'."""
    reasons = []
    hard_reject = False
    borderline = False

    unsupported = [v for v in verdicts if v.label == "Unsupported"]
    if unsupported:
        hard_reject = True
        claim_list = "; ".join(v.claim for v in unsupported)
        reasons.append(f"{len(unsupported)} claim(s) found unsupported by evidence: {claim_list}")

    if relevance_score < RELEVANCE_REJECT_BELOW:
        hard_reject = True
        reasons.append(
            f"Relevance score {relevance_score} is well below what's required for the declared topic."
        )
    elif relevance_score < RELEVANCE_PUBLISH_AT_OR_ABOVE:
        borderline = True
        reasons.append(
            f"Relevance score {relevance_score} is borderline for the declared topic -- "
            f"needs a human look before publishing."
        )

    if hard_reject:
        return "rejected", " ".join(reasons)
    if borderline:
        return "needs_review", " ".join(reasons)
    return "published", None
