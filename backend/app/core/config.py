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


def _int_env(name: str, default: int, minimum: int = 1) -> int:
    """A whole-number setting from the environment: the default when it's
    unset or isn't a number, and never below `minimum`."""
    try:
        return max(minimum, int(os.environ.get(name, default)))
    except ValueError:
        return default


def get_report_hide_threshold() -> int:
    """How many different people have to report a post before it's taken
    out of the feed. 3 unless REPORT_HIDE_THRESHOLD says otherwise -- handy
    to set to 1 for a moment when testing the report flow."""
    return _int_env("REPORT_HIDE_THRESHOLD", 3)


def get_stuck_post_minutes() -> int:
    """How long a post can sit in "processing" before it's treated as lost
    and marked failed. 10 unless STUCK_POST_MINUTES says otherwise --
    generous on purpose, since with one worker a post can legitimately wait
    behind others."""
    return _int_env("STUCK_POST_MINUTES", 10)


def get_max_video_mb() -> int:
    """Largest video accepted, in MB. 50 unless MAX_VIDEO_MB says otherwise
    -- that's what the free Supabase Storage plan allows per file, so raise
    it only along with the bucket's own limit."""
    return _int_env("MAX_VIDEO_MB", 50)


def get_daily_video_limit() -> int:
    """Video uploads one person can make in 24 hours. 5 unless
    DAILY_VIDEO_LIMIT says otherwise."""
    return _int_env("DAILY_VIDEO_LIMIT", 5)


def get_daily_post_limit() -> int:
    """Posts of any kind (text or video) one person can make in 24 hours.
    20 unless DAILY_POST_LIMIT says otherwise."""
    return _int_env("DAILY_POST_LIMIT", 20)


def get_allowed_origins() -> list[str]:
    """Which frontend origin(s) the API accepts browser requests from
    (CORS). Comma-separated in FRONTEND_ORIGIN for a deployed frontend
    (e.g. a Vercel URL); falls back to the local Vite dev origins when
    unset, so local dev keeps working with no .env change."""
    raw = os.environ.get("FRONTEND_ORIGIN")
    if not raw:
        return ["http://localhost:5173", "http://127.0.0.1:5173"]
    return [origin.strip() for origin in raw.split(",") if origin.strip()]
