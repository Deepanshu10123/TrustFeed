"""
Makes uploaded videos quick to play.

People upload whatever their phone recorded: often 1080p or 4K, 20-50 MB,
sometimes HEVC (which many browsers can't play at all), and usually with the
file's index at the END, so a browser can't start playing until it has fetched
that first. Every reel in the feed then has to download all of that -- the "video
takes forever to load" that people notice.

The Verification Service fixes each upload once, right after it arrives: 720p
H.264 at a sensible bitrate, with the index moved to the front ("faststart"). A
typical clip shrinks 5-10x, which also frees a lot of the small free Supabase
storage. If anything goes wrong the original is left exactly as it was -- an
unoptimised video is slow, but a lost one is much worse.

ffmpeg comes from the `imageio-ffmpeg` package (a real ffmpeg inside a normal
pip install), so there is nothing to set up on Render.
"""

import os
import re
import shutil
import subprocess
import tempfile
import time
from collections.abc import Callable
from dataclasses import dataclass

# The short side of the picture is capped at this: 720p is plenty on a phone, and
# it is what keeps the file small.
MAX_SHORT_SIDE = 720
# A video that is already H.264, indexed at the front, no bigger than 720p and
# under this size is left alone.
WEB_READY_MAX_BYTES = 6 * 1024 * 1024
# Give up on a video that takes longer than this to convert -- the worker has
# other posts waiting, and a post that sits "processing" too long is marked failed.
CONVERT_TIMEOUT_S = 240
# The converted copy must be about as long as the original, or something went wrong.
DURATION_TOLERANCE_S = 1.0
DURATION_TOLERANCE_FRACTION = 0.05


@dataclass(frozen=True)
class VideoInfo:
    duration_s: float
    width: int  # as shown to the viewer (a phone's sideways clip is already turned upright)
    height: int
    fps: float
    codec: str  # "h264", "hevc", "vp9", ...
    size_bytes: int


def find_ffmpeg() -> str | None:
    """The ffmpeg to use, or None if there isn't one."""
    try:
        import imageio_ffmpeg

        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if not os.access(exe, os.X_OK):  # belt and braces: a pip install can lose the "runnable" flag
            os.chmod(exe, os.stat(exe).st_mode | 0o111)
        return exe
    except Exception:
        return shutil.which("ffmpeg")


def parse_info(ffmpeg_output: str, size_bytes: int) -> VideoInfo | None:
    """Reads what `ffmpeg -i file` prints about a video. None if it isn't one."""
    duration = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", ffmpeg_output)
    video_line = next((line for line in ffmpeg_output.splitlines() if "Video:" in line and "Stream" in line), None)
    if duration is None or video_line is None:
        return None
    hours, minutes, seconds = duration.groups()
    codec = re.search(r"Video:\s*([A-Za-z0-9_]+)", video_line)
    size = re.search(r"\b(\d{2,5})x(\d{2,5})\b", video_line)
    if codec is None or size is None:
        return None
    fps = re.search(r"(\d+(?:\.\d+)?)\s*fps", video_line)
    width, height = int(size.group(1)), int(size.group(2))
    # A phone held upright often records sideways and adds a "turn me" note.
    turned = re.search(r"rotation of (-?\d+(?:\.\d+)?) degrees|rotate\s*:\s*(-?\d+)", ffmpeg_output)
    if turned:
        degrees = abs(float(turned.group(1) or turned.group(2))) % 180
        if degrees == 90:
            width, height = height, width
    return VideoInfo(
        duration_s=int(hours) * 3600 + int(minutes) * 60 + float(seconds),
        width=width,
        height=height,
        fps=float(fps.group(1)) if fps else 30.0,
        codec=codec.group(1).lower(),
        size_bytes=size_bytes,
    )


def probe(path: str, ffmpeg: str) -> VideoInfo | None:
    result = subprocess.run([ffmpeg, "-hide_banner", "-i", path], capture_output=True, text=True, timeout=60)
    # ffmpeg exits with an error here (no output file given) -- what we want is what it printed.
    return parse_info(result.stderr, os.path.getsize(path))


def has_faststart(path: str) -> bool:
    """True when an MP4's index ("moov") comes before its picture data ("mdat"), so a
    browser can start playing straight away. Anything that isn't a plain MP4/MOV
    counts as "no"."""
    try:
        with open(path, "rb") as f:
            for _ in range(32):
                header = f.read(8)
                if len(header) < 8:
                    return False
                size = int.from_bytes(header[:4], "big")
                kind = header[4:8]
                if kind == b"moov":
                    return True
                if kind == b"mdat":
                    return False
                if size == 1:  # the real size follows as 8 more bytes
                    extended = f.read(8)
                    if len(extended) < 8:
                        return False
                    size = int.from_bytes(extended, "big")
                    skip = size - 16
                elif size == 0:  # this box runs to the end of the file
                    return False
                else:
                    skip = size - 8
                if skip < 0:
                    return False
                f.seek(skip, 1)
    except OSError:
        return False
    return False


def needs_optimizing(info: VideoInfo, faststart: bool) -> bool:
    """False only for a video that is already what we'd make: H.264, indexed at the
    front, 720p or smaller, 30 frames a second or fewer, and small."""
    web_ready = (
        info.codec == "h264"
        and faststart
        and min(info.width, info.height) <= MAX_SHORT_SIDE
        and info.fps <= 30.5
        and info.size_bytes <= WEB_READY_MAX_BYTES
    )
    return not web_ready


def build_command(ffmpeg: str, src: str, dst: str, info: VideoInfo) -> list[str]:
    """The ffmpeg command that makes the fast copy. The scale rule works on the
    picture as ffmpeg has already turned it upright: the short side becomes at most
    720 pixels and the other follows, always an even number (video needs that)."""
    cap = MAX_SHORT_SIDE
    scale = (
        f"scale=w='if(gt(iw,ih),-2,trunc(min({cap},iw)/2)*2)':"
        f"h='if(gt(iw,ih),trunc(min({cap},ih)/2)*2,-2)'"
    )
    command = [
        ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
        "-i", src,
        "-map", "0:v:0", "-map", "0:a:0?",  # the picture, and the sound if there is any
        "-vf", scale,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "26",
        "-profile:v", "main", "-pix_fmt", "yuv420p",
        "-maxrate", "2500k", "-bufsize", "5000k",  # a ceiling, so a busy scene can't balloon the file
        "-c:a", "aac", "-b:a", "96k",
        "-movflags", "+faststart",
        "-threads", "2",  # the worker is a small machine
    ]
    if info.fps > 30.5:
        command += ["-r", "30"]  # 60 frames a second doubles the size for no visible gain on a phone
    return command + [dst]


def _valid_copy(original: VideoInfo, converted: VideoInfo) -> bool:
    tolerance = max(DURATION_TOLERANCE_S, DURATION_TOLERANCE_FRACTION * original.duration_s)
    return abs(converted.duration_s - original.duration_s) <= tolerance


def speed_up_video(
    local_path: str,
    store: Callable[[str], None],
    on_progress: Callable[[str], None] | None = None,
) -> str | None:
    """Makes the video at `local_path` quick to play, if it isn't already.

    `store(new_path)` is called with the finished copy so the caller can save it
    where the original was kept. Returns the path of that copy -- a temporary file
    the caller should delete when done (it is smaller than the original, so it is
    also the better file to analyse) -- or None if the video was left as it was
    (already fast, not worth it, no ffmpeg, or anything failed; nothing was stored)."""
    ffmpeg = find_ffmpeg()
    if ffmpeg is None:
        print("[optimize] no ffmpeg available -- leaving the video as it is", flush=True)
        return None
    info = probe(local_path, ffmpeg)
    if info is None:
        print("[optimize] couldn't read the video -- leaving it as it is", flush=True)
        return None
    if not needs_optimizing(info, has_faststart(local_path)):
        return None

    if on_progress:
        on_progress("Making the video quick to play...")
    fd, converted_path = tempfile.mkstemp(suffix=".mp4")
    os.close(fd)
    started = time.monotonic()
    keep = False
    try:
        subprocess.run(build_command(ffmpeg, local_path, converted_path, info), check=True, capture_output=True, timeout=CONVERT_TIMEOUT_S)
        converted = probe(converted_path, ffmpeg)
        if converted is None or converted.size_bytes == 0 or not _valid_copy(info, converted):
            print("[optimize] the converted copy looked wrong -- keeping the original", flush=True)
            return None
        # Smaller is the point. A copy that is bigger is only worth it when the original
        # couldn't be played everywhere (HEVC).
        if converted.size_bytes >= info.size_bytes and info.codec == "h264":
            print("[optimize] no gain from converting -- keeping the original", flush=True)
            return None
        store(converted_path)
        keep = True
        print(
            f"[optimize] {info.size_bytes / 1e6:.1f} MB {info.codec} {info.width}x{info.height} -> "
            f"{converted.size_bytes / 1e6:.1f} MB h264 {converted.width}x{converted.height} "
            f"in {time.monotonic() - started:.0f}s",
            flush=True,
        )
        return converted_path
    except subprocess.TimeoutExpired:
        print(f"[optimize] took longer than {CONVERT_TIMEOUT_S}s -- keeping the original", flush=True)
        return None
    except subprocess.CalledProcessError as e:
        print(f"[optimize] ffmpeg failed -- keeping the original: {e.stderr.decode(errors='replace')[-300:]}", flush=True)
        return None
    finally:
        if not keep and os.path.exists(converted_path):
            os.unlink(converted_path)
