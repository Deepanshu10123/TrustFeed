# TrustFeed

An intentional, credibility-scored video feed: users upload their own short
videos, and before a video reaches the shared feed, a small team of AI
agents checks whether it's actually about the topic it claims (relevance)
and whether its factual claims hold up against outside sources
(credibility) — instead of an algorithm optimizing purely for how long it
can keep you scrolling.

Full design: [docs/HLD.md](docs/HLD.md). Why each choice was made:
[docs/decisions/](docs/decisions/).

**Currently on Milestone 8** (Milestones 1–7 done — the full vision works:
sign up, pick interests, upload text or video, watch a multi-agent
pipeline verify it live step-by-step (MCP-served search tool, streamed
progress over Redis pub/sub + SSE), and see it published or rejected with
a reason, in a feed filtered to what you chose — see
[docs/milestones/](docs/milestones/)). Full roadmap and status:
[docs/HLD.md](docs/HLD.md#milestone-roadmap).

## Layout

- `backend/` — the API Service, Verification Service, and agent pipeline
  (Python). Run the real stack: `uvicorn app.api.main:app --reload` (API)
  and `python -m app.worker` (Verification Service) in two terminals.
  Needs a `.env` — see `.env.example`. Or try the pipeline directly
  without any of that: `python -m app.cli "some claim to check"` or
  `python -m app.cli --video path/to/clip.mp4`.
- `frontend/` — the React + TypeScript web UI. `npm install && npm run
  dev`, needs a `.env` — see `.env.example`. Requires the backend running
  too (see above).
- `design/` — the approved visual design source (Claude Design mockup).
- `docs/` — design docs, the decision log, and per-milestone write-ups
