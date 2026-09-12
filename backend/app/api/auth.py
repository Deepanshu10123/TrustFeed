"""
Verifies who's making a request. Deliberately does NOT verify the JWT's
signature by hand -- it hands the token to Supabase's own auth.get_user()
call and trusts its answer. Hand-rolling cryptographic signature
verification is exactly the kind of thing that's easy to get subtly wrong
in a security-sensitive way; one extra network call per request is a fine
trade for not owning that risk.
"""

from fastapi import Header, HTTPException

from app.db.supabase_client import get_supabase_client


def _verify_token(token: str):
    try:
        response = get_supabase_client().auth.get_user(token)
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
