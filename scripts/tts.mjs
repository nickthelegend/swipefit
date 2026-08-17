/**
 * PHASE 2 — narration.
 *
 * Synthesises one audio file per line with Kokoro and writes demo/durations.json,
 * which is the ONE CLOCK the driver and the cutter both read. Every duration in
 * it is measured from the rendered audio (sample count / sample rate), never
 * estimated from the text — an estimated span is exactly how narration and
 * footage drift apart.
 *
 * Kokoro runs through onnxruntime in .venv-tts. An earlier revision of this file
 * used macOS `say` because Kokoro was not installed; that was a substitution for
 * a specified tool and it should have been raised rather than quietly commented.
 *
 * Setup, once:
 *   ./scripts/fetch_kokoro.sh
 *   python3 -m venv .venv-tts && .venv-tts/bin/pip install kokoro-onnx soundfile
 *
 *   node scripts/tts.mjs
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const python = `${root}.venv-tts/bin/python`;
const BREATH_SECONDS = 0.45;

if (!existsSync(python)) {
  throw new Error(
    'KOKORO_VENV_MISSING: create it with\n' +
    '  python3 -m venv .venv-tts && .venv-tts/bin/pip install kokoro-onnx soundfile',
  );
}

const run = spawnSync(python, [`${root}scripts/kokoro_tts.py`], {
  encoding: 'utf8',
  maxBuffer: 32 * 1024 * 1024,
});

// stderr carries the per-line progress; stdout carries only the JSON payload.
if (run.stderr) process.stderr.write(run.stderr);
if (run.status !== 0) {
  throw new Error(`KOKORO_FAILED\n  ${(run.stderr || run.stdout || '').trim()}`);
}

const result = JSON.parse(run.stdout);
const script = JSON.parse(readFileSync(`${root}demo/narration.json`, 'utf8'));

// Every line in the script must have produced a file. A missing entry would
// otherwise surface much later as NO_AUDIO_FOR_BEAT in the cutter.
for (const line of script.lines) {
  if (!result.lines[line.id]) throw new Error(`NO_AUDIO_SYNTHESISED: ${line.id}`);
  if (!existsSync(`${root}${result.lines[line.id].file}`)) {
    throw new Error(`AUDIO_FILE_MISSING: ${result.lines[line.id].file}`);
  }
}

const totalSeconds = Object.values(result.lines).reduce((sum, l) => sum + l.seconds, 0);
const withBreaths = totalSeconds + BREATH_SECONDS * script.lines.length;

writeFileSync(
  `${root}demo/durations.json`,
  JSON.stringify(
    {
      engine: 'kokoro-onnx',
      voice: result.voice,
      speed: result.speed,
      breathSeconds: BREATH_SECONDS,
      totalSeconds: Number(totalSeconds.toFixed(3)),
      lines: result.lines,
    },
    null,
    2,
  ) + '\n',
);

const mmss = (s) => `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
console.log(`\n  engine         kokoro-onnx (${result.voice})`);
console.log(`  ${script.lines.length} lines`);
console.log(`  narration      ${totalSeconds.toFixed(1)}s`);
console.log(`  with breaths   ${withBreaths.toFixed(1)}s  (${mmss(withBreaths)})`);
