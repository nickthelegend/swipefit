/**
 * Runs one demo model's face photo through the exact live path the app uses:
 * request an upload slot, PUT to the presigned URL, create the task, poll it.
 *
 * Exists because the app fell back to its recorded reading on device and blamed
 * exhausted credits, while the same key answered a direct call perfectly well.
 * That left the real cause unknown, and "unknown" is not something to discover
 * during a take.
 *
 *   node scripts/probe_scan.mjs assets/demo-models/model-c-face.jpg
 */

import { readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';

const file = process.argv[2] ?? 'assets/demo-models/model-c-face.jpg';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const get = (k) => env.split('\n').find((l) => l.startsWith(`${k}=`))?.slice(k.length + 1).trim();
const KEY = get('EXPO_PUBLIC_YOUCAM_API_KEY');
const BASE = get('EXPO_PUBLIC_YOUCAM_BASE_URL');

const auth = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const step = (n, msg) => console.log(`  ${n}. ${msg}`);

const bytes = readFileSync(file);
const size = statSync(file).size;
step(1, `${basename(file)} — ${(size / 1024).toFixed(0)} KB`);

// --- upload slot ----------------------------------------------------------
const slotRes = await fetch(`${BASE}/s2s/v2.0/file/skin-tone-analysis`, {
  method: 'POST',
  headers: auth,
  body: JSON.stringify({
    files: [{ content_type: 'image/jpeg', file_name: basename(file), file_size: size }],
  }),
});
const slot = await slotRes.json();
if (!slotRes.ok || !slot?.data?.files?.[0]) {
  console.error('  FAILED at upload slot:', JSON.stringify(slot).slice(0, 300));
  process.exit(1);
}
const entry = slot.data.files[0];
const put = entry.requests[0];
step(2, `slot granted, file_id ${entry.file_id.slice(0, 24)}…`);

// --- presigned PUT --------------------------------------------------------
const putRes = await fetch(put.url, { method: put.method, headers: put.headers, body: bytes });
if (!putRes.ok) {
  console.error(`  FAILED at PUT: HTTP ${putRes.status}`, (await putRes.text()).slice(0, 200));
  process.exit(1);
}
step(3, `uploaded, HTTP ${putRes.status}`);

// --- task, at both strictness levels the app tries -------------------------
for (const strictness of ['medium', 'flexible']) {
  const taskRes = await fetch(`${BASE}/s2s/v2.0/task/skin-tone-analysis`, {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ src_file_id: entry.file_id, face_angle_strictness_level: strictness }),
  });
  const task = await taskRes.json();
  if (!taskRes.ok || !task?.data?.task_id) {
    console.error(`  FAILED creating task (${strictness}):`, JSON.stringify(task).slice(0, 300));
    continue;
  }
  step(4, `task created at strictness=${strictness}`);

  for (let i = 0; i < 10; i += 1) {
    await new Promise((r) => setTimeout(r, 2500));
    const pollRes = await fetch(
      `${BASE}/s2s/v2.0/task/skin-tone-analysis/${encodeURIComponent(task.data.task_id)}`,
      { headers: auth },
    );
    const poll = await pollRes.json();
    const d = poll?.data;

    if (d?.error) {
      console.error(`  TASK ERROR (${strictness}):`, JSON.stringify(d.error).slice(0, 300));
      break;
    }
    if (d?.results?.color) {
      console.log(`\n  SUCCESS at strictness=${strictness}`);
      console.log('  skin  ', d.results.color.skin_color);
      console.log('  hair  ', d.results.color.hair_color, `(${d.results.color.hair_color_name})`);
      console.log('  eye   ', d.results.color.eye_color, `(${d.results.color.eye_color_name})`);
      console.log('  quality', JSON.stringify(d.results.face_quality));
      process.exit(0);
    }
    if (d?.status && d.status !== 'running' && d.status !== 'success') {
      console.error(`  TASK STATUS (${strictness}): ${d.status}`, JSON.stringify(d).slice(0, 240));
      break;
    }
  }
}

console.error('\n  No successful reading at either strictness level.');
process.exit(1);
