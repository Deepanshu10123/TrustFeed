"""Making uploaded videos quick to play (app/core/video_optimize.py).

The first half is plain logic (what to convert, how to read a video's details, where
the index sits in a file). The second half makes small real videos with ffmpeg and
converts them, to prove the result is what the feed needs: 720p at most, upright,
H.264, index at the front, about the same length. Those are skipped if ffmpeg is
missing."""

import os
import struct
import subprocess

import pytest

from app.core import video_optimize as vo
from app.core.video_optimize import VideoInfo

MB = 1024 * 1024

H264_1080P = """\
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'clip.mp4':
  Duration: 00:00:12.03, start: 0.000000, bitrate: 15236 kb/s
  Stream #0:0[0x1](und): Video: h264 (High) (avc1 / 0x31637661), yuv420p(tv, bt709, progressive), 1920x1080 [SAR 1:1 DAR 16:9], 15100 kb/s, 29.97 fps, 29.97 tbr, 30k tbn (default)
  Stream #0:1[0x2](und): Audio: aac (LC) (mp4a / 0x6134706D), 44100 Hz, stereo, fltp, 128 kb/s (default)
"""

IPHONE_SIDEWAYS_HEVC = """\
Input #0, mov,mp4,m4a,3gp,3g2,mj2, from 'IMG_0042.MOV':
  Duration: 00:01:02.50, start: 0.000000, bitrate: 42000 kb/s
  Stream #0:0[0x1](und): Video: hevc (Main) (hvc1 / 0x31637668), yuv420p10le(tv, bt2020nc/bt2020/arib-std-b67), 3840x2160, 41900 kb/s, 59.94 fps, 59.94 tbr, 600 tbn (default)
    Side data:
      displaymatrix: rotation of -90.00 degrees
"""

AUDIO_ONLY = """\
Input #0, mp3, from 'song.mp3':
  Duration: 00:03:00.00, start: 0.025057, bitrate: 128 kb/s
  Stream #0:0: Audio: mp3, 44100 Hz, stereo, fltp, 128 kb/s
"""


# ---------------------------------------------------------------- reading a video's details
def test_reads_an_ordinary_landscape_clip():
    info = vo.parse_info(H264_1080P, 20 * MB)
    assert info == VideoInfo(duration_s=12.03, width=1920, height=1080, fps=29.97, codec="h264", size_bytes=20 * MB)


def test_a_sideways_phone_clip_is_read_the_way_it_is_shown():
    info = vo.parse_info(IPHONE_SIDEWAYS_HEVC, 300 * MB)
    assert (info.width, info.height) == (2160, 3840)  # 4K, held upright
    assert info.codec == "hevc"
    assert info.fps == 59.94
    assert info.duration_s == pytest.approx(62.5)


def test_something_without_a_picture_is_not_a_video():
    assert vo.parse_info(AUDIO_ONLY, MB) is None
    assert vo.parse_info("", MB) is None
    assert vo.parse_info("not a video at all", MB) is None


# ---------------------------------------------------------------- where the index sits
def _box(kind: bytes, payload: bytes = b"") -> bytes:
    return struct.pack(">I", 8 + len(payload)) + kind + payload


def test_index_at_the_front_is_faststart(tmp_path):
    f = tmp_path / "a.mp4"
    f.write_bytes(_box(b"ftyp", b"isom0000") + _box(b"moov", b"x" * 50) + _box(b"mdat", b"y" * 500))
    assert vo.has_faststart(str(f)) is True


def test_index_at_the_end_is_not(tmp_path):
    f = tmp_path / "a.mp4"
    f.write_bytes(_box(b"ftyp", b"isom0000") + _box(b"mdat", b"y" * 500) + _box(b"moov", b"x" * 50))
    assert vo.has_faststart(str(f)) is False


def test_a_huge_picture_box_with_a_64_bit_size_is_read_correctly(tmp_path):
    f = tmp_path / "a.mp4"
    big_mdat = struct.pack(">I", 1) + b"mdat" + struct.pack(">Q", 16 + 300)  # size 1 means "the real size follows"
    f.write_bytes(_box(b"ftyp", b"isom0000") + big_mdat + b"z" * 300 + _box(b"moov", b"x" * 20))
    assert vo.has_faststart(str(f)) is False


def test_garbage_and_missing_files_are_not_faststart(tmp_path):
    f = tmp_path / "junk.mp4"
    f.write_bytes(b"\x00\x01 this is not an mp4 file")
    assert vo.has_faststart(str(f)) is False
    assert vo.has_faststart(str(tmp_path / "missing.mp4")) is False


# ---------------------------------------------------------------- what to convert
def _info(**kw) -> VideoInfo:
    base = dict(duration_s=10, width=1280, height=720, fps=30.0, codec="h264", size_bytes=3 * MB)
    return VideoInfo(**{**base, **kw})


def test_a_small_web_ready_clip_is_left_alone():
    assert vo.needs_optimizing(_info(), faststart=True) is False


@pytest.mark.parametrize(
    "change, faststart",
    [
        ({"size_bytes": 30 * MB}, True),  # too big
        ({"width": 1920, "height": 1080}, True),  # more than 720p
        ({"width": 1080, "height": 1920}, True),  # portrait 1080p
        ({"codec": "hevc"}, True),  # many browsers can't play it
        ({"fps": 60.0}, True),
        ({}, False),  # index at the end
    ],
)
def test_anything_else_is_converted(change, faststart):
    assert vo.needs_optimizing(_info(**change), faststart=faststart) is True


def test_a_720p_portrait_clip_counts_as_720p():
    assert vo.needs_optimizing(_info(width=720, height=1280), faststart=True) is False


def test_the_command_caps_the_size_and_moves_the_index_to_the_front():
    command = vo.build_command("ffmpeg", "in.mov", "out.mp4", _info(codec="hevc", width=2160, height=3840, fps=30.0))
    joined = " ".join(command)
    assert "+faststart" in command
    assert "libx264" in command and "aac" in command
    assert "min(720,iw)" in joined and "min(720,ih)" in joined
    assert "-r" not in command  # already 30 frames a second
    assert command[-1] == "out.mp4"


def test_sixty_frames_a_second_is_brought_down_to_thirty():
    command = vo.build_command("ffmpeg", "in.mov", "out.mp4", _info(fps=59.94))
    assert command[command.index("-r") + 1] == "30"


def test_a_copy_of_the_wrong_length_is_rejected():
    assert vo._valid_copy(_info(duration_s=10), _info(duration_s=10.4)) is True
    assert vo._valid_copy(_info(duration_s=10), _info(duration_s=3)) is False  # cut short
    assert vo._valid_copy(_info(duration_s=600), _info(duration_s=590)) is True  # 5% slack on long clips


# ---------------------------------------------------------------- real videos
FFMPEG = vo.find_ffmpeg()
needs_ffmpeg = pytest.mark.skipif(FFMPEG is None, reason="ffmpeg not available")


def make_video(path, *, size="1920x1080", rate=30, seconds=3, faststart=False, codec="libx264", rotate=None, audio=True):
    command = [FFMPEG, "-y", "-loglevel", "error", "-f", "lavfi", "-i", f"testsrc2=size={size}:rate={rate}:duration={seconds}"]
    if audio:
        command += ["-f", "lavfi", "-i", f"sine=frequency=440:duration={seconds}"]
    command += ["-c:v", codec, "-pix_fmt", "yuv420p"]
    if codec == "libx264":
        command += ["-crf", "16"]  # generous quality, so the original is big like a phone's
    if audio:
        command += ["-c:a", "aac"]
    if faststart:
        command += ["-movflags", "+faststart"]
    target = str(path) if rotate is None else str(path) + ".upright.mp4"
    subprocess.run(command + [target], check=True, capture_output=True)
    if rotate is not None:  # what a phone does: keep the picture sideways and add a "turn me" note
        subprocess.run(
            [FFMPEG, "-y", "-loglevel", "error", "-display_rotation:v:0", str(rotate), "-i", target, "-c", "copy", str(path)],
            check=True,
            capture_output=True,
        )
    return str(path)


def convert(path):
    """Runs the real thing; returns (converted_path_or_None, list_of_paths_store_was_called_with)."""
    stored = []
    result = vo.speed_up_video(str(path), store=stored.append, on_progress=None)
    return result, stored


@needs_ffmpeg
def test_a_big_landscape_clip_becomes_720p_h264_with_the_index_first(tmp_path):
    src = make_video(tmp_path / "phone.mp4", size="1920x1080")
    assert vo.has_faststart(src) is False
    result, stored = convert(src)
    try:
        assert result is not None and stored == [result]
        info = vo.probe(result, FFMPEG)
        assert (info.width, info.height) == (1280, 720)
        assert info.codec == "h264"
        assert vo.has_faststart(result) is True
        assert info.size_bytes < os.path.getsize(src)
        assert info.duration_s == pytest.approx(3, abs=0.5)
    finally:
        if result:
            os.unlink(result)


@needs_ffmpeg
def test_a_portrait_clip_stays_portrait(tmp_path):
    src = make_video(tmp_path / "portrait.mp4", size="1080x1920")
    result, _ = convert(src)
    try:
        info = vo.probe(result, FFMPEG)
        assert (info.width, info.height) == (720, 1280)
    finally:
        if result:
            os.unlink(result)


@needs_ffmpeg
def test_a_clip_recorded_sideways_comes_out_upright(tmp_path):
    src = make_video(tmp_path / "sideways.mp4", size="1920x1080", rotate=90)
    before = vo.probe(src, FFMPEG)
    assert (before.width, before.height) == (1080, 1920)  # read the way it is shown
    result, _ = convert(src)
    try:
        info = vo.probe(result, FFMPEG)
        assert (info.width, info.height) == (720, 1280)
    finally:
        if result:
            os.unlink(result)


@needs_ffmpeg
def test_sixty_frames_a_second_comes_out_at_thirty(tmp_path):
    src = make_video(tmp_path / "fast.mp4", size="1280x720", rate=60)
    result, _ = convert(src)
    try:
        assert vo.probe(result, FFMPEG).fps <= 30.5
    finally:
        if result:
            os.unlink(result)


@needs_ffmpeg
def test_a_clip_without_sound_still_converts(tmp_path):
    src = make_video(tmp_path / "silent.mp4", size="1920x1080", audio=False)
    result, _ = convert(src)
    try:
        assert result is not None
    finally:
        if result:
            os.unlink(result)


@needs_ffmpeg
def test_a_clip_that_is_already_fast_is_left_alone(tmp_path):
    src = make_video(tmp_path / "small.mp4", size="640x360", seconds=2, faststart=True)
    assert os.path.getsize(src) < vo.WEB_READY_MAX_BYTES
    result, stored = convert(src)
    assert result is None and stored == []


@needs_ffmpeg
def test_something_that_is_not_a_video_is_left_alone(tmp_path):
    junk = tmp_path / "junk.mp4"
    junk.write_bytes(b"this is not a video" * 100)
    result, stored = convert(junk)
    assert result is None and stored == []


@needs_ffmpeg
def test_if_saving_the_copy_fails_the_error_reaches_the_caller_and_nothing_is_left_behind(tmp_path):
    src = make_video(tmp_path / "phone.mp4", size="1920x1080")
    seen = []

    def failing_store(path):
        seen.append(path)
        raise RuntimeError("storage is down")

    with pytest.raises(RuntimeError):
        vo.speed_up_video(src, store=failing_store)
    assert seen and not os.path.exists(seen[0])  # the temporary copy was cleaned up


@needs_ffmpeg
def test_hevc_is_converted_even_if_the_copy_is_not_smaller(tmp_path):
    encoders = subprocess.run([FFMPEG, "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
    if "libx265" not in encoders:
        pytest.skip("this ffmpeg has no HEVC encoder")
    src = make_video(tmp_path / "hevc.mp4", size="640x360", seconds=2, faststart=True, codec="libx265")
    assert vo.probe(src, FFMPEG).codec == "hevc"
    result, stored = convert(src)
    try:
        assert result is not None  # many browsers can't play HEVC, so H.264 is worth it whatever the size
        assert vo.probe(result, FFMPEG).codec == "h264"
    finally:
        if result:
            os.unlink(result)
