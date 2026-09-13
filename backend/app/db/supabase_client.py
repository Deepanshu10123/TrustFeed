"""
The backend's Supabase client -- used by both the API Service and the
Verification Service (worker) for Postgres access and Storage.

Uses the service-role key (full access, bypasses Row Level Security).
Authorization -- "does this user own this post?" -- is enforced in the
API's own endpoint code for now, not RLS policies. That's a deliberate,
documented scope choice (see the Milestone 4a doc), not an oversight.
"""

from supabase import Client, create_client

from app.core.config import get_supabase_service_key, get_supabase_url

VIDEO_BUCKET = "videos"
AVATAR_BUCKET = "avatars"

_client: Client | None = None


def get_supabase_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(get_supabase_url(), get_supabase_service_key())
    return _client
