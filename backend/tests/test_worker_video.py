"""How the worker uses the video optimizer (app/worker.py). The optimizer and
storage are faked -- what matters here is what the worker does around them."""

import pytest

from app import worker


class FakeBucket:
    def __init__(self):
        self.uploads = []

    def upload(self, path, file, options):
        self.uploads.append((path, file, options))


class FakeSupabase:
    def __init__(self):
        self.bucket = FakeBucket()
        self.storage = self

    def from_(self, name):
        assert name == worker.VIDEO_BUCKET
        return self.bucket


@pytest.fixture
def supabase(monkeypatch):
    fake = FakeSupabase()
    monkeypatch.setattr(worker, "get_supabase_client", lambda: fake)
    return fake


def test_the_fast_copy_replaces_the_upload_at_the_same_address(monkeypatch, supabase):
    def fake_speed_up(local_path, store, on_progress):
        store("/tmp/fast.mp4")
        return "/tmp/fast.mp4"

    monkeypatch.setattr(worker, "speed_up_video", fake_speed_up)
    result = worker._make_video_quick_to_play("user1/post1.mov", "/tmp/original.mov", lambda m: None)

    assert result == "/tmp/fast.mp4"
    # Same storage path (so the post row and the signed links need no change), replaced in
    # place, and served as MP4 even though the original was a .mov.
    assert supabase.bucket.uploads == [("user1/post1.mov", "/tmp/fast.mp4", {"content-type": "video/mp4", "upsert": "true"})]


def test_a_video_that_is_already_fast_is_left_alone(monkeypatch, supabase):
    monkeypatch.setattr(worker, "speed_up_video", lambda local_path, store, on_progress: None)
    assert worker._make_video_quick_to_play("user1/post1.mp4", "/tmp/original.mp4", lambda m: None) is None
    assert supabase.bucket.uploads == []


def test_a_problem_with_the_optimizer_never_fails_the_post(monkeypatch, supabase):
    reported = []

    def boom(local_path, store, on_progress):
        raise RuntimeError("ffmpeg fell over")

    monkeypatch.setattr(worker, "speed_up_video", boom)
    monkeypatch.setattr(worker, "report_error", reported.append)

    # No exception: the worker just carries on with the original video.
    assert worker._make_video_quick_to_play("user1/post1.mp4", "/tmp/original.mp4", lambda m: None) is None
    assert len(reported) == 1 and "ffmpeg fell over" in str(reported[0])


def test_a_failed_upload_of_the_fast_copy_also_keeps_the_original(monkeypatch, supabase):
    def store_fails(path, file, options):
        raise RuntimeError("storage is down")

    supabase.bucket.upload = store_fails

    def fake_speed_up(local_path, store, on_progress):
        store("/tmp/fast.mp4")  # raises
        return "/tmp/fast.mp4"

    monkeypatch.setattr(worker, "speed_up_video", fake_speed_up)
    monkeypatch.setattr(worker, "report_error", lambda e: None)
    assert worker._make_video_quick_to_play("user1/post1.mp4", "/tmp/original.mp4", lambda m: None) is None
