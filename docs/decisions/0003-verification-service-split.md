# ADR 0003 — Verification Pipeline as a Separate Service

**Status:** Accepted · **Date:** 2026-09-12

## Context

ADR 0001 chose a modular monolith over microservices, reasoning that a
solo project has no real scaling/team problem to justify the operational
cost of multiple services. That reasoning still holds in general — but the
user also wants genuine, hands-on microservices experience for interviews,
and an arbitrary split (e.g. separate "user service" / "post service" with
no real technical reason) would be exactly the kind of unjustified
complexity ADR 0001 warned against.

The verification pipeline (Gemini video understanding → Planner → Web
Search → Critic) is different from the rest of the app in a concrete way:
it calls slow external services (a multimodal AI call, live web search)
that can take several seconds, and it has a different failure mode and
scaling need than simple CRUD work like "list posts in a feed."

## Decision

Split the system into two services instead of one:

1. **API Service** (the modular monolith from ADR 0001) — handles users,
   uploads, the feed, and everything else that's fast, request/response
   shaped work.
2. **Verification Service** — a separate, independently deployable service
   that does the video understanding + claim verification work.

They communicate through a **job queue**, not a direct function call: when
a video is uploaded, the API Service stores the file and puts a
"verify this" job on the queue, then immediately responds to the user
(e.g. "processing"). The Verification Service picks up jobs from the
queue whenever it's free, does the slow work, and writes the result
(relevance score, credibility score, verdict) back to the database.

The exact queue technology (e.g. a Postgres-backed queue vs. a dedicated
service like Redis) is a Milestone-level implementation detail, not an
architecture decision — it will be chosen and documented in the LLD for
whichever milestone builds this.

## Why this split, specifically

- **It has a real, defensible reason**, not just "microservices for the
  resume": slow external AI/search calls shouldn't block the request a
  user is waiting on, and isolating them means the Verification Service
  can be scaled, retried, or even temporarily down without taking the
  rest of the app with it. This is the same reason real systems put
  slow/expensive work behind a queue and a worker.
- It teaches the actual valuable parts of microservices — a real network
  boundary, service-to-service communication via a queue, independent
  deployment — without needing to invent artificial boundaries elsewhere
  in the app that wouldn't hold up to a "why did this need to be
  separate?" question.

## Alternatives considered

- **Full microservices** (separate services for users, posts, feed,
  verification too). Rejected — most of those splits have no real
  technical justification at this project's scale, meaningfully raises
  the risk of not finishing solo, and each unjustified split is a weaker
  interview answer than one well-justified one.
- **Stay fully monolithic**, calling the verification logic as a plain
  function inside the same request. Simpler, but doesn't meet the user's
  explicit goal of learning microservices, and would mean upload requests
  sit waiting for slow external calls to finish.

## Consequences

- The project now has two things to deploy instead of one (still fine on
  Render — as two separate services).
- A queue technology needs choosing when this is actually built — flagged
  as an open question, to be settled in that milestone's LLD, not now.
- The API needs a way to tell the frontend "still processing" vs. "done" —
  polling or a realtime update (Supabase supports this) — a detail for
  that milestone's LLD as well.
- This becomes the first genuine service boundary in the project; ADR
  0001's "modular monolith" now describes the *API Service* specifically,
  not the whole system.
