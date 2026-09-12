# ADR 0001 — Initial MVP Architecture

**Status:** Accepted · **Date:** 2026-09-12

## Context

TrustFeed needs an architecture that a single learner can actually build
end-to-end, while still reading as a real, deliberately-engineered system
rather than a toy. Four shape-level decisions had to be made before any code
could be written.

## Decisions

### 1. Modular monolith, not microservices
One backend codebase, split into clear internal modules (`agents/`, `api/`,
`db/`, `core/`) instead of separate deployed services.
- **Why:** microservices add real operational overhead (multiple
  deployments, network calls between services, more failure modes) that pays
  off at team scale, not solo-project scale. A clean modular monolith is easy
  to split later if it's ever actually needed.
- **Alternative considered:** microservices per agent role. Rejected — pure
  overhead here, and a good interviewer reads unnecessary microservices as
  over-engineering, not sophistication.

### 2. React (via Vite) for the frontend
- **Why:** filling a real frontend skill gap was an explicit goal, and React
  is the most resume-recognized frontend choice. Vite gives fast local setup
  with minimal config.
- **Alternative considered:** plain HTML/CSS/JS. Faster to start, but
  doesn't scale to a real feed UI with live streaming agent steps (Milestone
  6), and has less resume signal.

### 3. SQLite now, Postgres from Milestone 5
- **Why:** no real concurrent users exist until Milestone 5 (accounts), so a
  zero-setup single-file database is the right tool through Milestones 1–4.
  Postgres gets introduced exactly when it's needed, not before.
- **Alternative considered:** Postgres from day one. Rejected for now —
  would mean standing up a database server before there's anything real to
  store in it.
- **Superseded by [ADR 0002](0002-user-generated-content.md):** the MVP was
  redesigned around user-uploaded video, which needs real file storage and
  real accounts much earlier than Milestone 5. This decision no longer
  applies as originally written — see ADR 0002.

### 4. Render (backend) + Vercel (frontend)
- **Why:** Render already proven to work from the phase4-service deployment
  in the learning roadmap; Vercel is close to zero-config for a Vite/React
  app.
- **Alternative considered:** both on Render. Simpler in one sense (one host
  to think about), but Vercel is specifically built for frontend hosting and
  is free-tier friendly.

## Consequences

- Two hosted services means the frontend and backend live on different
  addresses, so the backend needs CORS configured to accept requests from
  the frontend's domain (a small, well-understood config, not a design
  problem).
- Moving from SQLite to Postgres at Milestone 5 is a planned migration, not
  a surprise — the LLD for Milestone 5 will cover it explicitly.
