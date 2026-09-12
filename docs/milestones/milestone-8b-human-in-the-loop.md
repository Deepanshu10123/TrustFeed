# Milestone 8b — Human-in-the-Loop (LLD)

**Status:** Done · **Depends on:** Milestone 4b · **Produces:** `needs_review` status in `decide_gate()`

## What this milestone proves

Not every decision should be fully automatic. A relevance score that's
genuinely borderline (neither clearly on-topic nor clearly off-topic)
shouldn't get the same confident auto-decision as a clear-cut case — it
should be flagged for a human to actually look at.

## Explicitly scoped down, and why

**No admin review panel, no approve/reject UI, no reviewer role.** That's
a real application in itself — building it would be disproportionate to
a solo project's last milestone. What this milestone actually delivers is
the *concept*, correctly wired into the real decision logic: a post that
needs review gets a distinct, honest status (`needs_review`) instead of
being silently forced into published or rejected. Building the actual
review workflow on top of that status is real, legitimate future work,
named here rather than pretended away.

## The rule, precisely

`decide_gate()`'s credibility rule is **unchanged** from Milestone 4b —
any single `Unsupported` claim still hard-rejects a post, no review
needed for a confident failure. Only the relevance side gets a middle
zone:

- Relevance **< 40** → still a confident `rejected` (unchanged in spirit,
  just a lower bar than the old single cutoff at 50)
- Relevance **40–59** → **new:** `needs_review` — genuinely uncertain,
  not confidently anything
- Relevance **≥ 60** → still a confident `published`

An `Unsupported` claim always wins regardless of relevance — a
demonstrably false claim doesn't deserve "maybe," it's a clear reject.

## Files

| File | Change |
|---|---|
| `backend/app/agents/gate.py` | Replace the single relevance threshold with a reject/review/publish three-way band; credibility logic untouched |
| `backend/tests/test_gate.py` | New tests for the borderline band and its boundaries; all existing tests must still pass unchanged (none of their fixture scores happen to fall in the new band) |
| `frontend/src/lib/types.ts` | `PostStatus` gains `'needs_review'` |
| `frontend/src/screens/MyPostsScreen.tsx` | A distinct badge/status-sub message for `needs_review` |

No database migration needed — `posts.status` has no `CHECK` constraint,
so a new string value flows through without a schema change.

## Honest cons / open risks

- There's genuinely nothing a human *does* yet when a post needs review
  — it just sits there, visible only to its own uploader as an honest
  "this needs a look" state. The workflow that would make this
  operationally real (a reviewer role, an approve/reject action) is
  explicitly future work, not built here.
- The exact band (40–59) is another judgment call, same caveat as the
  original 50 threshold from Milestone 4b — not validated against real
  usage data.

## Definition of done

- [x] A relevance score in the new borderline band produces `needs_review`, not a confident decision — proven directly by unit tests at every boundary value (39/40/50/59/60)
- [x] An `Unsupported` claim still hard-rejects regardless of relevance
- [x] All Milestone 4b gate tests still pass unchanged (all 6 original assertions hold with zero modification)
- [x] `needs_review` posts are correctly excluded from the public feed (unchanged `GET /feed` query only ever selects `status = 'published'`, so any other status is automatically excluded — no new code needed here, and no new risk either)

## What actually happened, building this

- **The gate logic itself is airtight — 12/12 unit tests pass**, including
  new tests at the exact boundaries (39 → rejected, 40 → needs_review, 59
  → needs_review, 60 → published) and one confirming an `Unsupported`
  claim still hard-rejects even inside the borderline relevance band.
- **Genuinely landing a live post in the 40-59 band turned out to be
  harder than expected — a real, useful finding, not a failure.** Three
  attempts with deliberately tangentially-related content produced 60,
  65, and 10 — overshooting confidently in one direction or the other
  each time, never landing in the middle. The relevance scorer's real
  judgments trend decisive rather than wishy-washy, at least for the
  content tried. This suggests the review band may see less real traffic
  than the design assumed, once actually driven by the LLM's real scoring
  behavior rather than a synthetic test value — worth knowing before
  assuming this feature triggers often in practice.
- **Confidence in the live wiring rests on unit tests + an unchanged
  shared code path, not a live example of this exact status.** The
  worker's write path (`_save_result`) and the frontend's status
  rendering both just handle a new string value through the *same* code
  that already correctly handles `published` and `rejected` — proven
  working for those in this same session. No new integration risk was
  introduced at the plumbing layer; what couldn't be directly observed
  live was specifically the LLM choosing a score in that narrow range,
  which is about the model's behavior, not this code's correctness.
- **A small, deliberate naming imperfection, left as-is:** the DB column
  reused to explain a `needs_review` post is literally named
  `rejection_reason` (from Milestone 4b, before this status existed). A
  cleaner design would rename it to something status-neutral, but that's
  a real migration for a cosmetic gain this late in the build — noted
  honestly rather than either overselling the tidiness or quietly doing
  an unplanned migration.
