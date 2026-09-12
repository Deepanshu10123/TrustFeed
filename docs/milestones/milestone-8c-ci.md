# Milestone 8c — CI (LLD)

**Status:** In progress · **Depends on:** all prior milestones · **Produces:** `.github/workflows/ci.yml`

## What this milestone proves

Automated tests run on every push, without anyone remembering to run them
by hand — "ready to show, not just run on a laptop." Explicitly **CI, not
CD**: this runs tests automatically; it does not deploy anything. Real
deployment (Render + Vercel, per ADR 0001) is a clean, separate step for
whenever the app is meant to actually go live — a deliberate choice, not
a shortcut.

## A hard dependency worth naming plainly

GitHub Actions runs against a GitHub repo. Nothing in this project has
been committed to git yet. This milestone can't exist without finally
committing and pushing — which is fine, but it's a real, one-time
decision point, not a formality.

## What actually runs in CI, and what deliberately doesn't

**Runs on every push:**
- Backend: `tests/test_gate.py` — pure-function tests, verified to need
  zero environment variables or secrets.
- Frontend: `npm run build` (type-check + production build) — verified to
  succeed with no `.env` file present at all.

**Deliberately excluded, not forgotten:**
- `tests/test_golden_set.py` and `tests/test_guardrails.py` — real Gemini
  + Tavily API calls. Slow, costs real money on every push, and would
  need `GEMINI_API_KEY`/`TAVILY_API_KEY` as repository secrets. Stay
  manual/local, exactly as they've been run throughout this project.
- `tests/test_job_queue.py` — needs a live Upstash Redis connection. Even
  though it's fast and free, it introduces a **real external-service
  dependency into CI**: if Upstash has a hiccup, CI fails for a reason
  that has nothing to do with the code just pushed. That's a different,
  worse kind of flakiness than "this test is slow," and it's why this one
  test is excluded even though it easily could have been included with a
  `REDIS_URL` repository secret.

## Files

| File | Job |
|---|---|
| `.github/workflows/ci.yml` | **New.** Two independent jobs: backend tests, frontend build |

## Honest cons / open risks

- No coverage of the LLM-backed pipeline (Planner/Critic/relevance/gate
  end-to-end) runs automatically — that's a real gap for a project whose
  core value is that pipeline, traded deliberately for a CI run that's
  fast, free, and never flaky from external services. A scheduled
  (not-on-every-push) job running the golden set would be a reasonable
  future addition, not built here.
- CI proves the code still passes its own tests and still builds — it
  says nothing about whether the app actually *works* end-to-end in a
  browser, which has been this whole project's own established pattern
  for what still needs a human check.

## Definition of done

- [ ] The repo is committed and pushed to a real GitHub remote
- [ ] The workflow runs automatically on push and both jobs pass
- [ ] Neither job requires any repository secret to succeed
