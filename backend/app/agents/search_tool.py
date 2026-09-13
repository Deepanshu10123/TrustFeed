"""
The one tool the Critic can call: search the public web for evidence.

Backed by Tavily (https://tavily.com), a search API built for AI agents --
it returns a handful of clean text snippets instead of raw HTML you'd have
to scrape and parse yourself.

Milestone 8a: results are cached in Redis (already integrated for the job
queue) by query, since popular claims get searched repeatedly across
different users/posts. Caching fails open -- if Redis is unreachable for
any reason, the cache is skipped silently and the real search still
runs. A cache being down should never be the reason a search fails.
"""

import json

import redis
from google.genai import types
from tavily import TavilyClient

from app.agents.models import Source
from app.core.config import get_redis_url, get_tavily_api_key
from app.core.retry import with_retries

CACHE_TTL_S = 60 * 60 * 24  # 24h -- factual search results don't go stale quickly

# Created lazily (on first real use, not on import) so importing this
# module never fails just because a key is missing -- only actually
# searching does.
_client: TavilyClient | None = None
_redis: redis.Redis | None = None


def _get_client() -> TavilyClient:
    global _client
    if _client is None:
        _client = TavilyClient(api_key=get_tavily_api_key())
    return _client


def _get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        # Without socket_timeout, a stale/dropped cloud Redis connection
        # (a real, observed failure mode -- see Milestone 3's queue.py fix
        # for the same class of bug) hangs this call forever instead of
        # raising, which the try/except around every call site can't catch
        # -- and since this runs inside the Critic's research loop, a
        # single hang here freezes that claim (and every job behind it,
        # since one worker processes jobs one at a time) indefinitely.
        _redis = redis.from_url(get_redis_url(), decode_responses=True, socket_timeout=5)
    return _redis


def _cache_key(query: str) -> str:
    return f"search_cache:{query.strip().lower()}"


# This is how the model learns the tool exists and how to call it -- same
# idea as phase1-agent's TOOL_DECLARATIONS, one tool instead of two.
SEARCH_WEB_DECLARATION = types.FunctionDeclaration(
    name="search_web",
    description=(
        "Search the public web for evidence about a specific, narrow "
        "question or claim. Returns a handful of results, each with a "
        "title, URL, and a short text snippet."
    ),
    parameters={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": (
                    "A focused search query -- e.g. "
                    "'does vitamin D prevent COVID infection studies', "
                    "not the entire original sentence."
                ),
            }
        },
        "required": ["query"],
    },
)


def search_web(query: str, max_results: int = 5) -> list[Source]:
    try:
        cached = _get_redis().get(_cache_key(query))
        if cached is not None:
            print(f"[search cache] hit for {query!r} -- skipped a real Tavily call", flush=True)
            return [Source.model_validate(item) for item in json.loads(cached)]
    except Exception:
        pass  # caching is an optimization, never a reason to fail the search

    try:
        response = with_retries(lambda: _get_client().search(query=query, max_results=max_results), label="Tavily.search")
    except Exception as e:
        # A failed search (even after retries) shouldn't crash the whole
        # verification run -- the Critic will just see "no evidence found"
        # and can say so.
        return [Source(title="search error", url="", snippet=f"search failed: {e}")]

    results = [
        Source(
            title=result.get("title", ""),
            url=result.get("url", ""),
            snippet=result.get("content", ""),
        )
        for result in response.get("results", [])
    ]

    try:
        _get_redis().setex(_cache_key(query), CACHE_TTL_S, json.dumps([r.model_dump() for r in results]))
    except Exception:
        pass  # same -- a caching failure shouldn't affect the result just returned

    return results
