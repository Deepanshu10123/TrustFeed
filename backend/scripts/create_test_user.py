"""
No frontend exists yet, so this is how we get a real Supabase-issued token
to test the API with. Mimics what the future frontend will do: talk to
Supabase Auth directly (using the anon key, exactly as client-side code
would), not through our own API.

Usage:
    python scripts/create_test_user.py you@example.com yourpassword

Prints an access token -- use it as:
    curl -H "Authorization: Bearer <token>" http://localhost:8000/posts
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from supabase import create_client

from app.core.config import get_supabase_anon_key, get_supabase_url


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("Usage: python scripts/create_test_user.py <email> <password>")
    email, password = sys.argv[1], sys.argv[2]

    client = create_client(get_supabase_url(), get_supabase_anon_key())

    try:
        result = client.auth.sign_up({"email": email, "password": password})
    except Exception as e:
        print(f"Sign-up failed ({e}), trying sign-in instead (user may already exist)...")
        result = client.auth.sign_in_with_password({"email": email, "password": password})

    if result.session is None:
        sys.exit(
            "No session returned -- if this project has 'Confirm email' turned on, "
            "either disable it (Authentication settings) or confirm the email, then "
            "re-run this script to sign in."
        )

    print(f"user_id: {result.user.id}")
    print(f"access_token: {result.session.access_token}")


if __name__ == "__main__":
    main()
