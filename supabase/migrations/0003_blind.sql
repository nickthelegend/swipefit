-- FITCHECK — blind swiping
--
-- Adds the one column, and the one view, behind the measurement no retailer can
-- obtain for themselves.
--
-- In the app the brand can be switched off before a decision is made. Comparing
-- keep-rate with the label hidden against keep-rate with it shown separates
-- brand pull from garment appeal — two things that arrive inseparable in any
-- ordinary shop, because a shopper can always see whose product they are
-- looking at.
--
-- Safe to run on a database that already has 0001 and 0002 applied. Every
-- statement is idempotent.
--
-- Apply: Supabase dashboard → SQL Editor → paste → Run.

alter table public.swipe_events
  add column if not exists blind boolean not null default false;

create index if not exists swipe_blind_idx on public.swipe_events (blind);

create or replace view public.blind_signal
with (security_invoker = off) as
select
  e.brand,
  count(*) filter (where e.blind)::int                                     as blind_seen,
  count(*) filter (where not e.blind)::int                                 as revealed_seen,
  round(100.0 * count(*) filter (where e.blind and e.direction = 'right')
        / nullif(count(*) filter (where e.blind), 0), 1)                   as blind_keep_rate,
  round(100.0 * count(*) filter (where not e.blind and e.direction = 'right')
        / nullif(count(*) filter (where not e.blind), 0), 1)               as revealed_keep_rate
from public.swipe_events e
group by e.brand;

grant select on public.blind_signal to anon, authenticated;
