"""
Error tracking (Sentry) -- optional.

With no SENTRY_DSN set this does nothing, so local development and CI are
untouched. Once SENTRY_DSN is set on the API and the worker, every error
that isn't handled -- a 500, a verification job that crashed -- is reported
with its stack trace, so you find out from Sentry instead of from a user.
"""

import os
import re

_enabled = False

# "token=..." at the start of a query string, or after a ? or & in a URL --
# but not the end of some other name, like "mytoken=".
_TOKEN_PARAM = re.compile(r"(^|[?&])(token=)[^&#\s]*")


def _redact(text: str) -> str:
    return _TOKEN_PARAM.sub(r"\1\2[removed]", text)


def scrub_event(event: dict, hint: dict | None = None) -> dict:
    """Runs on every event just before it leaves. The live-progress stream has
    to carry the person's sign-in token in its web address (a browser limit,
    see Milestone 7b), so that must never travel to Sentry."""
    request = event.get("request")
    if request:
        for key in ("url", "query_string"):
            value = request.get(key)
            if isinstance(value, str):
                request[key] = _redact(value)
            elif isinstance(value, dict) and "token" in value:
                value["token"] = "[removed]"
            elif isinstance(value, list):
                request[key] = [[k, "[removed]" if k == "token" else v] for k, v in value]
    return event


def init_error_tracking(service: str) -> None:
    """Switches error reporting on if SENTRY_DSN is set. `service` ("api" or
    "worker") shows on each report so you can tell which one it came from."""
    global _enabled
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn or _enabled:
        return
    import sentry_sdk

    try:
        sentry_sdk.init(
            dsn=dsn,
            server_name=service,
            environment=os.environ.get("SENTRY_ENVIRONMENT", "production"),
            before_send=scrub_event,
            send_default_pii=False,  # no cookies, IP addresses or sign-in headers
            max_request_body_size="never",  # people's posts and comments stay out of it
            # By default each line of the stack trace also carries the variables
            # that were in use -- including the raw request, sign-in token and all.
            # The trace and error message are enough to debug; the values aren't worth the risk.
            include_local_variables=False,
            traces_sample_rate=0,  # errors only, no performance tracing
        )
    except Exception as e:
        # A mistyped key should cost you the error alarms, not the whole app.
        # (The key itself is left out of the message on purpose.)
        print(f"Error tracking is OFF: SENTRY_DSN isn't a valid Sentry address ({type(e).__name__}). Carrying on without it.")
        return
    _enabled = True


def report_error(error: BaseException) -> None:
    """For an error that was caught and handled but is still worth knowing
    about -- like a verification job that failed."""
    if not _enabled:
        return
    import sentry_sdk

    sentry_sdk.capture_exception(error)
