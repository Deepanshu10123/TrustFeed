# Milestone 5 — Frontend (LLD)

**Status:** Done · **Depends on:** Milestone 4b, approved mockup · **Produces:** `frontend/`

## What this milestone proves

Frontend ↔ backend integration works end-to-end, including the async
wait for verification to finish — a real user can sign up, upload, watch
a post go from processing to published/rejected, and scroll a feed of
everyone else's published posts, all through a real browser.

## Design source

The approved visual design is the published mockup (Auth screen + a
tab-based app shell with Feed/Upload/My Posts) — built to match a
YouTube-Shorts-style immersive feed at the user's request: full-bleed
dark video/text slides, side action rail, credibility badge kept as the
one loud, unmissable element on screen.

## Backend additions (small, before the frontend needs them)

- **`GET /feed`** — new endpoint, published posts from *all* users
  (existing `GET /posts` is "my posts only"), latest 50, newest first.
- **CORS** — the frontend and API run on different origins (Vite dev
  server vs. FastAPI), so the API needs `CORSMiddleware` allowing the
  frontend's origin.

## Frontend structure

- **Vite + React + TypeScript** (`frontend/`)
- **Styling: plain CSS**, carrying over the exact CSS custom properties
  (colors, spacing) from the approved mockup — not Tailwind. The mockup
  already *is* a working design system; translating it into utility
  classes would be extra work for no benefit right now.
- **Auth: Supabase JS client, directly** (matching Milestone 4a's design)
  — the frontend signs up/logs in against Supabase itself, gets a token,
  sends that token to our API. No auth endpoints on our own API.
- **Data fetching: plain `fetch` + React hooks.** No React Query/Redux —
  consistent with "basic first," and this app's data needs are simple
  enough not to need them yet.
- **No router.** The app is one shell with tab state (Feed/Upload/My
  Posts), same as the mockup — there's nothing that needs its own URL yet.
- **Polling** (decided at Milestone 4b's planning): My Posts re-fetches
  every few seconds while any post is still `processing`, stops once
  none are.

## Files

| File | Job |
|---|---|
| `frontend/src/lib/supabase.ts` | Supabase client (anon key, browser-side) |
| `frontend/src/lib/api.ts` | Thin wrapper: attaches the current session's token, calls the FastAPI backend |
| `frontend/src/hooks/useAuth.ts` | Tracks the current Supabase session |
| `frontend/src/screens/AuthScreen.tsx` | Sign up / log in |
| `frontend/src/screens/FeedScreen.tsx` | Full-bleed swipeable feed, `GET /feed` |
| `frontend/src/screens/UploadScreen.tsx` | Text/video + required topic, `POST /posts` |
| `frontend/src/screens/MyPostsScreen.tsx` | `GET /posts` + polling while processing |
| `frontend/src/App.tsx` | Auth gate + tab shell |
| `frontend/src/styles/*.css` | The design system, carried over from the mockup |

## What actually happened, building this

- **Real video playback was added mid-build, not deferred as originally
  planned.** The LLD's first draft used a placeholder background for
  video posts (to keep scope on the verification pipeline, not video
  infra) -- live testing showed that undercuts the actual product too
  much to leave for later, so it was built now instead: the backend
  generates a temporary signed URL (Supabase Storage's `videos` bucket is
  private) for each video post it returns, and the frontend plays it in
  a real `<video>`, using an `IntersectionObserver` per slide so only the
  currently-visible post's video actually plays.
- **A real content-type bug:** uploaded videos were being served back as
  `Content-Type: text/plain` (Supabase Storage's default when none is
  given at upload time), which browsers refuse to play as video. Fixed
  by passing the browser-reported MIME type through to the Storage
  upload call. Test posts uploaded *before* this fix stayed broken (the
  content-type is set once, at upload) -- had to re-upload to verify the
  fix, not just re-check the old post.
- **Muted-by-default surprised the user, correctly.** Browsers block
  autoplay-with-sound outright, so the video starts muted -- but the
  mute/unmute button in the design (originally decorative, like the
  other rail buttons) needed to actually work for that to be usable, not
  just look right. Wired it to a single shared "muted" state across the
  whole feed (only one video plays at a time, so one shared toggle is
  simpler than per-post state, and matches how every real short-form
  feed's sound preference persists as you swipe). Confirmed working by
  the user in a real browser.

## Honest cons / open risks

- No router means no deep-linking (e.g. sharing a link straight to one
  post) — acceptable for a demo, a real gap if this ever needs to be
  genuinely shareable.
- Polling (not Supabase Realtime) means My Posts can lag a few seconds
  behind the true state — fine at this scale, a real trade-off at higher
  traffic.
- I can start the dev server and verify it builds/serves correctly, but
  actually *looking* at it running in a browser is a check only you can
  do — I'll ask you to open it and confirm once it's up.

## Definition of done

- [x] Sign up, log out, log back in all work against real Supabase Auth
- [x] Uploading text and uploading video both work end-to-end and show up correctly in My Posts
- [x] A processing post visibly flips to published/rejected without a manual page reload
- [x] The Feed screen shows real published posts from the database, matching the approved design
- [x] The whole thing runs and looks right in an actual browser (confirmed by the user, including real video playback with sound)
