"""Keeping an open feed up to date (GET /feed/updates, comment counts on posts).

The app asks this small endpoint "what changed?" every so often instead of reloading the
whole feed, so what matters is that it answers the right questions: likes and comments of
exactly the posts it lists, and how many NEW published posts fit the same feed (your
interests, or the people you follow). A tiny fake database stands in for Supabase."""

import asyncio
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.api import main

ME = "user-1"
P1, P2, P3 = ("00000000-0000-4000-8000-00000000000%d" % n for n in (1, 2, 3))


class FakeResult:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class FakeQuery:
    """Just enough of the Supabase query builder: it remembers the filters and applies them."""

    def __init__(self, rows):
        self.rows = rows
        self.filters = []
        self.counting = False

    def select(self, *columns, count=None, head=False):
        self.counting = bool(count and head)
        return self

    def eq(self, column, value):
        self.filters.append(lambda r: r.get(column) == value)
        return self

    def gt(self, column, value):
        self.filters.append(lambda r: r.get(column) > value)
        return self

    def in_(self, column, values):
        self.filters.append(lambda r: r.get(column) in values)
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, n):
        return self

    def execute(self):
        rows = [r for r in self.rows if all(f(r) for f in self.filters)]
        return FakeResult([] if self.counting else rows, count=len(rows))


class FakeSupabase:
    def __init__(self, tables, likes=None):
        self.tables = tables
        self.likes = likes or []
        self.broken = set()

    def table(self, name):
        if name in self.broken:
            raise RuntimeError(f"{name} is down")
        return FakeQuery(self.tables.get(name, []))

    def rpc(self, name, params):
        assert name == "like_info"
        rows = [row for row in self.likes if row["post_id"] in params["post_ids"]]
        return FakeQuery(rows)


def post(id, created_at, topic="space", status="published", user="author-1"):
    return {"id": id, "created_at": created_at, "declared_topic": topic, "status": status, "user_id": user, "kind": "text", "content": "x"}


@pytest.fixture
def db(monkeypatch):
    fake = FakeSupabase(
        tables={
            "posts": [
                post(P1, "2026-09-20T10:00:00+00:00"),  # the newest post the app has
                post("00000000-0000-4000-8000-0000000000a1", "2026-09-20T10:05:00+00:00"),  # new, space
                post("00000000-0000-4000-8000-0000000000a2", "2026-09-20T10:06:00+00:00", topic="sports"),  # new, sports
                post("00000000-0000-4000-8000-0000000000a3", "2026-09-20T10:07:00+00:00", status="processing"),  # not published yet
                post("00000000-0000-4000-8000-0000000000a4", "2026-09-20T10:08:00+00:00", user="friend-1"),  # new, by someone I follow
                post("00000000-0000-4000-8000-0000000000a5", "2026-09-19T09:00:00+00:00"),  # older than what the app has
            ],
            "comments": [{"post_id": P1}, {"post_id": P1}, {"post_id": P2}],
            "follows": [{"follower_id": ME, "followee_id": "friend-1"}],
        },
        likes=[
            {"post_id": P1, "like_count": 7, "liked_by_me": True},
            {"post_id": P2, "like_count": 1, "liked_by_me": False},
        ],
    )
    monkeypatch.setattr(main, "get_supabase_client", lambda: fake)
    monkeypatch.setattr(main, "_topics_for", lambda user_id: [])  # no interests picked = everything
    return fake


@pytest.fixture
def client():
    main.app.dependency_overrides[main.get_current_user] = lambda: SimpleNamespace(id=ME)
    yield TestClient(main.app)
    main.app.dependency_overrides.clear()


SINCE = "2026-09-20T10:00:00+00:00"


def get_updates(client, **params):
    return client.get("/feed/updates", params=params)


# ---------------------------------------------------------------- the pieces
def test_the_route_is_found_before_the_single_post_route():
    # Otherwise "updates" would be read as a post id (and rejected as not one).
    paths = [route.path for route in main.app.routes]
    assert paths.index("/feed/updates") < paths.index("/feed/{post_id}")


def test_ids_are_read_normalised_and_capped():
    assert main._parse_post_ids(f"{P1}, {P2} ,") == [P1, P2]
    assert main._parse_post_ids(P1.upper()) == [P1]  # the database prints them lower-case
    assert main._parse_post_ids("") == []
    many = ",".join(f"00000000-0000-4000-8000-{n:012d}" for n in range(main.MAX_UPDATE_IDS + 25))
    assert len(main._parse_post_ids(many)) == main.MAX_UPDATE_IDS


def test_something_that_is_not_a_post_id_is_refused():
    with pytest.raises(HTTPException) as e:
        main._parse_post_ids(f"{P1},not-an-id")
    assert e.value.status_code == 400


def test_comments_are_counted_per_post(db):
    assert main._comment_counts([P1, P2, P3]) == {P1: 2, P2: 1}  # P3 has none, so no entry
    assert main._comment_counts([]) == {}


# ---------------------------------------------------------------- the endpoint
def test_it_reports_likes_and_comments_for_exactly_the_posts_asked_about(db, client):
    body = get_updates(client, ids=f"{P1},{P2},{P3}", since=SINCE).json()
    assert body["posts"] == {
        P1: {"like_count": 7, "liked_by_me": True, "comment_count": 2},
        P2: {"like_count": 1, "liked_by_me": False, "comment_count": 1},
        P3: {"like_count": 0, "liked_by_me": False, "comment_count": 0},  # nobody has touched it
    }


def test_it_counts_only_published_posts_newer_than_the_newest_the_app_has(db, client):
    # a1 (space), a2 (sports) and a4 (friend's) are new and published; a3 is still being
    # checked, and a5 and the post at `since` itself are not newer.
    assert get_updates(client, ids=P1, since=SINCE).json()["new_count"] == 3


def test_new_posts_follow_your_interests(db, client, monkeypatch):
    monkeypatch.setattr(main, "_topics_for", lambda user_id: ["space"])
    assert get_updates(client, ids=P1, since=SINCE).json()["new_count"] == 2  # the sports post doesn't count


def test_the_following_feed_counts_only_people_you_follow(db, client):
    assert get_updates(client, ids=P1, since=SINCE, following="true").json()["new_count"] == 1


def test_following_nobody_means_nothing_new(db, client):
    db.tables["follows"] = []
    assert get_updates(client, ids=P1, since=SINCE, following="true").json()["new_count"] == 0


def test_without_a_since_there_is_nothing_to_compare_and_no_new_count(db, client):
    body = get_updates(client, ids=P1).json()
    assert body["new_count"] == 0
    assert body["posts"][P1]["like_count"] == 7


def test_an_empty_feed_is_answered_too(db, client):
    assert get_updates(client).json() == {"posts": {}, "new_count": 0}


def test_bad_input_is_refused_not_crashed_on(db, client):
    assert get_updates(client, ids="nope").status_code == 400
    assert get_updates(client, ids=P1, since="yesterday").status_code == 400


def test_one_part_failing_does_not_take_the_rest_down(db, client):
    db.broken.add("posts")  # the new-post count can't be read...
    body = get_updates(client, ids=P1, since=SINCE).json()
    assert body["new_count"] == 0  # ...so it says 0...
    assert body["posts"][P1]["like_count"] == 7  # ...but likes and comments still arrive


# ---------------------------------------------------------------- comment counts ride along with the feed
def test_posts_in_the_feed_carry_their_comment_count(db):
    posts = [post(P1, "2026-09-20T10:00:00+00:00"), post(P3, "2026-09-20T09:00:00+00:00")]
    asyncio.run(main._decorate_posts(posts, ME))
    assert [p["comment_count"] for p in posts] == [2, 0]
    assert posts[0]["like_count"] == 7
