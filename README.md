# TrustFeed

An intentional, credibility-scored video feed: users upload their own short
videos, and before a video reaches the shared feed, a small team of AI
agents checks whether it's actually about the topic it claims (relevance)
and whether its factual claims hold up against outside sources
(credibility) — instead of an algorithm optimizing purely for how long it
can keep you scrolling.

Full design: [docs/HLD.md](docs/HLD.md). Why each choice was made:
[docs/decisions/](docs/decisions/).

**All planned milestones are complete.** Sign up, pick interests, upload
text or video, watch a multi-agent pipeline (with an MCP-served search
tool) verify it live step-by-step over Server-Sent Events, and see it
published, rejected, or flagged for human review — in a feed filtered to
what you actually chose, with a real CI pipeline running on every push.
See [docs/milestones/](docs/milestones/) for how each piece was built,
and [docs/HLD.md](docs/HLD.md#milestone-roadmap) for the full roadmap.

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

## License

Copyright (c) 2026 Deepanshu10123. Released under the
[PolyForm Noncommercial License 1.0.0](LICENSE): you're welcome to read the
code, learn from it, and use it for personal, educational, or other
noncommercial purposes. You may **not** use it to build a commercial product
or service without written permission — open an issue on this repository to
ask. The third-party libraries and fonts used here keep their own licenses.
