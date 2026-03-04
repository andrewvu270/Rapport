-- NetWork Database Schema
-- Initial migration with all tables, indexes, and RLS policies

-- Users table
create table users (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  tier text not null default 'free',
  voice_minutes_used integer not null default 0,
  video_minutes_used integer not null default 0,
  billing_period_start date not null,
  created_at timestamptz not null default now()
);

-- Enable RLS on users
alter table users enable row level security;

-- Users can only read/write their own row
create policy "Users can read own data"
  on users for select
  using (auth.uid() = id);

create policy "Users can update own data"
  on users for update
  using (auth.uid() = id);

create policy "Users can insert own data"
  on users for insert
  with check (auth.uid() = id);

-- Event contexts table
create table contexts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  mode text not null default 'professional_networking',
  event_type text,
  industry text,
  user_role text,
  user_goal text,
  raw_input jsonb not null,
  talking_points_card jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index idx_contexts_user_id on contexts(user_id);
create index idx_contexts_expires_at on contexts(expires_at);

-- Enable RLS on contexts
alter table contexts enable row level security;

create policy "Users can read own contexts"
  on contexts for select
  using (auth.uid() = user_id);

create policy "Users can insert own contexts"
  on contexts for insert
  with check (auth.uid() = user_id);

create policy "Users can update own contexts"
  on contexts for update
  using (auth.uid() = user_id);

create policy "Users can delete own contexts"
  on contexts for delete
  using (auth.uid() = user_id);

-- Person cards table
create table person_cards (
  id uuid primary key default gen_random_uuid(),
  context_id uuid not null references contexts(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  participant_name text not null,
  card_data jsonb not null,
  pinecone_namespace text not null,
  limited_research boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_person_cards_context_id on person_cards(context_id);
create index idx_person_cards_user_id on person_cards(user_id);

-- Enable RLS on person_cards
alter table person_cards enable row level security;

create policy "Users can read own person cards"
  on person_cards for select
  using (auth.uid() = user_id);

create policy "Users can insert own person cards"
  on person_cards for insert
  with check (auth.uid() = user_id);

create policy "Users can update own person cards"
  on person_cards for update
  using (auth.uid() = user_id);

create policy "Users can delete own person cards"
  on person_cards for delete
  using (auth.uid() = user_id);

-- Practice sessions table
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  context_id uuid not null references contexts(id),
  person_card_id uuid references person_cards(id),
  session_type text not null,
  status text not null default 'reserved',
  vapi_call_id text,
  tavus_conversation_id text,
  tavus_persona_id text,
  tavus_persona_status text,
  seconds_reserved integer not null default 0,
  seconds_consumed integer,
  transcript jsonb,
  parent_session_id uuid references sessions(id),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_sessions_user_id on sessions(user_id);
create index idx_sessions_context_id on sessions(context_id);
create index idx_sessions_parent_session_id on sessions(parent_session_id);

-- Enable RLS on sessions
alter table sessions enable row level security;

create policy "Users can read own sessions"
  on sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on sessions for delete
  using (auth.uid() = user_id);

-- Debrief reports table
create table debriefs (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  report_data jsonb not null,
  pending boolean not null default false,
  pending_retry_count integer not null default 0,
  pending_max_retries integer not null default 5,
  created_at timestamptz not null default now()
);

create index idx_debriefs_session_id on debriefs(session_id);
create index idx_debriefs_user_id on debriefs(user_id);
create index idx_debriefs_pending on debriefs(pending) where pending = true;

-- Enable RLS on debriefs
alter table debriefs enable row level security;

create policy "Users can read own debriefs"
  on debriefs for select
  using (auth.uid() = user_id);

create policy "Users can insert own debriefs"
  on debriefs for insert
  with check (auth.uid() = user_id);

create policy "Users can update own debriefs"
  on debriefs for update
  using (auth.uid() = user_id);

create policy "Users can delete own debriefs"
  on debriefs for delete
  using (auth.uid() = user_id);

-- Pinecone deletion queue table
create table pinecone_deletion_queue (
  id uuid primary key default gen_random_uuid(),
  pinecone_namespace text not null,
  user_id uuid,
  status text not null default 'pending',
  retry_count integer not null default 0,
  max_retries integer not null default 5,
  last_error text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index idx_pinecone_deletion_pending on pinecone_deletion_queue(status) where status = 'pending';

-- Enable RLS on pinecone_deletion_queue
alter table pinecone_deletion_queue enable row level security;

-- Only service role can access deletion queue (no user policies)
create policy "Service role can manage deletion queue"
  on pinecone_deletion_queue for all
  using (auth.jwt()->>'role' = 'service_role');
