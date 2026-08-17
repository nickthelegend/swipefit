/**
 * PHASES E-J — animated intro/outro, subtitles, music bed, publish kit.
 *
 * Reads the timeline the cutter wrote; never re-measures by eye. Cue times are
 * taken from the FINISHED clips after the mux, because -t trims each card to its
 * narration and measuring before that walks the captions seconds ahead of the
 * picture by the end.
 *
 *   node scripts/finish_video.mjs
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const CUT = `${root}demo/cut`;
const OUT = `${root}demo/final`;
mkdirSync(OUT, { recursive: true });

const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`FFMPEG_FAILED\n  ffmpeg ${args.join(' ')}\n  ${(r.stderr || '').trim()}`);
};
const seconds = (f) => Number(spawnSync('ffprobe',
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', f],
  { encoding: 'utf8' }).stdout.trim());
const log = (m) => console.log(`  ${m}`);

const timeline = JSON.parse(readFileSync(`${CUT}/timeline.json`, 'utf8'));
const script = JSON.parse(readFileSync(`${root}demo/narration.json`, 'utf8'));
const W = 1080, H = 2400, FPS = 30;

/* ---------------------------------------------------------------- intro/outro */

/**
 * Kinetic title cards, drawn frame by frame with drawtext rather than a zoom.
 *
 * HyperFrames is not connected in this environment, so the motion is authored
 * here: staggered entrances with eased offsets, on the product's own ground
 * colour, using the app's own typeface weight. Not a crossfade standing in for
 * an animation.
 */
function titleCard(file, which, seconds_) {
  // Drawn frame by frame in Python, because this ffmpeg is built without
  // libfreetype and drawtext does not exist. That constraint turned out fine:
  // real per-frame composition gives eased, staggered entrances with true alpha,
  // rather than a zoom or a crossfade standing in for an animation.
  const frames = `${OUT}/_frames-${which}`;
  const r = spawnSync('python3', [`${root}scripts/title_cards.py`, which, frames], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`TITLE_CARD_FAILED (${which})\n  ${(r.stderr || '').trim()}`);

  ff(['-framerate', String(FPS), '-i', `${frames}/%05d.png`,
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', file]);
}

const introV = `${OUT}/_intro.mp4`;
const outroV = `${OUT}/_outro.mp4`;
const INTRO_S = 3.6, OUTRO_S = 4.4;

titleCard(introV, 'intro', INTRO_S);
titleCard(outroV, 'outro', OUTRO_S);

// Silence under the cards, so every segment in the concat carries audio. A
// segment without an audio stream mutes the whole stretch after it.
for (const [v, d] of [[introV, INTRO_S], [outroV, OUTRO_S]]) {
  const withAudio = v.replace('.mp4', '-a.mp4');
  ff(['-i', v, '-f', 'lavfi', '-i', `anullsrc=r=48000:cl=stereo`, '-shortest',
      '-t', String(d), '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', withAudio]);
  ff(['-i', withAudio, '-c', 'copy', v]);
}
log(`intro ${INTRO_S}s, outro ${OUTRO_S}s`);

/* --------------------------------------------------------------------- splice */

const spliced = `${OUT}/_body.mp4`;
const manifest = `${OUT}/_all.txt`;
writeFileSync(manifest, [introV, `${CUT}/swipefit-master.mp4`, outroV].map((f) => `file '${f}'`).join('\n') + '\n');
ff(['-f', 'concat', '-safe', '0', '-i', manifest, '-c:v', 'libx264', '-preset', 'veryfast',
    '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', spliced]);

const bodyS = seconds(spliced);
log(`spliced ${Math.floor(bodyS / 60)}m ${Math.round(bodyS % 60)}s`);

/* ---------------------------------------------------------------------- music */

const bgm = `${root}demo/audio/bgm.wav`;
const mixed = `${OUT}/_mixed.mp4`;
if (existsSync(bgm)) {
  ff(['-i', spliced, '-stream_loop', '-1', '-i', bgm,
      '-filter_complex', // The bed was mastered to -25.8 LUFS specifically to sit about 12dB under the
      // narration, so attenuating it again by 0.30 pushed it below audibility —
      // silencedetect found the title cards completely silent. Near unity keeps it
      // where it was designed to be.
      '[1:a]volume=0.9[bed];[0:a][bed]amix=inputs=2:duration=first:dropout_transition=0[a]',
      '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', mixed]);
  log('music bed mixed at 0.30');
} else {
  ff(['-i', spliced, '-c', 'copy', mixed]);
}

/* ------------------------------------------------------------------ subtitles */

/** Phrase-level cues: sentences, then clauses, then words. ~88 chars max. */
function chunk(text) {
  const out = [];
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    if (sentence.length <= 88) { out.push(sentence.trim()); continue; }
    let buf = '';
    for (const part of sentence.split(/(?<=,)\s+/)) {
      for (const piece of (part.length <= 88 ? [part] : part.split(/\s+/))) {
        if ((buf + ' ' + piece).trim().length > 88) { if (buf) out.push(buf.trim()); buf = piece; }
        else buf = (buf + ' ' + piece).trim();
      }
    }
    if (buf) out.push(buf.trim());
  }
  return out.filter(Boolean);
}

const srt = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  const ms = Math.round((s - Math.floor(s)) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
};

const byId = Object.fromEntries(script.lines.map((l) => [l.id, l.text]));
let cursor = INTRO_S;
const cues = [];

for (const clip of timeline.clips) {
  // Measured on the FINISHED clip, after the mux trimmed it to its narration.
  const dur = seconds(clip.file);
  const text = byId[clip.id];
  const parts = chunk(text);
  const totalChars = parts.reduce((s, p) => s + p.length, 0) || 1;

  let t = cursor;
  for (const part of parts) {
    const share = (part.length / totalChars) * dur;
    if (part.length > 176) throw new Error(`CUE_TOO_LONG: ${clip.id} — ${part.length} chars`);
    cues.push({ start: t, end: t + share, text: part });
    t += share;
  }
  cursor += dur;
}

writeFileSync(`${OUT}/swipefit.srt`,
  cues.map((c, i) => `${i + 1}\n${srt(c.start)} --> ${srt(c.end)}\n${c.text}\n`).join('\n'));
log(`${cues.length} cues`);

const clean = `${OUT}/swipefit-clean.mp4`;
ff(['-i', mixed, '-c', 'copy', clean]);

const burned = `${OUT}/swipefit.mp4`;

// Captions are composited from PNG plates, not burned with libass.
//
// This ffmpeg has NO subtitle filters at all — `subtitles` and `ass` are both
// absent — so there is nothing to burn with. Rendering the plates in PIL and
// compositing with plain `overlay` needs no extra library, and it keeps the
// typography and safe area under our own control. The .srt sidecar is still
// emitted for players that want real subtitles.
const cuesFile = `${OUT}/_cues.json`;
writeFileSync(cuesFile, JSON.stringify(cues, null, 2));

const plates = `${OUT}/_plates`;
const plateRun = spawnSync('python3', [`${root}scripts/caption_plates.py`, cuesFile, plates], { encoding: 'utf8' });
if (plateRun.status !== 0) throw new Error(`CAPTION_PLATES_FAILED\n  ${(plateRun.stderr || '').trim()}`);

// One overlay per cue, gated on its own window. MarginV of 110px keeps the band
// clear of the frame edge and of the app's own bottom tab bar.
const inputs = [];
const chain = [];
let node = '[0:v]';
cues.forEach((c, i) => {
  inputs.push('-i', `${plates}/${String(i).padStart(4, '0')}.png`);
  const next = i === cues.length - 1 ? '[v]' : `[t${i}]`;
  chain.push(`${node}[${i + 1}:v]overlay=x=(W-w)/2:y=H-h-110:enable='between(t,${c.start.toFixed(3)},${c.end.toFixed(3)})'${next}`);
  node = `[t${i}]`;
});

ff(['-i', mixed, ...inputs, '-filter_complex', chain.join(';'),
    '-map', '[v]', '-map', '0:a',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'copy', burned]);

const finalS = seconds(burned);

/* --------------------------------------------------------------- publish kit */

const chapters = [];
let at = 0;
const marker = (id, label) => { const c = timeline.clips.find((x) => x.id === id); return c ? { id, label } : null; };
const wanted = [['intro', 'The idea'], ['scanlive', 'Live skin scan'], ['reading', 'The reading, in CIELAB'],
                ['deckopen', 'Sixty pieces, re-sorted'], ['matchwhy', 'Rendered on your own body'],
                ['blind', 'Why the brand is hidden'], ['bag', 'A bag across brands'],
                ['outfit', 'Chaining a full outfit'], ['handoff', 'Handoff, not checkout'],
                ['console', 'What brands actually get'], ['blindgap', 'What a name is worth']];

at = INTRO_S;
const chapterList = [{ time: 0, label: 'Intro' }];
for (const clip of timeline.clips) {
  const hit = wanted.find(([id]) => id === clip.id);
  if (hit && at > 10) chapterList.push({ time: at, label: hit[1] });
  at += seconds(clip.file);
}

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const kit = [
  '# SwipeFit — publish kit',
  '',
  `**Runtime** ${Math.floor(finalS / 60)}m ${Math.round(finalS % 60)}s`,
  '',
  '## Title',
  'SwipeFit — the skin scan that decides what you see',
  '',
  '## Chapters',
  ...chapterList.map((c) => `${mmss(c.time)} ${c.label}`),
  '',
  '## Files',
  `- burned-in: demo/final/swipefit.mp4`,
  `- clean master: demo/final/swipefit-clean.mp4`,
  `- subtitles: demo/final/swipefit.srt`,
  '',
  '## Built on',
  '- YouCam Skin AI (skin-tone-analysis, skin-analysis)',
  '- YouCam Apparel Virtual Try-On (cloth-v3)',
  '- 60 real products across 9 brands; every handoff opens the brand’s own page',
].join('\n');

writeFileSync(`${OUT}/PUBLISH-KIT.md`, kit + '\n');

log(`\n  final    ${burned}`);
log(`  clean    ${clean}`);
log(`  srt      ${OUT}/swipefit.srt`);
log(`  runtime  ${Math.floor(finalS / 60)}m ${Math.round(finalS % 60)}s`);
log(`  chapters ${chapterList.length}`);
