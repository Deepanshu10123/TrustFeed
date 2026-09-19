-- Run this in Supabase's SQL editor (Milestone 4a). Checked into the repo
-- as a reference even though it's applied manually for now -- a real
-- migration tool is a fine later improvement, not needed yet.

create table posts (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  kind text not null check (kind in ('text', 'video')),
  content text not null,           -- raw text, or a Supabase Storage path
  declared_topic text,             -- required at the API layer from Milestone 4b onward
  status text not null default 'processing',  -- processing | published | rejected | failed
  report jsonb,                    -- the Report (+ VideoUnderstanding for video) once processed
  created_at timestamptz not null default now()
);

-- Milestone 4b: the publish/reject gate
alter table posts add column relevance_score integer;
alter table posts add column rejection_reason text;

-- Milestone 6: interest-based filtering
create table user_preferences (
  user_id uuid primary key references auth.users(id),
  topics text[] not null default '{}'
);

-- Profile pictures: a public Storage bucket named "avatars" also needs to
-- be created by hand in the Supabase dashboard (Storage -> New bucket ->
-- check "Public bucket"), same manual step as the "videos" bucket at
-- Milestone 4a.
alter table user_preferences add column avatar_url text;

-- Comments on a post. No moderation/filtering at this layer -- same
-- documented gap as post content itself (see ADR 0002's Consequences):
-- a real launch would need a moderation policy here too.
create table comments (
  id uuid primary key,
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  text text not null,
  created_at timestamptz not null default now()
);

-- Likes: one row per (post, user). The composite primary key is what stops
-- the same person liking the same post twice, so the count is always
-- "how many different people".
create table likes (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

-- Like count + "did this user like it" for a whole batch of posts in one
-- round trip (called by the API's GET /feed and the like/unlike endpoints).
create or replace function like_info(post_ids uuid[], me uuid)
returns table (post_id uuid, like_count bigint, liked_by_me boolean)
language sql stable
as $$
  select p.id, count(l.user_id), coalesce(bool_or(l.user_id = me), false)
  from unnest(post_ids) as p(id)
  left join likes l on l.post_id = p.id
  group by p.id
$$;

-- Lock these tables down: the frontend only ever uses Supabase for login,
-- and every read/write goes through this project's API (service-role key,
-- which bypasses RLS). With RLS on and no policies, the public anon key that
-- ships in the frontend can't read or write them directly. Safe to run on
-- tables that already have it enabled.
alter table likes enable row level security;
alter table comments enable row level security;
alter table user_preferences enable row level security;

-- Reports: one row per (post, reporter). The composite primary key means one
-- person can only report a post once, so hiding a post takes several
-- different people (the API hides a published post once
-- REPORT_HIDE_THRESHOLD, default 3, of them have reported it -- it sets the
-- post's status to 'hidden', which keeps it out of the feed).
create table reports (
  post_id uuid not null references posts(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  reason text not null,   -- misleading | hateful | dangerous | spam | other
  note text,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table reports enable row level security;

-- Handy when you want to review reports by hand (not part of the migration):
--
--   most-reported posts first:
--     select p.id, p.status, p.declared_topic, left(p.content, 60) as content, count(*) as reports
--     from reports r join posts p on p.id = r.post_id
--     group by p.id order by reports desc;
--
--   what people said about one post:
--     select reason, note, created_at from reports where post_id = '<post id>';
--
--   put a hidden post back (delete its reports too, or one more report hides it again):
--     update posts set status = 'published' where id = '<post id>';
--     delete from reports where post_id = '<post id>';

-- When a post was last put in the queue: set on upload (the default) and
-- again by every "Try again". A post still 'processing' STUCK_POST_MINUTES
-- (default 10) after this is one whose job got lost -- the worker crashed
-- or restarted mid-check -- so the API marks it failed and lets its owner
-- retry it. Existing rows get the moment this runs, which is fine.
alter table posts add column queued_at timestamptz not null default now();

-- Usernames: what people see on posts and comments instead of an anonymous
-- id. Lower case only, so "Deep" and "deep" can't be two different people,
-- and unique so no two people share one. Everyone starts without one (the
-- app falls back to the anonymous id) until they choose it in My Posts.
alter table user_preferences
  add column username text unique
  check (username ~ '^[a-z0-9_]{3,20}$');

-- Follows: one row per (follower, person followed). The composite primary key
-- means following someone twice is the same as once, and the check stops
-- anyone following themselves. The index makes "who follows this person" (a
-- follower count) as quick as "who does this person follow".
create table follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
create index follows_followee_idx on follows (followee_id);
alter table follows enable row level security;
