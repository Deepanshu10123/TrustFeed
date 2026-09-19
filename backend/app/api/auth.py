"""
Verifies who's making a request. Deliberately does NOT verify the JWT's
signature by hand -- hand-rolling cryptography is exactly the kind of thing
that's easy to get subtly wrong in a security-sensitive way. It uses Supabase's
own library for that.

The fast way (get_claims): the library checks the token's signature against the
project's public signing key and its expiry, right here, with no call to
Supabase's servers. The key is fetched once and kept for a while. The slow way
(get_user) asks Supabase's servers about the token -- a round trip from this
server (Oregon) to Supabase (Tokyo) on every single request, which measured at
roughly 0.15-0.3 seconds each and was as much as the request itself.

The trade-off: a token now stays good until it expires (up to an hour) even if
the person signs out in the meantime, where the slow way noticed at once. And
anything the fast way can't settle -- a project still on the older shared-secret
keys, a hiccup fetching the key, a token that looks bad -- falls back to the slow
way, so it's never less strict about who gets in, only quicker about the usual case.
"""

from types import SimpleNamespace

from fastapi import Header, HTTPException

from app.db.supabase_client import get_supabase_client


def _verify_token(token: str):
    auth = get_supabase_client().auth

    try:
        user_id = auth.get_claims(token)["claims"].get("sub")
    except Exception:
        user_id = None  # couldn't settle it locally -- ask Supabase itself, below
    if user_id:
        return SimpleNamespace(id=user_id)  # the only thing the API ever reads off the user

    try:
        response = auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if response is None or response.user is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return response.user


def get_current_user(authorization: str | None = Header(None)):
    # authorization is optional at the FastAPI level on purpose: a *missing*
    # header should be a 401 like any other auth failure, not FastAPI's
    # generic 422 for "a required field wasn't provided".
    if authorization is None or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Expected 'Authorization: Bearer <token>'")
    return _verify_token(authorization.removeprefix("Bearer ").strip())


def get_current_user_from_query(token: str):
    """Same verification, token taken from a query param instead of the
    Authorization header -- needed for Milestone 7b's SSE endpoint, since
    browsers' native EventSource can't send custom headers."""
    return _verify_token(token)
