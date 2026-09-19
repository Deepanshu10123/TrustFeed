"""
Loads settings from the .env file and fails fast with a clear message if
something required is missing — same pattern as the phase1-agent /
phase3-multiagent scripts in the learning roadmap this project builds on.
"""

import os
import sys

from dotenv import load_dotenv

load_dotenv()


def _require(name: str, signup_hint: str) -> str:
    value = os.environ.get(name)
    if not value:
        sys.exit(f"Missing {name}.\n{signup_hint}\nThen copy .env.example to .env and paste it in.")
    return value


def get_gemini_api_key() -> str:
    return _require("GEMINI_API_KEY", "Get a free key at https://aistudio.google.com/apikey")


def get_tavily_api_key() -> str:
    return _require("TAVILY_API_KEY", "Get a free key at https://app.tavily.com")


def get_redis_url() -> str:
    return _require("REDIS_URL", "Create a free Redis database at https://upstash.com and copy its Redis URL")


def get_supabase_url() -> str:
    return _require("SUPABASE_URL", "Create a free project at https://supabase.com")


def get_supabase_anon_key() -> str:
    return _require("SUPABASE_ANON_KEY", "Create a free project at https://supabase.com")


def get_supabase_service_key() -> str:
    return _require("SUPABASE_SERVICE_ROLE_KEY", "Create a free project at https://supabase.com")


def get_report_hide_threshold() -> int:
    """How many different people have to report a post before it's taken
    out of the feed. 3 unless REPORT_HIDE_THRESHOLD says otherwise -- handy
    to set to 1 for a moment when testing the report flow."""
    try:
        return max(1, int(os.environ.get("REPORT_HIDE_THRESHOLD", "3")))
    except ValueError:
        return 3


def get_allowed_origins() -> list[str]:
    """Which frontend origin(s) the API accepts browser requests from
    (CORS). Comma-separated in FRONTEND_ORIGIN for a deployed frontend
    (e.g. a Vercel URL); falls back to the local Vite dev origins when
    unset, so local dev keeps working with no .env change."""
    raw = os.environ.get("FRONTEND_ORIGIN")
    if not raw:
        return ["http://localhost:5173", "http://127.0.0.1:5173"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]
