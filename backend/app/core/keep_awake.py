"""
Keeps the free API Service from going to sleep.

Render's free web services fall asleep after 15 minutes without a visitor, and
the next person then waits about a minute while the API wakes up. That is the
loading screen that never ends, or the "Try again" button, when someone opens
the app after a quiet spell.

The Verification Service (the worker) is a paid service that never sleeps, so it
is the natural one to do the nudging: a small background thread there visits the
API's /health address every few minutes.

(A scheduled GitHub job was tried first and is far too unreliable to depend on:
GitHub runs those late and skips many of them -- over 11 hours it ran 6 times
instead of about 137, so the API still slept between nearly every run.)
"""

import os
import threading
import time
import urllib.request

# This project's own API (the same address the GitHub job visits).
DEFAULT_URL = "https://trustfeed-api.onrender.com/health"
# Every 4 minutes: comfortably inside Render's 15-minute sleep timer, even if a
# visit or two is slow.
INTERVAL_S = 240
# If the API didn't answer (it may be redeploying), look again sooner.
RETRY_S = 60


def get_keep_awake_url() -> str | None:
    """Where to visit, or None for "don't".

    On Render it defaults to this project's own API. On a laptop it stays off, so
    running the worker locally doesn't poke the live app (Render sets RENDER=true
    in everything it runs). KEEP_AWAKE_URL overrides either way, and "off" turns
    it off even on Render."""
    configured = os.environ.get("KEEP_AWAKE_URL", "").strip()
    if configured.lower() in {"off", "false", "no", "0"}:
        return None
    if configured:
        return configured
    return DEFAULT_URL if os.environ.get("RENDER") else None


def visit(url: str, timeout_s: int = 100) -> bool:
    """One visit. True if the API answered properly; never raises. A sleeping API
    takes up to a minute to answer -- which is exactly what wakes it -- so the
    timeout is generous."""
    try:
        with urllib.request.urlopen(url, timeout=timeout_s) as response:
            response.read(1)
            return 200 <= response.status < 400
    except Exception:
        return False


def _keep_awake_loop(url: str) -> None:
    was_ok: bool | None = None
    while True:
        ok = visit(url)
        if ok != was_ok:  # only say something when it changes, so the logs stay quiet
            print(f"[keep-awake] {url} {'is answering' if ok else 'did not answer -- will keep trying'}", flush=True)
            was_ok = ok
        time.sleep(INTERVAL_S if ok else RETRY_S)


def start_keep_awake() -> bool:
    """Starts the background visits, if they're turned on. Returns whether they
    started. The thread dies with the worker, and can't hold it up."""
    url = get_keep_awake_url()
    if url is None:
        return False
    threading.Thread(target=_keep_awake_loop, args=(url,), daemon=True, name="keep-awake").start()
    return True
