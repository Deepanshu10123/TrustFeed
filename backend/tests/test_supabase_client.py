"""The backend's Supabase connection (app/db/supabase_client.py).

A real user's phone hit `ConnectionTerminated error_code:9`: the Supabase library's
default shared HTTP/2 connection getting corrupted by many threads using it at once.
These tests keep the fix in place -- HTTP/1.1, still a correct client, reads retried
once, one client no matter how many threads ask -- without touching a real Supabase."""

import threading
import time

import httpx
import pytest

from app.db import supabase_client as sc

FAKE_KEY = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.c2lnbmF0dXJl"  # JWT-shaped, not a real key


@pytest.fixture(autouse=True)
def fresh_client(monkeypatch):
    monkeypatch.setattr(sc, "_client", None)
    monkeypatch.setenv("SUPABASE_URL", "https://fake-project.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", FAKE_KEY)


# ---------------------------------------------------------------- HTTP/1.1, not HTTP/2
def test_the_connection_pool_is_plain_http_1_1(monkeypatch):
    seen = {}

    class RecordingTransport(httpx.BaseTransport):
        def __init__(self, **kwargs):
            seen.update(kwargs)

        def handle_request(self, request):
            raise AssertionError("no request expected")

    monkeypatch.setattr(sc.httpx, "HTTPTransport", RecordingTransport)
    sc._make_http_client()
    assert seen["http2"] is False


# ---------------------------------------------------------------- still a correct Supabase client
@pytest.fixture
def recorded(monkeypatch):
    """A real Supabase client whose connection goes to a fake server that records what it is asked."""
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        path = request.url.path
        if path.startswith("/storage/v1/object/sign"):
            return httpx.Response(200, json=[{"path": "u/a.mp4", "signedURL": "/object/sign/videos/u/a.mp4?token=t", "error": None}])
        if path.startswith("/storage/v1/object/videos") and request.method == "GET":
            return httpx.Response(200, content=b"video-bytes")
        if path.startswith("/storage/v1/object"):
            return httpx.Response(200, json={"Key": "videos/u/a.mp4", "Id": "x"})
        if path.startswith("/auth/v1/user"):
            return httpx.Response(
                200,
                json={
                    "id": "11111111-1111-1111-1111-111111111111", "aud": "authenticated", "role": "authenticated",
                    "email": "a@b.co", "app_metadata": {}, "user_metadata": {}, "created_at": "2026-01-01T00:00:00Z",
                },
            )
        return httpx.Response(200, json=[])

    monkeypatch.setattr(sc, "_make_http_client", lambda: httpx.Client(transport=httpx.MockTransport(handler)))
    return sc.get_supabase_client(), requests


def _assert_addressed_and_signed_in(request: httpx.Request, path_prefix: str, bearer: str = f"Bearer {FAKE_KEY}"):
    # Swapping in our own connection must not lose the address or the login headers that
    # the library's default connection used to carry.
    assert request.url.host == "fake-project.supabase.co"
    assert request.url.path.startswith(path_prefix)
    assert request.headers["apikey"] == FAKE_KEY
    assert request.headers["authorization"] == bearer


def test_database_reads_and_writes_reach_the_right_place_with_the_service_key(recorded):
    client, requests = recorded
    client.table("posts").select("id").eq("status", "published").limit(5).execute()
    client.table("posts").insert({"id": "x"}).execute()
    client.table("user_preferences").upsert({"user_id": "u"}).execute()
    client.rpc("like_info", {"post_ids": ["a"], "me": "u"}).execute()
    assert [r.method for r in requests] == ["GET", "POST", "POST", "POST"]
    for request in requests:
        _assert_addressed_and_signed_in(request, "/rest/v1/")
    assert requests[3].url.path == "/rest/v1/rpc/like_info"


def test_storage_signing_download_and_upload_work(recorded, tmp_path):
    client, requests = recorded
    client.storage.from_("videos").create_signed_urls(["u/a.mp4"], 3600)
    assert client.storage.from_("videos").download("u/a.mp4") == b"video-bytes"
    video = tmp_path / "a.mp4"
    video.write_bytes(b"x" * 1000)
    client.storage.from_("videos").upload("u/a.mp4", str(video), {"content-type": "video/mp4", "upsert": "true"})
    assert [r.method for r in requests] == ["POST", "GET", "POST"]
    for request in requests:
        _assert_addressed_and_signed_in(request, "/storage/v1/object")
    assert requests[2].headers["content-type"].startswith(("video/mp4", "multipart"))


def test_checking_someones_sign_in_uses_their_own_token(recorded):
    client, requests = recorded
    client.auth.get_user("the-users-jwt")
    (request,) = requests
    _assert_addressed_and_signed_in(request, "/auth/v1/user", bearer="Bearer the-users-jwt")


# ---------------------------------------------------------------- reads are retried once, writes never
class ScriptedTransport(httpx.BaseTransport):
    """Fails in the ways given, in order, then answers 200."""

    def __init__(self, failures):
        self.failures = list(failures)
        self.calls = 0

    def handle_request(self, request):
        self.calls += 1
        if self.failures:
            raise self.failures.pop(0)
        return httpx.Response(200, request=request)


def _send(method, failures):
    inner = ScriptedTransport(failures)
    client = httpx.Client(transport=sc._RetryReadsOnce(inner))
    try:
        return client.request(method, "https://fake-project.supabase.co/rest/v1/posts").status_code, inner.calls
    except httpx.HTTPError as e:
        return type(e).__name__, inner.calls


def test_a_read_that_loses_its_connection_is_tried_once_more():
    assert _send("GET", [httpx.RemoteProtocolError("ConnectionTerminated error_code:9")]) == (200, 2)
    assert _send("GET", [httpx.ReadError("reset")]) == (200, 2)
    assert _send("GET", [httpx.ConnectError("refused")]) == (200, 2)


def test_only_one_retry_is_made():
    assert _send("GET", [httpx.ReadError("a"), httpx.ReadError("b")]) == ("ReadError", 2)


def test_a_write_is_never_repeated_it_might_already_have_gone_through():
    assert _send("POST", [httpx.RemoteProtocolError("boom")]) == ("RemoteProtocolError", 1)
    assert _send("DELETE", [httpx.ReadError("boom")]) == ("ReadError", 1)


def test_a_timeout_is_not_retried_so_waiting_isnt_doubled():
    assert _send("GET", [httpx.ReadTimeout("slow")]) == ("ReadTimeout", 1)


# ---------------------------------------------------------------- one client, however many threads ask
def test_many_threads_asking_at_once_still_get_one_client(monkeypatch):
    made = []

    def slow_create_client(url, key, options=None):
        time.sleep(0.05)  # long enough for the other threads to arrive while this one is building
        made.append(object())
        return made[-1]

    monkeypatch.setattr(sc, "create_client", slow_create_client)
    got = []
    threads = [threading.Thread(target=lambda: got.append(sc.get_supabase_client())) for _ in range(16)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    assert len(made) == 1
    assert all(client is made[0] for client in got)
