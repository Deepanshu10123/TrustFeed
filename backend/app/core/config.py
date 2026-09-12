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
