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
