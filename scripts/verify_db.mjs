/**
 * Checks the live database from outside, using only the anon key.
 *
 * That constraint is the point: it verifies what an unprivileged client can
 * actually reach, so it catches a missing GRANT or a view created without
 * `security_invoker = off` — both of which look fine in the SQL editor, where
 * you are the owner, and fail for every real user of the app.
 *
 *   npm run db:verify
 */

import { readFileSync } from 'node:fs';

function env(file, key) {
  try {
    const line = readFileSync(new URL(file, import.meta.url), 'utf8')
      .split('\n')
      .find((l) => l.startsWith(`${key}=`));
    return line?.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') || null;
  } catch {
    return null;
  }
}

const url = env('../.env', 'EXPO_PUBLIC_SUPABASE_URL');
const anon = env('../.env', 'EXPO_PUBLIC_SUPABASE_ANON_KEY');

if (!url || !anon) {
  console.error('No Supabase URL/anon key in .env — nothing to verify.');
  process.exit(1);
}

// The service-role key is deliberately absent here as everywhere else: it
// bypasses row-level security, which is exactly what this script must not do.
const headers = { apikey: anon, Authorization: `Bearer ${anon}` };

async function get(path) {
  try {
    const res = await fetch(`${url}/rest/v1/${path}`, { headers });
    return { status: res.status, body: res.ok ? await res.json() : await res.text() };
  } catch (err) {
    return { status: 0, body: String(err) };
  }
}

const checks = [];
const add = (name, ok, detail) => checks.push({ name, ok, detail });

for (const view of ['sku_signal', 'undertone_signal', 'reach', 'brand_overview', 'blind_signal']) {
  const { status } = await get(`${view}?limit=1`);
  add(
    `view ${view}`,
    status === 200,
    status === 404 ? 'missing — migration not applied' : `HTTP ${status}`,
  );
}

const blind = await get('swipe_events?select=blind&limit=1');
// 200 means the column exists and is readable; 400 is PostgREST rejecting an
// unknown column. A 401/403 would mean the column is there but not selectable,
// which for this table is correct — there is no anon SELECT policy by design.
add(
  'swipe_events.blind column',
  blind.status !== 400,
  blind.status === 400 ? 'missing — 0003 not applied' : `HTTP ${blind.status}`,
);

const brands = await get('brands?select=slug&approved=eq.true');
const count = Array.isArray(brands.body) ? brands.body.length : 0;
add(
  'approved brands',
  count >= 9,
  `${count} of 9 — ${count >= 9 ? 'complete' : '0004 not applied; /brands falls back to the bundled list'}`,
);

const pad = Math.max(...checks.map((c) => c.name.length));
for (const c of checks) {
  console.log(`  ${c.ok ? 'ok  ' : 'FAIL'}  ${c.name.padEnd(pad)}  ${c.detail}`);
}

const failed = checks.filter((c) => !c.ok);
console.log(
  failed.length
    ? `\n${failed.length} of ${checks.length} failed. Run: npm run db:sql | pbcopy — then paste into the Supabase SQL Editor.`
    : `\nAll ${checks.length} checks passed.`,
);
process.exit(failed.length ? 1 : 0);
