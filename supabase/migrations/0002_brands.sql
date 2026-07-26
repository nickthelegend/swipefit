-- FITCHECK — brand partners
--
-- A brand signs up, claims a catalogue slug, and gets a console scoped to its
-- own SKUs. The telemetry tables from 0001 already hold the measurements; this
-- adds ownership and the per-brand views that make them readable by a partner
-- without exposing anybody else's numbers.
--
-- Apply after 0001: Supabase dashboard → SQL Editor → paste → Run.

-- ---------------------------------------------------------------------------
-- Brands
-- ---------------------------------------------------------------------------

create table if not exists public.brands (
  id          uuid primary key default gen_random_uuid(),
  -- Matches the `brand` string written by the app's telemetry, so a partner's
  -- console can be joined to real swipe data without a mapping table.
  name        text not null unique,
  slug        text not null unique,
  accent      text not null default 'violet'
                check (accent in ('violet', 'tomato', 'acid', 'forest')),
  blurb       text,
  website     text,
  -- Null until a human approves the claim. An unapproved brand can sign in and
  -- see its own console but is not listed publicly.
  approved    boolean not null default false,
  owner_id    uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists brands_owner_idx on public.brands (owner_id);

alter table public.brands enable row level security;

-- Anyone may read the approved directory. That is the public /brands page.
drop policy if exists brands_public_read on public.brands;
create policy brands_public_read on public.brands
  for select to anon, authenticated using (approved = true);

-- A signed-in owner may always read their own row, approved or not.
drop policy if exists brands_owner_read on public.brands;
create policy brands_owner_read on public.brands
  for select to authenticated using (owner_id = auth.uid());

-- Claiming: a signed-in user may create a brand they own. `approved` cannot be
-- self-granted — the check pins it false regardless of what the client sends.
drop policy if exists brands_owner_insert on public.brands;
create policy brands_owner_insert on public.brands
  for insert to authenticated
  with check (owner_id = auth.uid() and approved = false);

drop policy if exists brands_owner_update on public.brands;
create policy brands_owner_update on public.brands
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Seed the catalogue's existing brands
--
-- These three are already in the app's catalogue and already generating
-- telemetry, so the directory is populated from the start rather than empty.
-- ---------------------------------------------------------------------------

insert into public.brands (name, slug, accent, blurb, website, approved)
values
  ('COS', 'cos', 'violet',
   'Modern, functional, considered design. Eight pieces in the FITCHECK catalogue.',
   'https://www.cos.com', true),
  ('Uniqlo', 'uniqlo', 'tomato',
   'LifeWear — everyday essentials engineered for fit. Eight pieces in the FITCHECK catalogue.',
   'https://www.uniqlo.com', true),
  ('Levi''s', 'levis', 'forest',
   'The original denim house. Eight pieces in the FITCHECK catalogue.',
   'https://www.levi.com', true)
on conflict (name) do nothing;

-- ---------------------------------------------------------------------------
-- Per-brand aggregates
--
-- `security_invoker = off` so the views run with the definer's rights and can
-- read the base tables the anon role deliberately cannot. The views expose only
-- aggregates, never an individual session.
-- ---------------------------------------------------------------------------

create or replace view public.brand_overview
with (security_invoker = off) as
select
  b.name  as brand,
  b.slug,
  b.accent,
  count(e.id)::int                                                             as decisions,
  count(e.id) filter (where e.direction = 'right')::int                         as kept,
  round(100.0 * count(e.id) filter (where e.direction = 'right')
        / nullif(count(e.id), 0), 1)                                           as keep_rate,
  coalesce(percentile_cont(0.5) within group (order by e.dwell_ms), 0)::int     as median_dwell_ms,
  round(100.0 * count(e.id) filter (where e.inspected)
        / nullif(count(e.id), 0), 1)                                           as inspect_rate,
  round(100.0 * count(e.id) filter (where e.hesitated or e.confirmed)
        / nullif(count(e.id), 0), 1)                                           as hesitation_rate,
  round(100.0 * count(e.id) filter (where e.undone)
        / nullif(count(e.id), 0), 1)                                           as undo_rate,
  (select count(*) from public.handoffs h where h.brand = b.name)::int          as handoffs
from public.brands b
left join public.swipe_events e on e.brand = b.name
group by b.name, b.slug, b.accent;

grant select on public.brand_overview to anon, authenticated;
