"""
Fast, no-network tests for the in-memory copy of people's chosen topics
(app/core/interests_cache.py). A fake clock stands in for time passing.
"""

from types import SimpleNamespace

import pytest

import app.core.interests_cache as cache


@pytest.fixture(autouse=True)
def clean_and_fake_clock(monkeypatch):
    cache.forget_all_topics()
    clock = [1000.0]
    monkeypatch.setattr(cache, "time", SimpleNamespace(monotonic=lambda: clock[0]))
    yield clock
    cache.forget_all_topics()


def test_nothing_remembered_means_none():
    assert cache.cached_topics("nobody") is None


def test_remembered_topics_come_back():
    cache.remember_topics("u1", ["Science", "History"])
    assert cache.cached_topics("u1") == ["Science", "History"]


def test_no_topics_picked_is_remembered_too_and_is_not_confused_with_nothing_remembered():
    cache.remember_topics("u1", [])
    assert cache.cached_topics("u1") == []  # "show everything" -- a real answer, not a miss


def test_people_are_kept_apart():
    cache.remember_topics("u1", ["Science"])
    cache.remember_topics("u2", ["Sports"])
    assert cache.cached_topics("u1") == ["Science"]
    assert cache.cached_topics("u2") == ["Sports"]


def test_a_copy_is_handed_out_so_callers_cannot_change_what_is_remembered():
    cache.remember_topics("u1", ["Science"])
    cache.cached_topics("u1").append("Sports")
    assert cache.cached_topics("u1") == ["Science"]


def test_remembering_replaces_the_old_answer_straight_away():
    cache.remember_topics("u1", ["Science"])
    cache.remember_topics("u1", ["Sports"])  # what set_interests does after a change
    assert cache.cached_topics("u1") == ["Sports"]


def test_it_expires(clean_and_fake_clock):
    clock = clean_and_fake_clock
    cache.remember_topics("u1", ["Science"])
    clock[0] += cache.TTL_SECONDS - 1
    assert cache.cached_topics("u1") == ["Science"]
    clock[0] += 1
    assert cache.cached_topics("u1") is None


def test_it_cannot_grow_without_limit(monkeypatch):
    monkeypatch.setattr(cache, "_MAX_PEOPLE", 3)
    for n in range(4):
        cache.remember_topics(f"u{n}", ["Science"])
    assert cache.cached_topics("u0") is None  # cleared when the cap was hit
    assert cache.cached_topics("u3") == ["Science"]


def test_forget_all_empties_it():
    cache.remember_topics("u1", ["Science"])
    cache.forget_all_topics()
    assert cache.cached_topics("u1") is None
