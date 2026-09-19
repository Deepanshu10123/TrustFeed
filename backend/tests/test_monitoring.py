"""
Fast, no-network tests for the error-tracking helpers (see
app/core/monitoring.py) -- nothing here talks to Sentry, so they run in CI
alongside test_gate.py.
"""

import app.core.monitoring as monitoring
from app.core.monitoring import init_error_tracking, report_error, scrub_event


def event_for(**request) -> dict:
    return {"request": request, "message": "boom"}


def test_the_token_in_a_stream_url_is_removed():
    event = scrub_event(event_for(url="https://api.test/posts/abc/stream?token=SECRET123", query_string="token=SECRET123"))
    assert "SECRET123" not in str(event)
    assert event["request"]["url"] == "https://api.test/posts/abc/stream?token=[removed]"
    assert event["request"]["query_string"] == "token=[removed]"


def test_only_the_token_is_touched_when_there_are_other_parameters():
    event = scrub_event(event_for(url="https://api.test/x?a=1&token=SECRET&b=2", query_string="a=1&token=SECRET&b=2"))
    assert event["request"]["url"] == "https://api.test/x?a=1&token=[removed]&b=2"
    assert event["request"]["query_string"] == "a=1&token=[removed]&b=2"


def test_a_parameter_that_merely_ends_in_token_is_left_alone():
    event = scrub_event(event_for(url="https://api.test/x?mytoken=keep", query_string="mytoken=keep"))
    assert event["request"]["url"].endswith("mytoken=keep")
    assert event["request"]["query_string"] == "mytoken=keep"


def test_a_query_string_that_arrives_as_pairs_or_a_dict_is_scrubbed_too():
    pairs = scrub_event(event_for(query_string=[["token", "SECRET"], ["a", "1"]]))
    assert pairs["request"]["query_string"] == [["token", "[removed]"], ["a", "1"]]
    mapping = scrub_event(event_for(query_string={"token": "SECRET", "a": "1"}))
    assert mapping["request"]["query_string"] == {"token": "[removed]", "a": "1"}


def test_an_event_with_no_request_passes_through():
    assert scrub_event({"message": "boom"}) == {"message": "boom"}


def test_the_privacy_settings_are_always_on(monkeypatch):
    import sentry_sdk

    seen = {}
    monkeypatch.setattr(sentry_sdk, "init", lambda **settings: seen.update(settings))
    monkeypatch.setenv("SENTRY_DSN", "https://public@o0.ingest.sentry.io/1")
    monkeypatch.setattr(monitoring, "_enabled", False)
    init_error_tracking("worker")
    assert seen["server_name"] == "worker"
    assert seen["before_send"] is scrub_event
    assert seen["send_default_pii"] is False
    assert seen["include_local_variables"] is False  # frame variables can carry the raw request, token and all
    assert seen["max_request_body_size"] == "never"
    assert seen["traces_sample_rate"] == 0


def test_nothing_happens_without_a_dsn(monkeypatch):
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    monkeypatch.setattr(monitoring, "_enabled", False)
    init_error_tracking("api")
    assert monitoring._enabled is False
    report_error(RuntimeError("ignored"))  # must not raise, and must not need Sentry installed
