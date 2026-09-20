"""
The backend's Supabase client -- used by both the API Service and the
Verification Service (worker) for Postgres access and Storage.

Uses the service-role key (full access, bypasses Row Level Security).
Authorization -- "does this user own this post?" -- is enforced in the
API's own endpoint code for now, not RLS policies. That's a deliberate,
documented scope choice (see the Milestone 4a doc), not an oversight.

One more thing, learned from a real crash. Every part of the Supabase library
(database, storage, sign-in) opens its connection with HTTP/2 by default, which
sends many requests down ONE shared connection. This backend talks to Supabase
from many threads at once (FastAPI's thread pool, and asyncio.to_thread), and
threads sharing an HTTP/2 connection now and then corrupt it: a user's phone got a
500 with `ConnectionTerminated error_code:9`, caught by Sentry. In a stress test
with 12 threads sharing one client, HTTP/2 failed 45 of 1,200 requests and plain
HTTP/1.1 failed none. So the client below gets its own HTTP/1.1 connection pool --
each request happening at the same moment gets a connection of its own -- shared by
the database, storage and sign-in parts.
"""

import threading

import httpx
from supabase import Client, create_client
from supabase.lib.client_options import SyncClientOptions

from app.core.config import get_supabase_service_key, get_supabase_url

VIDEO_BUCKET = "videos"
AVATAR_BUCKET = "avatars"


class _RetryReadsOnce(httpx.BaseTransport):
    """If a READ fails because the connection itself broke (dropped, reset), try it
    once more on a fresh connection -- the API and Supabase are on different sides of
    an ocean, so the odd hiccup happens. A write is never repeated: it might already
    have gone through."""

    _READS = {"GET", "HEAD"}
    _BROKEN = (httpx.ConnectError, httpx.ReadError, httpx.RemoteProtocolError)

    def __init__(self, inner: httpx.BaseTransport):
        self._inner = inner

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        try:
            return self._inner.handle_request(request)
        except self._BROKEN:
            if request.method not in self._READS:
                raise
            return self._inner.handle_request(request)

    def close(self) -> None:
        self._inner.close()


def _make_http_client() -> httpx.Client:
    """The one connection pool the whole Supabase client uses (see the top of this file)."""
    transport = httpx.HTTPTransport(
        http2=False,  # the whole point -- see the top of this file
        limits=httpx.Limits(max_connections=32, max_keepalive_connections=16, keepalive_expiry=30.0),
        retries=2,  # if a brand-new connection can't even be opened, try again
    )
    return httpx.Client(
        transport=_RetryReadsOnce(transport),
        timeout=httpx.Timeout(60.0, connect=10.0),
        follow_redirects=True,
    )


_client: Client | None = None
_client_lock = threading.Lock()


def get_supabase_client() -> Client:
    global _client
    if _client is None:
        with _client_lock:  # many threads can ask at once on the first requests
            if _client is None:
                _client = create_client(
                    get_supabase_url(),
                    get_supabase_service_key(),
                    options=SyncClientOptions(httpx_client=_make_http_client()),
                )
    return _client
