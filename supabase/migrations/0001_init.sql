-- FITCHECK — telemetry schema
--
-- Purpose: the brand console's whole claim is that its numbers are measured.
-- On-device that is true but tiny — one person, one session. This schema makes
-- the same measurements aggregate across every session and device, which is
-- what turns "here is what I did" into "here is what shoppers do".
--
-- Privacy posture, deliberate:
--   * No account, no email, no name. A session is keyed by a random device id
--     generated on first launch and stored locally.
--   * Photographs are NEVER uploaded here. They go to the render API and to the
--     device cache, nowhere else.
--   * The skin reading is stored as L* (lightness) and the derived undertone
--     bucket only — not the measured hex. That is enough to segment a cohort
--     and not enough to reconstruct a face.
--
-- Apply: Supabase dashboard → SQL Editor → paste → Run.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Sessions
-- ---------------------------------------------------------------------------

create table if not exists public.sessions (
  id             uuid primary key default gen_random_uuid(),
  device_id      text not null,
  undertone      text check (undertone in ('warm', 'cool', 'neutral')),
  depth          text check (depth in ('light', 'medium', 'deep')),
  season         text,
  -- CIELAB lightness of the measured skin colour. Kept instead of the hex so a
  -- cohort can be segmented by tone without storing anything face-identifying.
  skin_l         numeric,
  reading_source text check (reading_source in ('live', 'recorded')),
  created_at     timestamptz not null default now()
);

create index if not exists sessions_device_idx on public.sessions (device_id);
create index if not exists sessions_created_idx on public.sessions (created_at desc);

-- ---------------------------------------------------------------------------
-- Swipe events — one row per decision
-- ---------------------------------------------------------------------------

create table if not exists public.swipe_events (
  id           bigserial primary key,
  session_id   uuid not null references public.sessions (id) on delete cascade,
  product_id   text not null,
  brand        text not null,
  direction    text not null check (direction in ('left', 'right')),
  match_score  int,
  -- The behavioural signals. These are the reason this table exists: they are
  -- observable only inside the gesture, and they are where returns begin.
  dwell_ms     int  not null default 0 check (dwell_ms >= 0),
  inspected    bool not null default false,
  hesitated    bool not null default false,
  confirmed    bool not null default false,
  undone       bool not null default false,
  created_at   timestamptz not null default now(),
  -- A client retry must not double-count a decision.
  client_key   text not null,
  unique (session_id, client_key)
);

create index if not exists swipe_product_idx on public.swipe_events (product_id);
create index if not exists swipe_brand_idx on public.swipe_events (brand);

-- ---------------------------------------------------------------------------
-- Handoffs — the conversion event this product actually owns
-- ---------------------------------------------------------------------------

create table if not exists public.handoffs (
  id         bigserial primary key,
  session_id uuid not null references public.sessions (id) on delete cascade,
  product_id text not null,
  brand      text not null,
  created_at timestamptz not null default now(),
  client_key text not null,
  unique (session_id, client_key)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- The app ships the publishable (anon) key, so anon may INSERT its own
-- telemetry and may read ONLY the aggregate views below — never raw rows of
-- other sessions.
-- ---------------------------------------------------------------------------

alter table public.sessions     enable row level security;
alter table public.swipe_events enable row level security;
alter table public.handoffs     enable row level security;

drop policy if exists sessions_insert on public.sessions;
create policy sessions_insert on public.sessions
  for insert to anon, authenticated with check (true);

drop policy if exists swipe_insert on public.swipe_events;
create policy swipe_insert on public.swipe_events
  for insert to anon, authenticated with check (true);

drop policy if exists handoff_insert on public.handoffs;
create policy handoff_insert on public.handoffs
  for insert to anon, authenticated with check (true);

-- Deliberately no SELECT policy on the base tables. Reads go through the
-- aggregate views, which cannot leak an individual session's behaviour.

-- ---------------------------------------------------------------------------
-- Aggregates
-- ---------------------------------------------------------------------------

create or replace view public.sku_signal
with (security_invoker = off) as
select
  e.product_id,
  e.brand,
  count(*)::int                                                       as impressions,
  count(*) filter (where e.direction = 'right')::int                  as rights,
  round(100.0 * count(*) filter (where e.direction = 'right') / nullif(count(*), 0), 1) as right_rate,
  coalesce(percentile_cont(0.5) within group (order by e.dwell_ms), 0)::int            as median_dwell_ms,
  round(100.0 * count(*) filter (where e.inspected) / nullif(count(*), 0), 1)          as inspect_rate,
  round(100.0 * count(*) filter (where e.hesitated or e.confirmed) / nullif(count(*), 0), 1) as hesitation_rate,
  round(100.0 * count(*) filter (where e.undone) / nullif(count(*), 0), 1)             as undo_rate
from public.swipe_events e
group by e.product_id, e.brand;

-- Colour rejection across every session: the measurement ordinary retail
-- analytics cannot produce, because shoppers who reject a colourway never
-- click anything. Segmented by the undertone of the person doing the rejecting.
create or replace view public.undertone_signal
with (security_invoker = off) as
select
  s.undertone,
  e.product_id,
  e.brand,
  count(*)::int as impressions,
  round(100.0 * count(*) filter (where e.direction = 'right') / nullif(count(*), 0), 1) as right_rate
from public.swipe_events e
join public.sessions s on s.id = e.session_id
where s.undertone is not null
group by s.undertone, e.product_id, e.brand;

create or replace view public.reach
with (security_invoker = off) as
select
  (select count(*) from public.sessions)                          as sessions,
  (select count(distinct device_id) from public.sessions)         as devices,
  (select count(*) from public.swipe_events)                      as decisions,
  (select count(*) from public.handoffs)                          as handoffs;

grant select on public.sku_signal       to anon, authenticated;
grant select on public.undertone_signal to anon, authenticated;
grant select on public.reach            to anon, authenticated;
