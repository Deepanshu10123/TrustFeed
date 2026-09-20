"""The worker's nudge that keeps the free API awake (app/core/keep_awake.py).
No network: the visit itself is faked."""

import urllib.error

import pytest

from app.core import keep_awake


@pytest.fixture(autouse=True)
def clean_env(monkeypatch):
    monkeypatch.delenv("KEEP_AWAKE_URL", raising=False)
    monkeypatch.delenv("RENDER", raising=False)


def test_off_on_a_laptop_so_the_live_app_isnt_poked_by_local_runs():
    assert keep_awake.get_keep_awake_url() is None


def test_on_by_default_on_render(monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    assert keep_awake.get_keep_awake_url() == keep_awake.DEFAULT_URL


def test_can_be_pointed_somewhere_else(monkeypatch):
    monkeypatch.setenv("KEEP_AWAKE_URL", "https://example.com/health")
    assert keep_awake.get_keep_awake_url() == "https://example.com/health"


@pytest.mark.parametrize("value", ["off", "OFF", "false", "no", "0"])
def test_can_be_switched_off_even_on_render(monkeypatch, value):
    monkeypatch.setenv("RENDER", "true")
    monkeypatch.setenv("KEEP_AWAKE_URL", value)
    assert keep_awake.get_keep_awake_url() is None


class _Response:
    def __init__(self, status):
        self.status = status

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self, n=-1):
        return b"{}"


def test_a_visit_that_is_answered_counts(monkeypatch):
    monkeypatch.setattr(keep_awake.urllib.request, "urlopen", lambda url, timeout: _Response(200))
    assert keep_awake.visit("https://example.com/health") is True


def test_a_visit_never_raises_even_when_the_api_is_down(monkeypatch):
    def down(url, timeout):
        raise urllib.error.URLError("connection refused")

    monkeypatch.setattr(keep_awake.urllib.request, "urlopen", down)
    assert keep_awake.visit("https://example.com/health") is False


def test_an_error_page_does_not_count(monkeypatch):
    monkeypatch.setattr(keep_awake.urllib.request, "urlopen", lambda url, timeout: _Response(503))
    assert keep_awake.visit("https://example.com/health") is False


def test_nothing_starts_when_it_is_off():
    assert keep_awake.start_keep_awake() is False


def test_the_visits_start_in_the_background_on_render(monkeypatch):
    monkeypatch.setenv("RENDER", "true")
    started = []

    class FakeThread:
        def __init__(self, target, args, daemon, name):
            started.append((target, args, daemon, name))

        def start(self):
            started[-1] += ("started",)

    monkeypatch.setattr(keep_awake.threading, "Thread", FakeThread)
    assert keep_awake.start_keep_awake() is True
    target, args, daemon, name, marker = started[0]
    assert args == (keep_awake.DEFAULT_URL,)
    assert daemon is True  # so it can never keep the worker from stopping
    assert marker == "started"


def test_the_interval_stays_well_inside_renders_sleep_timer():
    assert keep_awake.INTERVAL_S <= 5 * 60
    assert keep_awake.RETRY_S < keep_awake.INTERVAL_S
