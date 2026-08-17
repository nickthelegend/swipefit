/**
 * PHASE D — assembles the finished cut from the beat-mark log.
 *
 * Cuts on marks, never by eye. Each beat's clip is the footage between its own
 * mark and the next, and it carries that beat's narration audio. Nothing here
 * estimates a duration: every span comes from the log and every audio length
 * from ffprobe.
 *
 * The rule that governs the whole file: anything that reports success while
 * doing nothing is a bug. Every stage asserts its own output rather than
 * assuming it, and fails loudly by name.
 *
 *   node scripts/cut_video.mjs demo/take-v2
 */

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const takeDir = process.argv[2] ?? `${root}demo/take-v2`;
const OUT = `${root}demo/cut`;
const WORK = `${OUT}/clips`;

/**
 * ffmpeg, with its error actually readable.
 *
 * execFileSync throws with stderr as a raw Buffer, which prints as a wall of
 * byte codes — every failure in this script was diagnosed by guessing until this
 * existed. It now reports the failing command and what ffmpeg said.
 */
const ff = (args) => {
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { encoding: 'utf8' });
  if (r.status !== 0) {
    throw new Error(`FFMPEG_FAILED\n  ffmpeg ${args.join(' ')}\n  ${(r.stderr || '').trim()}`);
  }
  return r.stdout;
};
const probe = (args) => execFileSync('ffprobe', ['-v', 'error', ...args], { encoding: 'utf8' }).trim();
const seconds = (f) => Number(probe(['-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', f]));
const log = (m) => console.log(`  ${m}`);

/** Past ~3x the cursor teleports and the footage stops reading as real. */
const MAX_SPEED = 3.0;
/** A wait with no narration is compressed to this, never held as a still. */
const THINKING_SECONDS = 5;

rmSync(OUT, { recursive: true, force: true });
mkdirSync(WORK, { recursive: true });

const source = `${takeDir}/raw-take.mp4`;
const marks = JSON.parse(readFileSync(`${takeDir}/marks.json`, 'utf8')).marks;
const durations = JSON.parse(readFileSync(`${root}demo/durations.json`, 'utf8'));

if (!existsSync(source)) throw new Error(`NO_SOURCE: ${source}`);

const videoSeconds = seconds(source);
log(`source ${videoSeconds.toFixed(1)}s, ${marks.length} beats`);

// --- PHASE A gate, again, at cut time ------------------------------------
// The take was approved once; this refuses to cut if the file it was handed
// disagrees with the log it was handed. Cheap, and it is exactly the mistake
// that produces a "final" cut from a stale master.
const last = marks[marks.length - 1];
if (last.videoMs / 1000 > videoSeconds) {
  throw new Error(
    `MARKS_PAST_END: last mark ${last.id} at ${(last.videoMs / 1000).toFixed(1)}s ` +
    `but the video is ${videoSeconds.toFixed(1)}s`,
  );
}

// --- build one normalised clip per beat ----------------------------------
const clips = [];

for (const [i, mark] of marks.entries()) {
  const startS = mark.videoMs / 1000;
  const endS = i + 1 < marks.length ? marks[i + 1].videoMs / 1000 : videoSeconds;
  const spanS = Math.max(0.5, endS - startS);

  const line = durations.lines[mark.id];
  if (!line) throw new Error(`NO_AUDIO_FOR_BEAT: ${mark.id}`);
  const audio = `${root}${line.file}`;
  if (!existsSync(audio)) throw new Error(`NO_AUDIO_FILE: ${audio}`);
  const narrationS = seconds(audio);

  const raw = `${WORK}/${String(i).padStart(2, '0')}-${mark.id}-raw.mp4`;
  ff(['-ss', String(startS), '-t', String(spanS), '-i', source, '-an', '-c:v', 'libx264',
      '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', raw]);

  // Fit footage to narration: speed up a long span, hold the tail of a short one.
  const fitted = `${WORK}/${String(i).padStart(2, '0')}-${mark.id}-fit.mp4`;
  let how;

  if (spanS > narrationS * 1.05) {
    const needed = spanS / narrationS;
    const speed = Math.min(needed, MAX_SPEED);

    // When the span is far longer than its line it is a wait, not content, so
    // only the tail is kept — and the tail is taken from the RAW footage BEFORE
    // the speed ramp, never after.
    //
    // setpts rewrites presentation timestamps but leaves the container's
    // duration metadata describing the original length. Seeking on a ramped
    // file therefore lands past its real end and produces a file with no
    // stream at all, which then failed several steps later as an unreadable
    // input. Trimming first keeps every seek on an honest timeline.
    let toRamp = raw;
    if (needed > MAX_SPEED) {
      const keepRaw = Math.min(spanS, narrationS * MAX_SPEED);
      const tail = `${WORK}/${String(i).padStart(2, '0')}-${mark.id}-tail.mp4`;
      ff(['-ss', String(Math.max(0, spanS - keepRaw)), '-i', raw, '-an',
          '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', tail]);
      toRamp = tail;
      how = `tail ${keepRaw.toFixed(1)}s + ramp ${MAX_SPEED.toFixed(1)}x`;
    } else {
      how = `ramp ${speed.toFixed(2)}x`;
    }

    ff(['-i', toRamp, '-filter:v', `setpts=PTS/${speed.toFixed(4)}`, '-an',
        '-fps_mode', 'cfr', '-r', '30',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', fitted]);
  } else {
    // clamped at zero: the pacing maths can land a hair negative and ffmpeg
    // rejects a negative pad outright rather than treating it as none.
    const padS = Math.max(0, narrationS - spanS);
    ff(['-i', raw, '-vf', `tpad=stop_mode=clone:stop_duration=${padS.toFixed(3)}`, '-an',
        '-fps_mode', 'cfr', '-r', '30',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', fitted]);
    how = `hold +${padS.toFixed(1)}s`;
  }

  // Mux narration. apad BEFORE -shortest, or a clip whose audio is shorter than
  // its picture gets cut to the audio instead of padded.
  const clip = `${WORK}/${String(i).padStart(2, '0')}-${mark.id}.mp4`;
  // -t pins the clip to its narration length instead of trusting -shortest.
  //
  // setpts and tpad both leave the container's duration metadata describing the
  // original footage, so -shortest was measuring the wrong stream and clips came
  // out up to twice their intended length with silence hanging off the end. The
  // narration file's duration is the one number here that is always true, so it
  // is the one the clip is cut to. Video is re-encoded rather than copied
  // because a stream copy cannot honour -t mid-GOP.
  ff(['-i', fitted, '-i', audio, '-map', '0:v:0', '-map', '1:a:0',
      '-af', 'apad', '-t', narrationS.toFixed(3),
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-ac', '2', clip]);

  // Assert the clip actually carries audio. A silent card in a concat mutes the
  // whole stretch and looks completely fine until someone plays it.
  const streams = probe(['-select_streams', 'a', '-show_entries', 'stream=codec_type',
                         '-of', 'default=noprint_wrappers=1:nokey=1', clip]);
  if (!streams.includes('audio')) throw new Error(`NO_SLIDE_AUDIO: ${mark.id}`);

  const finalS = seconds(clip);
  if (finalS > narrationS + 1.5) {
    throw new Error(`CLIP_OVERRUNS_NARRATION: ${mark.id} is ${finalS.toFixed(1)}s against a ${narrationS.toFixed(1)}s line`);
  }
  clips.push({ id: mark.id, file: clip, seconds: finalS, narrationS, spanS, how });
  log(`${String(i).padStart(2, '0')} ${mark.id.padEnd(11)} span ${spanS.toFixed(1)}s  line ${narrationS.toFixed(1)}s  ${how.padEnd(22)} -> ${finalS.toFixed(1)}s`);
}

// --- concat ---------------------------------------------------------------
const manifest = `${OUT}/clips.txt`;
writeFileSync(manifest, clips.map((c) => `file '${c.file}'`).join('\n') + '\n');

const master = `${OUT}/swipefit-master.mp4`;
ff(['-f', 'concat', '-safe', '0', '-i', manifest, '-c', 'copy', master]);

const masterS = seconds(master);
const expected = clips.reduce((s, c) => s + c.seconds, 0);
if (Math.abs(masterS - expected) > 2) {
  throw new Error(`CONCAT_DRIFT: master ${masterS.toFixed(1)}s vs clips ${expected.toFixed(1)}s`);
}

writeFileSync(`${OUT}/timeline.json`, JSON.stringify({ source, masterSeconds: masterS, clips }, null, 2) + '\n');

log(`\n  master ${master}`);
log(`  runtime ${Math.floor(masterS / 60)}m ${Math.round(masterS % 60)}s`);
