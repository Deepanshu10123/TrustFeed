"""
Fast, no-network tests for how requests are authenticated (app/api/auth.py).
A stand-in plays Supabase's auth client, so we can check which of the two ways
of verifying a token was used, and that nothing gets in that shouldn't.
"""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

import app.api.auth as auth


class FakeAuth:
    """`claims` / `user` are what each call answers with; `*_error` makes it fail."""

    def __init__(self, claims=None, claims_error=None, user=None, user_error=None):
        self.claims, self.claims_error = claims, claims_error
        self.user, self.user_error = user, user_error
        self.calls: list[str] = []
        self.tokens: list[str] = []

    def get_claims(self, token):
        self.calls.append("get_claims")
        self.tokens.append(token)
        if self.claims_error:
            raise self.claims_error
        return {"claims": self.claims, "headers": {}, "signature": b""}

    def get_user(self, token):
        self.calls.append("get_user")
        if self.user_error:
            raise self.user_error
        return SimpleNamespace(user=self.user)


@pytest.fixture
def use_auth(monkeypatch):
    def install(fake: FakeAuth) -> FakeAuth:
        monkeypatch.setattr(auth, "get_supabase_client", lambda: SimpleNamespace(auth=fake))
        return fake

    return install


def test_a_valid_token_is_settled_locally_without_asking_supabase(use_auth):
    fake = use_auth(FakeAuth(claims={"sub": "user-123"}))
    assert auth._verify_token("tok").id == "user-123"
    assert fake.calls == ["get_claims"]  # no round trip to Supabase


def test_a_token_the_quick_check_cannot_settle_falls_back_to_asking_supabase(use_auth):
    # e.g. a project still on the older shared-secret keys, or a hiccup fetching the key
    fake = use_auth(FakeAuth(claims_error=RuntimeError("no key"), user=SimpleNamespace(id="user-9")))
    assert auth._verify_token("tok").id == "user-9"
    assert fake.calls == ["get_claims", "get_user"]


def test_claims_without_a_user_id_are_not_trusted(use_auth):
    fake = use_auth(FakeAuth(claims={"role": "anon"}, user=None))
    with pytest.raises(HTTPException) as caught:
        auth._verify_token("anon-key-pretending-to-be-a-person")
    assert caught.value.status_code == 401
    assert fake.calls == ["get_claims", "get_user"]  # and Supabase itself said no too


def test_a_bad_token_is_rejected_when_both_ways_say_no(use_auth):
    use_auth(FakeAuth(claims_error=ValueError("bad signature"), user_error=RuntimeError("invalid JWT")))
    with pytest.raises(HTTPException) as caught:
        auth._verify_token("junk")
    assert caught.value.status_code == 401
    assert caught.value.detail == "Invalid or expired token"


def test_an_expired_token_is_rejected(use_auth):
    use_auth(FakeAuth(claims_error=ValueError("JWT has expired"), user=None))
    with pytest.raises(HTTPException) as caught:
        auth._verify_token("old")
    assert caught.value.status_code == 401


def test_a_missing_or_malformed_header_is_a_401_not_a_422(use_auth):
    use_auth(FakeAuth(claims={"sub": "u"}))
    for header in (None, "", "Token abc", "bearer abc"):
        with pytest.raises(HTTPException) as caught:
            auth.get_current_user(header)
        assert caught.value.status_code == 401


def test_the_bearer_prefix_and_spaces_are_stripped_before_checking(use_auth):
    fake = use_auth(FakeAuth(claims={"sub": "u"}))
    assert auth.get_current_user("Bearer   abc.def.ghi  ").id == "u"
    assert fake.tokens == ["abc.def.ghi"]


def test_the_live_progress_stream_uses_the_same_check(use_auth):
    fake = use_auth(FakeAuth(claims={"sub": "streamer"}))
    assert auth.get_current_user_from_query("tok").id == "streamer"
    assert fake.calls == ["get_claims"]
