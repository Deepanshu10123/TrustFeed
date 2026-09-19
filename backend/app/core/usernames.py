"""
The rules for a chosen username. A plain function (no database) so it can be
tested directly; the database repeats the format check and enforces that no
two people share one (see schema.sql).
"""

import re

USERNAME_PATTERN = re.compile(r"^[a-z0-9_]{3,20}$")

# Names that would let someone pass themselves off as the app or its staff.
RESERVED = {"admin", "administrator", "trustfeed", "support", "help", "moderator", "mod", "staff", "official", "system", "root"}


def check_username(raw: str) -> tuple[str, str | None]:
    """Tidies a username (trimmed, lower case, a leading @ dropped -- people
    type it) and says what's wrong with it, if anything. Returns
    (username, error); error is None when the name is fine."""
    name = raw.strip().lower().removeprefix("@")
    if not USERNAME_PATTERN.match(name):
        return name, "Usernames are 3 to 20 letters, numbers or underscores."
    if name in RESERVED:
        return name, "That username isn't available."
    return name, None
