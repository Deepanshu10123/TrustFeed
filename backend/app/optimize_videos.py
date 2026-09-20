"""
Makes the videos people ALREADY uploaded quick to play. New uploads are handled by
the worker automatically (see app/core/video_optimize.py); this is the one-off
catch-up for the ones that came before, which are still stored exactly as the phone
recorded them.

    python -m app.optimize_videos                 # LOOK ONLY: lists every video and whether it would change
    python -m app.optimize_videos --apply         # do it: replace each slow video with a fast copy
    python -m app.optimize_videos --apply --only <post id>

Run it on your own computer (it reads the same backend/.env as the API). It is safe
to run more than once -- videos that are already fast are skipped -- and a stored
video is only replaced after its fast copy has been made and checked. Without
--apply nothing is changed.
"""

import argparse
import os
import sys
import tempfile

from app.core.video_optimize import find_ffmpeg, has_faststart, needs_optimizing, probe, speed_up_video
from app.db.supabase_client import VIDEO_BUCKET, get_supabase_client


def _mb(n: int) -> str:
    return f"{n / 1e6:5.1f} MB"


def main() -> None:
    parser = argparse.ArgumentParser(description="Make already-uploaded videos quick to play.")
    parser.add_argument("--apply", action="store_true", help="actually replace the videos (without this, only look)")
    parser.add_argument("--only", metavar="POST_ID", help="just this one post")
    args = parser.parse_args()

    ffmpeg = find_ffmpeg()
    if ffmpeg is None:
        sys.exit("No ffmpeg found. Run: pip install -r requirements.txt")

    supabase = get_supabase_client()
    query = supabase.table("posts").select("id,content,status,created_at").eq("kind", "video").order("created_at", desc=True)
    if args.only:
        query = query.eq("id", args.only)
    posts = query.execute().data
    print(f"{len(posts)} video post(s). {'CONVERTING.' if args.apply else 'Looking only -- nothing will be changed (add --apply to convert).'}\n")

    before_total = after_total = converted = 0
    for post in posts:
        label = f"{post['id'][:8]}  {post['status']:<12}"
        path = post["content"]
        try:
            data = supabase.storage.from_(VIDEO_BUCKET).download(path)
        except Exception as e:
            print(f"{label} could not download it: {e}")
            continue
        fd, local = tempfile.mkstemp(suffix=os.path.splitext(path)[1] or ".mp4")
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        del data
        fast_copy = None
        try:
            info = probe(local, ffmpeg)
            if info is None:
                print(f"{label} can't be read as a video -- skipped")
                continue
            size = os.path.getsize(local)
            details = f"{_mb(size)}  {info.codec:<5} {info.width}x{info.height} {info.fps:.0f}fps"
            if not needs_optimizing(info, has_faststart(local)):
                print(f"{label} {details}  already fast")
                before_total += size
                after_total += size
                continue
            if not args.apply:
                print(f"{label} {details}  WOULD convert")
                before_total += size
                after_total += size
                continue

            def store(new_path: str, storage_path: str = path) -> None:
                supabase.storage.from_(VIDEO_BUCKET).upload(storage_path, new_path, {"content-type": "video/mp4", "upsert": "true"})

            fast_copy = speed_up_video(local, store)
            before_total += size
            if fast_copy:
                new_size = os.path.getsize(fast_copy)
                after_total += new_size
                converted += 1
                print(f"{label} {details}  ->  {_mb(new_size)}  converted")
            else:
                after_total += size
                print(f"{label} {details}  left as it was")
        except Exception as e:
            print(f"{label} failed, left as it was: {e}")
        finally:
            for p in (local, fast_copy):
                if p and os.path.exists(p):
                    os.unlink(p)

    print(f"\nTotal stored: {_mb(before_total)} -> {_mb(after_total)}" + (f"  ({converted} converted)" if args.apply else "  (nothing changed)"))
    if not args.apply:
        print("Run again with --apply to convert the ones marked WOULD convert.")


if __name__ == "__main__":
    main()
