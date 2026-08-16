/**
 * PHASE 2 — one audio file per narration line, with MEASURED durations.
 *
 * The one-clock rule lives or dies here. The driver holds each beat for the
 * real length of its audio file, so nothing in this script is allowed to
 * estimate: every duration comes from ffprobe reading the rendered file.
 *
 * Voice is macOS `say` (Samantha). Kokoro would be better and is not installed;
 * pulling in torch to get it is not a trade worth making tonight.
 *
 *   node scripts/tts.mjs
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = `${root}demo/audio`;
const script = JSON.parse(readFileSync(`${root}demo/narration.json`, 'utf8'));

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

const durations = {};
let total = 0;

for (const [i, line] of script.lines.entries()) {
  const n = String(i).padStart(2, '0');
  const aiff = `${outDir}/${n}-${line.id}.aiff`;
  const wav = `${outDir}/${n}-${line.id}.wav`;

  // -r 172 is a touch slower than default. At default pace the longer beats
  // clip their own clauses and the CIELAB line in particular becomes mush.
  execFileSync('say', ['-v', script.voice, '-r', '172', '-o', aiff, line.text]);

  // 48kHz mono PCM — matches what the screen recording will be muxed against,
  // so no resample step later.
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', aiff, '-ar', '48000', '-ac', '1', wav]);
  rmSync(aiff);

  const seconds = Number(
    execFileSync('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      wav,
    ], { encoding: 'utf8' }).trim(),
  );

  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new Error(`ffprobe returned no duration for ${wav} — refusing to guess`);
  }

  durations[line.id] = { file: `demo/audio/${n}-${line.id}.wav`, seconds: Number(seconds.toFixed(3)) };
  total += seconds;
  console.log(`  ${n} ${line.id.padEnd(12)} ${seconds.toFixed(2)}s`);
}

// 0.45s of breath after each line, matching the driver's hold().
const BREATH = 0.45;
const withBreath = total + BREATH * script.lines.length;

writeFileSync(
  `${root}demo/durations.json`,
  JSON.stringify({ breathSeconds: BREATH, totalSeconds: Number(total.toFixed(3)), lines: durations }, null, 2) + '\n',
);

console.log(`\n  ${script.lines.length} lines`);
console.log(`  narration      ${total.toFixed(1)}s`);
console.log(`  with breaths   ${withBreath.toFixed(1)}s  (${Math.floor(withBreath / 60)}m ${Math.round(withBreath % 60)}s)`);
