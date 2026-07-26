/**
 * Prints every migration as one paste-able script, followed by a verification
 * query.
 *
 * There is no automated path for this. Supabase exposes no arbitrary-SQL REST
 * endpoint, the service-role key cannot run DDL over PostgREST, and applying it
 * with `supabase db push` or psql needs the database password, which is not in
 * this repo and should not be. So the schema is applied by hand, once.
 *
 * The output is generated rather than checked in as a second copy of the SQL,
 * because a duplicate drifts the moment one of the migrations is edited.
 *
 * Every migration is idempotent — `create table if not exists`,
 * `create or replace view`, `add column if not exists`, and every policy is
 * dropped before being created — so this is safe to run against a fresh
 * database or one that already has some of it.
 *
 *   npm run db:sql | pbcopy     # then paste into SQL Editor and Run
 *   npm run db:verify           # confirm it took, from outside
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not URL.pathname: this repo lives under "Extreme SSD" and
// pathname leaves the space percent-encoded, so readdir looks for a directory
// with a literal "%20" in it and fails.
const DIR = fileURLToPath(new URL('../supabase/migrations/', import.meta.url));

const files = readdirSync(DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const parts = files.map((f) => {
  const body = readFileSync(join(DIR, f), 'utf8').trimEnd();
  return `-- ${'='.repeat(72)}\n-- ${f}\n-- ${'='.repeat(72)}\n\n${body}`;
});

// Ends on a readable result set rather than "Success. No rows returned", which
// gives no indication of whether the interesting parts actually landed.
const verify = `-- ${'='.repeat(72)}
-- Verification — this should return one row reading true / true / 9
-- ${'='.repeat(72)}

select
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'swipe_events' and column_name = 'blind'
  )                                                              as blind_column,
  exists (
    select 1 from information_schema.views
    where table_schema = 'public' and table_name = 'blind_signal'
  )                                                              as blind_signal_view,
  (select count(*) from public.brands where approved)::int        as approved_brands;`;

process.stdout.write([...parts, verify].join('\n\n\n') + '\n');
