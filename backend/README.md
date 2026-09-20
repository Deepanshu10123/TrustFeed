# backend

The API and agent pipeline (Python). First real code lands in Milestone 1
(`app/agents/`), wrapped in a proper API in Milestone 2 (`app/api/`).

See [../docs/HLD.md](../docs/HLD.md) for the overall design.

## Keeping it fast

Two things in the Verification Service (`python -m app.worker`) exist purely so the
app feels quick:

- **It keeps the free API awake** (`app/core/keep_awake.py`). Render puts free web
  services to sleep after 15 idle minutes, and waking one takes about a minute. The
  worker never sleeps, so on Render it visits the API's `/health` every 4 minutes.
  It's off on a laptop; `KEEP_AWAKE_URL` overrides the address, and `off` disables it.
- **It makes every uploaded video quick to play** (`app/core/video_optimize.py`):
  720p H.264 with the index at the front, usually 5-10x smaller. It shows up in the
  worker log as `[optimize] 19.0 MB h264 1920x1080 -> 2.0 MB h264 1280x720 in 2s`. If
  anything goes wrong the original video is kept and the post is still checked.

Videos uploaded *before* that existed are still stored as recorded. To catch them up,
from this folder on your own computer:

    python -m app.optimize_videos            # look only: lists each video, changes nothing
    python -m app.optimize_videos --apply    # convert the slow ones
