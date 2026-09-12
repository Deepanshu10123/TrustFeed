"""
The data shapes passed between the Planner, the Critic, and the CLI.

Using Pydantic models (instead of plain dicts) means every piece of data
has a fixed, checkable shape -- this is what "structured output" (Phase 0)
looks like in practice, and it's what makes the golden-set tests possible:
we can assert on `verdict.label`, not parse free-form text.
"""

from pydantic import BaseModel, Field, field_validator

ALLOWED_LABELS = {"Well Supported", "Mixed Evidence", "Unsupported", "Unable to Verify"}


class ClaimList(BaseModel):
    """What the Planner extracts from a piece of text."""

    claims: list[str] = Field(default_factory=list)


class VideoUnderstanding(BaseModel):
    """
    What the video Planner extracts from a video file in one multimodal
    call. `topic` is captured as raw information only -- Milestone 2 does
    not judge or score it against anything (see the Milestone 2 doc for
    why: there's no user-declared tag to compare it to yet).
    """

    transcript: str = ""
    topic: str = ""
    claims: list[str] = Field(default_factory=list)


class Source(BaseModel):
    """One piece of evidence found by the search tool."""

    title: str = ""
    url: str = ""
    snippet: str = ""


class VerdictDraft(BaseModel):
    """
    What the Critic's final structured call returns directly. Only the
    label, explanation, and *which* source URLs mattered -- not the full
    Source objects, since we already have those from the search step and
    don't need the model to retype them (retyping is where details like a
    snippet get silently dropped or invented).
    """

    label: str
    explanation: str
    source_urls: list[str] = Field(default_factory=list)

    @field_validator("label")
    @classmethod
    def _fallback_to_unable_to_verify(cls, value: str) -> str:
        return value if value in ALLOWED_LABELS else "Unable to Verify"


class Verdict(BaseModel):
    """One claim's final, complete verdict -- what the CLI prints."""

    claim: str
    label: str
    explanation: str
    sources: list[Source] = Field(default_factory=list)


class Report(BaseModel):
    """The full result for one piece of input text."""

    input_text: str
    verdicts: list[Verdict]
    summary: str
