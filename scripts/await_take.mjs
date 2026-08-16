/**
 * Runs the demo take, and keeps retrying until the API grant is topped up.
 *
 * The single continuous take needs 60 units and the grant is empty, which is the
 * one thing in this pipeline that cannot be fixed from here. This makes the wait
 * unattended: top up whenever, walk away, and the finished take is on disk.
 *
 * Retrying is free. YouCam bills units on task SUCCESS only, so a run that dies
 * at the skin scan with CreditInsufficiency costs nothing — the take is its own
 * probe, and there is no cheaper credit check to poll with. A well-formed
 * request is the only thing that reaches the credit check at all; a deliberately
 * malformed one is rejected on validation first and tells you nothing.
 *
 *   node scripts/await_take.mjs [--every 10] [--for 480]
 */

import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : Number(process.argv[i + 1]);
};

const everyMinutes = arg('every', 10);
const forMinutes = arg('for', 480);
const deadline = Date.now() + forMinutes * 60_000;

const stamp = () => new Date().toISOString().slice(11, 19);
const log = (m) => console.log(`  [${stamp()}] ${m}`);

function runTake(attempt) {
  return new Promise((resolve) => {
    const runId = `auto${String(attempt).padStart(2, '0')}`;
    const child = spawn('npm', ['run', 'demo:drive', '--silent'], {
      cwd: root,
      env: { ...process.env, DEMO_RUN_ID: runId },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let out = '';
    child.stdout.on('data', (d) => {
      out += d;
      // Surface the marks live so a watched run is legible.
      for (const l of String(d).split('\n')) if (l.startsWith('DEMO_LINE')) console.log(`    ${l}`);
    });
    child.stderr.on('data', (d) => { out += d; });

    child.on('exit', (code) => resolve({ code, out, runId }));
  });
}

log(`waiting for credits — retrying every ${everyMinutes} min for up to ${forMinutes} min`);
log('a failed run costs 0 units, because units bill on success only');

for (let attempt = 1; Date.now() < deadline; attempt += 1) {
  log(`attempt ${attempt}`);
  const { code, out, runId } = await runTake(attempt);

  const beats = (out.match(/DEMO_LINE/g) ?? []).length;
  const marksPath = `${root}demo/take-${runId}/marks.json`;

  if (code === 0 && beats >= 20) {
    log(`COMPLETE — ${beats} beats in one continuous take`);
    log(`  video  demo/take-${runId}/raw-take.mp4`);
    log(`  marks  demo/take-${runId}/marks.log`);
    process.exit(0);
  }

  if (/CreditInsufficiency|enough credits|out of credits|RECORDED READING/i.test(out)) {
    log(`still no credits (${beats} beats reached) — nothing was spent`);
  } else if (existsSync(marksPath)) {
    const m = JSON.parse(readFileSync(marksPath, 'utf8'));
    log(`ran but fell short: ${m.failure ?? 'unknown'} (${beats} beats)`);
  } else {
    log(`run did not produce marks (${beats} beats)`);
  }

  const waitMs = everyMinutes * 60_000;
  if (Date.now() + waitMs >= deadline) break;
  log(`sleeping ${everyMinutes} min`);
  await new Promise((r) => setTimeout(r, waitMs));
}

log('gave up waiting — the grant was never topped up within the window');
process.exit(1);
