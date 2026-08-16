/**
 * Synthesises the demo's music bed.
 *
 * The catalog route (HeyGen, via the media-use skill) needs a CLI and an OAuth
 * login through a browser, which is not something that can happen unattended.
 * This generates a real track with ffmpeg instead: no dependency, no licence
 * question, and it can be regenerated at any length.
 *
 * Choices, all in service of narration sitting on top:
 *
 *   A minor, because the palette is loud and the copy is plain — a major-key
 *   bed would read as an advert and fight the tone.
 *
 *   The pad occupies 110-660Hz and is low-passed at 1.2kHz. Speech carries its
 *   intelligibility between roughly 1-4kHz, so the bed is deliberately absent
 *   exactly where the voice lives rather than being turned down everywhere.
 *
 *   Mixed to about -26 LUFS, roughly 12dB under the narration. Loud enough to
 *   feel, quiet enough that nobody reaches for the volume.
 *
 *   node scripts/make_bgm.mjs [seconds]
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const outDir = `${root}demo/audio`;
mkdirSync(outDir, { recursive: true });

const seconds = Number(process.argv[2] ?? 215);
const out = `${outDir}/bgm.wav`;

// A minor: A2 C3 E3 A3, plus a fifth for body. Detuned by a few cents against
// each other so the pad breathes instead of sounding like a test tone.
const voices = [
  { hz: 110.0, gain: 0.30 },
  { hz: 110.6, gain: 0.22 },
  { hz: 130.81, gain: 0.20 },
  { hz: 164.81, gain: 0.18 },
  { hz: 220.0, gain: 0.12 },
  { hz: 329.63, gain: 0.07 },
];

const pads = voices
  .map((v, i) => `sine=frequency=${v.hz}:duration=${seconds}[p${i}]`)
  .join(';');

const padMix = voices.map((_, i) => `[p${i}]`).join('');
const padGains = voices.map((v) => v.gain).join(' ');

// A soft pulse on the downbeat at 84 BPM — felt more than heard, and slow
// enough that it never competes with the pace of the narration.
const bpm = 84;
const filter = [
  pads,
  `${padMix}amix=inputs=${voices.length}:weights=${padGains}:normalize=0[pad]`,

  // Slow swell, one cycle every 10s. ffmpeg's tremolo bottoms out at 0.1Hz, and
  // 10s is deliberately not a multiple of the beat so the bed never feels like
  // it is counting along with anything on screen.
  `[pad]tremolo=f=0.1:d=0.35[padtrem]`,

  // Speech lives between roughly 1-4kHz. Clearing that band is what lets the bed
  // stay audible without ever masking a word.
  `[padtrem]lowpass=f=1200,highpass=f=80[padband]`,

  `sine=frequency=55:duration=${seconds}[sub]`,
  `[sub]tremolo=f=${(bpm / 60).toFixed(3)}:d=0.85,lowpass=f=140,volume=0.20[pulse]`,

  `[padband][pulse]amix=inputs=2:weights=1 0.5:normalize=0[dry]`,

  // A little space, then a slow fade at each end so it can be dropped straight
  // under the take without a hard start.
  `[dry]aecho=0.6:0.5:420|780:0.25|0.14[wet]`,
  `[wet]afade=t=in:st=0:d=3,afade=t=out:st=${(seconds - 5).toFixed(1)}:d=5[faded]`,

  // Around -26 LUFS: roughly 12dB below the narration, so it supports rather
  // than competes.
  `[faded]loudnorm=I=-26:TP=-3:LRA=11[out]`,
].join(';');

execFileSync('ffmpeg', [
  '-y', '-loglevel', 'error',
  '-filter_complex', filter,
  '-map', '[out]',
  '-ar', '48000', '-ac', '2',
  out,
]);

const dur = execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=noprint_wrappers=1:nokey=1', out,
], { encoding: 'utf8' }).trim();

const loudness = execFileSync('ffprobe', [
  '-v', 'error', '-f', 'lavfi',
  '-i', `amovie=${out},ebur128=metadata=1`,
  '-show_entries', 'frame_tags=lavfi.r128.I',
  '-of', 'default=noprint_wrappers=1:nokey=1',
], { encoding: 'utf8' }).trim().split('\n').filter(Boolean).pop();

console.log(`  ${out}`);
console.log(`  duration   ${Number(dur).toFixed(1)}s`);
console.log(`  loudness   ${loudness ?? 'n/a'} LUFS (target -26, ~12dB under narration)`);
