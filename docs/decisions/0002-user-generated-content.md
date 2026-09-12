# ADR 0002 — User-Generated Video + Upload Gate

**Status:** Accepted · **Date:** 2026-09-12

## Context

The MVP was originally scoped around a small, hand-picked set of seed
content, with real user uploads and video understanding pushed out as
stretch goals (see [ADR 0001](0001-mvp-architecture.md)). The product idea
was redesigned to make this core instead: users upload their own short
videos, each one is checked automatically before it's allowed into the
feed, and everyone scrolls a shared feed of what other users have posted —
closer to Instagram/TikTok, but with a verification gate in front of
publishing.

This pulls two things forward that were previously deferred: real video
understanding, and real file storage + accounts (previously Milestone 5).
Two new decisions were needed.

## Decisions

### 1. Two separate scores at the gate, not one blended percentage
Every upload gets a **relevance score** (does it actually match the topic
it's tagged with?) and a **credibility score** (are its factual claims
supported?) — computed separately, both must clear a threshold before the
post is allowed into the feed.
- **Why:** a single blended number hides *why* something failed. A video
  can be perfectly on-topic but false, or accurate but mistagged — those
  need different feedback to the uploader (re-tag vs. revise claims), not
  the same rejection message.
- **Alternative considered:** one combined "validity" percentage, as
  originally proposed. Rejected — it's cheaper to compute but is a worse
  product decision and hides the interesting engineering (two agents doing
  two distinct jobs).

### 2. Gemini native video understanding, not a separate transcription step
The uploaded video file is sent directly to Gemini's multimodal API, which
returns a transcript, a topic/relevance read, and the claims worth
checking — in one call, instead of running a dedicated speech-to-text
service first and feeding the result into a text pipeline.
- **Why:** fewer moving parts and no extra paid service, while still being
  genuine multimodal AI experience. The existing stack (already on Gemini
  since Phase 0 of the learning roadmap) absorbs this directly.
- **Alternative considered:** Whisper (or another dedicated STT) as a
  separate pipeline stage. More traditional/decoupled, and closer to how a
  larger team might build it, but it's an extra service and extra cost for
  a benefit (provider independence) that doesn't matter at this scale.
  Worth revisiting later if Gemini's video limits (length/size) become a
  real constraint.

### 3. Supabase for storage, database, and auth together
Uploaded video files, the Postgres database, and user accounts/auth all
live in Supabase, replacing the standalone "SQLite now, Postgres later"
plan from ADR 0001.
- **Why:** uploads need real file storage *and* real accounts (so a post
  has an owner) right away — there's no version of this feature that works
  without both. Supabase bundles all three so only one new service gets
  learned and wired up, instead of a storage provider now and a separate
  database/auth provider later.
- **Alternative considered:** Cloudflare R2 or S3 for storage only, keeping
  the database plan as originally sequenced. Keeps concerns separate in
  principle, but means standing up two systems back-to-back for the same
  underlying need (uploads require both storage and identity at once).

## Consequences

- Milestone 5 ("Accounts + saved history") is no longer a separate later
  step — real accounts now exist from the point uploads are introduced.
  The milestone roadmap in the HLD has been renumbered accordingly.
- The verification pipeline built in Milestone 1 (text claims only) needs
  to be extended to accept video input before uploads can use it — this is
  its own milestone, not a rewrite, since the underlying Planner → Search →
  Critic logic doesn't change, only what feeds it.
- Hosting the moderation/legal reality of other people's uploaded video
  content (spam, abuse, illegal content) is a real product concern beyond
  fact-checking. Out of scope for the solo MVP build itself, but worth a
  stated line in any interview/pitch of this project: a real launch would
  need a moderation policy and reporting flow on top of what's built here.
