/**
 * PHASE 3 + 4 — drives the real app on a real device and records it.
 *
 * Every interaction here is a real touch event delivered to a real APK talking
 * to the real API over the real network. Nothing is staged. If the app fails,
 * the take shows it failing, and the correct response is to fix the app and
 * record again — not to trim the failure out.
 *
 * ONE CLOCK: hold() sleeps for the MEASURED duration of that beat's audio file
 * (from demo/durations.json) plus a fixed breath. Nothing is timed by eye, so
 * narration and footage cannot drift apart.
 *
 * Where this departs from a browser driver, and why:
 *
 *   There is no SVG cursor. FITCHECK is React Native on Android — there is no
 *   DOM to inject an overlay into, and adding one would mean shipping demo-only
 *   code into the APK, which would make the take staged rather than real.
 *   Android's own "show taps" developer setting draws the touch indicator
 *   instead: a real OS affordance rather than something we painted.
 *
 *   There is no crop. The device IS the frame at exactly 1080x2400, and nothing
 *   else is on screen, so there is no window geometry to fix or rectangle to cut.
 *
 *   until() polls the real view hierarchy via uiautomator and throws a NAMED
 *   error on timeout, so a failed take says which beat died rather than leaving
 *   a black screen to interpret.
 *
 *   npm run demo:drive
 */

import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
// Each run gets its own directory. A retry used to overwrite the previous take,
// which threw away the best run of the night when the next one went worse.
const RUN_ID = process.env.DEMO_RUN_ID ?? String(process.hrtime.bigint()).slice(-6);
const OUT = `${root}demo/take-${RUN_ID}`;
const PKG = 'com.fitcheck.app';

/**
 * TAIL mode records only the closing beats.
 *
 * The console, blind comparison and outro are computed entirely from swipe
 * telemetry held on the device — they look and read identically whether the
 * skin scan ran live or fell back to a recorded reading. So when the API grant
 * is exhausted they can still be captured honestly, at zero units, by
 * navigating through onboarding without marking those beats.
 *
 *   DEMO_TAIL=1 npm run demo:drive
 */
const TAIL = process.env.DEMO_TAIL === '1';

const durations = JSON.parse(readFileSync(`${root}demo/durations.json`, 'utf8'));
const marks = [];
const degraded = {};
let t0 = 0;

// maxBuffer is raised well past the 1MB default: `screenrecord` emits about a
// megabyte of codec configuration to stdout per invocation, and overflowing the
// buffer throws with the entire log as the message, which reads like a recorder
// failure rather than a plumbing one.
const sh = (args, opts = {}) =>
  execFileSync('adb', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (m) => console.log(`  ${m}`);

/* ------------------------------------------------------------------ marks */

/**
 * Records the instant a beat starts, on the same clock as the recording.
 * Emitted as `DEMO_LINE <ms> <line-id>` so the mark log can be diffed against
 * the video without trusting anything's memory of the order.
 */
const TAIL_BEATS = new Set(['console', 'blindgap', 'outro']);

/**
 * Is FITCHECK actually the focused app right now?
 *
 * Added after a take reported SUCCESS while filming the Android search screen
 * with the keyboard up. Every beat had been marked, the run was declared clean,
 * and the footage contained no FITCHECK at all — the app had been exited by a
 * stray fallback tap several minutes earlier. Marking a beat is not evidence
 * that anything was recorded; this is.
 */
function appInForeground() {
  try {
    const focus = sh(['shell', 'dumpsys', 'window'], { stdio: 'pipe' });
    return /mCurrentFocus=.*com\.fitcheck\.app/.test(focus)
      || /mFocusedApp=.*com\.fitcheck\.app/.test(focus);
  } catch {
    return false;
  }
}

function line(id) {
  // In tail mode the earlier beats are navigation, not footage: marking them
  // would claim coverage this run does not have.
  if (TAIL && !TAIL_BEATS.has(id)) return durations.lines[id]?.seconds ?? 0;

  if (!appInForeground()) {
    throw new Error(`APP NOT IN FOREGROUND at beat "${id}" — refusing to mark footage that does not show the app`);
  }

  const ms = Date.now() - t0;
  const seconds = durations.lines[id]?.seconds;
  if (seconds === undefined) throw new Error(`No measured duration for beat "${id}"`);
  marks.push({ id, ms, seconds, signing: false });
  console.log(`DEMO_LINE ${ms} ${id}`);
  return seconds;
}

/** Holds for this beat's real audio length plus a breath. */
async function hold(id) {
  if (TAIL && !TAIL_BEATS.has(id)) return;
  const seconds = durations.lines[id].seconds;
  await sleep((seconds + durations.breathSeconds) * 1000);
}

/**
 * A beat allowed to fall short.
 *
 * Used for everything after the bag. Those beats depend on slow chained renders
 * and modal navigation, and losing the closing argument — the brand console,
 * the blind comparison, the outro — because one render ran long is the wrong
 * trade. What degraded is recorded per beat in the mark log, never hidden.
 */
async function softBeat(id, action) {
  line(id);
  try {
    if (action) await action();
  } catch (error) {
    degraded[id] = error instanceof Error ? error.message : String(error);
    log(`  ! ${id} degraded: ${degraded[id]}`);
  }
  await hold(id);
}

/** Marks a beat and holds it. The common case. */
async function beat(id, action) {
  line(id);
  if (action) await action();
  await hold(id);
}

/* ------------------------------------------------------------- real state */

/**
 * The current view hierarchy, as text. Real state, not a guess.
 *
 * Retries, because uiautomator refuses to dump while the window is animating
 * and the deck animates continuously — the card, the progress bar, the coach.
 * A single attempt returned an empty string often enough that taps looked like
 * missing elements rather than a busy window.
 */
function dumpUi(attempts = 3) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      // Delete first. uiautomator leaves the PREVIOUS dump in place when it
      // refuses to run, so `cat` happily returns a stale hierarchy that still
      // contains <node> and passes any sanity check — which is how a bag that
      // had just gained an item kept reporting zero, and how buttons on screen
      // read as "not dumpable". Every failure this driver reported about swipes
      // and missing labels traces back to reading an old screen.
      sh(['shell', 'rm', '-f', '/sdcard/ui.xml'], { stdio: 'pipe' });
      sh(['shell', 'uiautomator', 'dump', '/sdcard/ui.xml'], { stdio: 'pipe' });
      const xml = sh(['shell', 'cat', '/sdcard/ui.xml']);
      if (xml.includes('<node')) return xml;
    } catch {
      // Busy window; fall through and try again.
    }
    execFileSync('sleep', ['0.8']);
  }
  return '';
}

/**
 * Polls real state until the predicate passes. Throws a NAMED error on timeout
 * so a dead take identifies its own cause.
 */
async function until(label, predicate, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let last = '';
  while (Date.now() < deadline) {
    last = dumpUi();
    if (predicate(last)) return last;
    await sleep(1200);
  }
  throw new Error(`TIMEOUT waiting for "${label}" after ${timeoutMs}ms`);
}

const seen = (xml, text) => xml.toLowerCase().includes(text.toLowerCase());

/* ----------------------------------------------------------------- inputs */

const tap = (x, y) => sh(['shell', 'input', 'tap', String(x), String(y)]);
const swipe = (x1, y1, x2, y2, ms) =>
  sh(['shell', 'input', 'swipe', String(x1), String(y1), String(x2), String(y2), String(ms)]);

/**
 * Taps the centre of whatever node carries this text or content-description.
 *
 * Preferred over fixed coordinates: the layout genuinely moves between builds
 * (the result screen grew a whole skin-condition panel when the live scan
 * started working), and a take driven by stale coordinates taps empty space and
 * looks like the app ignored it.
 */
/**
 * Taps a label if it can be found, otherwise taps a known position.
 *
 * The fallback is for the deck, where the hierarchy is often undumpable mid
 * animation. Both paths deliver a real touch event to the real app — the
 * fallback only changes how the target is located, never whether the
 * interaction is genuine.
 */
function tapLabelOrAt(needle, x, y) {
  try {
    tapLabel(needle);
  } catch {
    log(`  (label "${needle}" not dumpable — tapping known position)`);
    tap(x, y);
  }
}

function tapLabel(needle, xml = dumpUi()) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `<node[^>]*(?:text|content-desc)="[^"]*${escaped}[^"]*"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`,
    'i',
  );
  const m = xml.match(re);
  if (!m) throw new Error(`NOT FOUND on screen: "${needle}"`);
  const [, x1, y1, x2, y2] = m.map(Number);
  tap(Math.round((x1 + x2) / 2), Math.round((y1 + y2) / 2));
  return true;
}


/**
 * One right-swipe that actually lands in the bag.
 *
 * Two things eat a naive swipe. A blind right-swipe raises the BrandReveal
 * overlay for 1.65s, and a swipe delivered into that overlay hits the overlay
 * rather than the next card. A high-risk garment raises a confirm sheet instead
 * of committing, and left alone it simply sits there — the first take reached
 * the bag with nothing in it for exactly this reason.
 *
 * So: swipe, let the reveal finish, then answer the sheet if it appeared. The
 * sheet is answered honestly with "Add it anyway", which is a real decision a
 * real shopper makes, and it is recorded as `confirmed` in the telemetry either
 * way.
 */
/** Reads the tab bar's own item count. Real state, straight from the app. */
function bagCount() {
  const m = dumpUi().match(/content-desc="Bag, (\d+) items?"/);
  return m ? Number(m[1]) : null;
}

async function swipeRight() {
  const before = bagCount();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    swipe(300, 1200, 1060, 1180, 420);
    await sleep(3200);                     // BrandReveal runs 1650ms plus settle

    const xml = dumpUi();
    if (seen(xml, 'Add it anyway')) {
      tapLabel('Add it anyway', xml);
      await sleep(1800);
    }

    // Verify it actually landed rather than assuming. A swipe that animates the
    // card away without committing looks identical on screen, and the first
    // takes reached the bag with nothing in it — the deck had advanced, so
    // everything appeared to be working.
    const after = bagCount();
    if (before === null || after === null || after > before) return;
    log(`  (right-swipe did not reach the bag, retrying — still ${after})`);
  }
}

async function swipeLeft() {
  swipe(780, 1200, 20, 1180, 420);
  await sleep(2200);
  const xml = dumpUi();
  if (seen(xml, 'Skip it')) {
    tapLabel('Skip it', xml);
    await sleep(1500);
  }
}


/**
 * Scrolls until a label is actually on screen, then stops.
 *
 * A fixed scroll distance is a guess about layout, and it broke the moment
 * window animations were disabled and the fling behaved differently. This asks
 * the screen instead.
 */
async function scrollTo(needle, maxScrolls = 6) {
  for (let i = 0; i < maxScrolls; i += 1) {
    if (seen(dumpUi(), needle)) return true;
    swipe(540, 1700, 540, 1100, 450);
    await sleep(1200);
  }
  return seen(dumpUi(), needle);
}

/* ------------------------------------------------------------- pre-flight */

async function preflight() {
  log('pre-flight');

  const devices = sh(['devices']).split('\n').filter((l) => l.includes('\tdevice'));
  if (!devices.length) throw new Error('No device attached');

  if (!existsSync(`${root}android/app/build/outputs/apk/release/app-release.apk`)) {
    throw new Error('No release APK built');
  }

  // Nothing may steal the frame mid-take.
  sh(['shell', 'settings', 'put', 'global', 'zen_mode', '2']);
  sh(['shell', 'settings', 'put', 'secure', 'show_touches', '1']);
  sh(['shell', 'settings', 'put', 'system', 'pointer_location', '0']);
  sh(['shell', 'wm', 'dismiss-keyguard']);

  // uiautomator refuses to dump while a window is animating, and it was failing
  // often enough that taps looked like missing elements and the bag-count check
  // silently short-circuited to null. This is an OS setting, not an app change —
  // the app's own Reanimated motion is untouched and still records normally.
  for (const key of ['window_animation_scale', 'transition_animation_scale', 'animator_duration_scale']) {
    sh(['shell', 'settings', 'put', 'global', key, '0.0']);
  }
  log('  do-not-disturb on, touch indicator on, window animations off');

  // Persisted onboarding, cart and render cache all survive a reinstall.
  sh(['shell', 'pm', 'clear', PKG]);
  log('  app state cleared');

  // Only treat NEW errors as failures for this run.
  sh(['logcat', '-c']);

  mkdirSync(OUT, { recursive: true });
}

/**
 * Segmented recorder.
 *
 * `adb screenrecord` is capped at 3 minutes and this take runs longer, so the
 * capture is a chain of consecutive segments concatenated afterwards.
 *
 * scrcpy would avoid the seams — no cap, one continuous file — but it produced
 * a zero-byte file here and an MP4 with no moov atom when interrupted, and
 * debugging a recorder is not what tonight is for. screenrecord is native,
 * demonstrably working, and its seams land inside the waiting gaps that get
 * trimmed in the edit anyway. The seams are disclosed in the take report rather
 * than quietly smoothed over.
 *
 * No crop: the device is the frame at exactly 1080x2400 and nothing else is on
 * screen, so there is no rectangle to cut.
 */
// 60s, not the 170s maximum. screenrecord only finalises an MP4 when it ends on
// its own, so whatever is in flight when the take stops is lost — a 170s segment
// meant losing up to 170s of footage, and it truncated the closing beats to a
// 110KB fragment. Short segments bound that loss and make the stop wait short
// enough to simply let the current one finish.
const SEGMENT_SECONDS = 60;

/**
 * When each segment started, on the same wall clock as the beat marks.
 *
 * screenrecord restarts between segments and the gap — about five seconds each —
 * is simply absent from the concatenated file. Marks taken on the wall clock
 * therefore drift ahead of the picture by the accumulated gap: on a ten-segment
 * take the final mark landed 40 seconds past the end of the video, so the last
 * two beats had no footage under them at all. The edit must cut on VIDEO time,
 * which means knowing where each segment began.
 */
const segmentStarts = [];
let recording = false;
let segments = 0;

async function recordSegments() {
  while (recording) {
    const name = `/sdcard/seg_${String(segments).padStart(2, '0')}.mp4`;
    segments += 1;
    segmentStarts.push(Date.now());

    // spawn, not execFileSync. A synchronous call here would block Node's event
    // loop for the whole 170s segment, so the driver would never get to run a
    // single beat — the recorder would be the only thing happening.
    await new Promise((resolve) => {
      const p = spawn(
        'adb',
        ['shell', 'screenrecord', '--time-limit', String(SEGMENT_SECONDS),
         '--size', '1080x2400', '--bit-rate', '4000000', name],
        { stdio: 'ignore' },
      );
      // Killed segments are expected on stop; a segment that never lands is
      // caught when they are pulled and counted.
      p.on('exit', resolve);
      p.on('error', resolve);
    });
  }
}

/** Records briefly and asserts the frame carries real content, not a black screen. */
async function verifyRecorder() {
  sh(['shell', 'input', 'keyevent', 'KEYCODE_WAKEUP']);
  sh(['shell', 'wm', 'dismiss-keyguard']);
  sh(['shell', 'screenrecord', '--time-limit', '4', '--size', '1080x2400', '/sdcard/_probe.mp4']);
  sh(['pull', '/sdcard/_probe.mp4', `${OUT}/_probe.mp4`], { stdio: 'pipe' });

  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', `${OUT}/_probe.mp4`,
    '-vframes', '1', `${OUT}/_probe.png`]);

  // ffprobe through the lavfi device, not `ffmpeg -vf signalstats`. The filter
  // only emits per-frame stats as frame tags; run through ffmpeg it printed
  // nothing to either stream, so the check scored every frame 0 and failed the
  // take for a black screen twice while the recorder was working perfectly.
  // A pre-flight check that cannot pass is worse than no check at all.
  const probe = spawnSync('ffprobe', [
    '-v', 'error',
    '-f', 'lavfi',
    '-i', `movie=${OUT}/_probe.png,signalstats`,
    '-show_entries', 'frame_tags=lavfi.signalstats.YAVG',
    '-of', 'default=noprint_wrappers=1:nokey=1',
  ], { encoding: 'utf8' });

  const avg = Number((probe.stdout ?? '').trim().split('\n')[0]);
  if (!Number.isFinite(avg)) {
    throw new Error(`Could not read frame luma (${(probe.stderr ?? '').trim().slice(0, 120)}) — refusing to assume the frame is good`);
  }
  if (avg < 8) throw new Error(`Recorder captured a black frame (YAVG ${avg})`);
  log(`  recorder verified, frame luma ${avg.toFixed(1)}`);
}

/** Pulls every segment and concatenates losslessly. */
function assembleVideo() {
  const list = [];
  for (let i = 0; i < segments; i += 1) {
    const n = String(i).padStart(2, '0');
    const local = `${OUT}/seg_${n}.mp4`;
    try {
      sh(['pull', `/sdcard/seg_${n}.mp4`, local], { stdio: 'pipe' });
      if (existsSync(local)) list.push(local);
    } catch {
      // Segment never made it to disk; counted below.
    }
  }
  if (!list.length) return { file: null, segments: 0 };

  const manifest = `${OUT}/segments.txt`;
  writeFileSync(manifest, list.map((f) => `file '${f}'`).join('\n') + '\n');
  const out = `${OUT}/raw-take.mp4`;
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0',
    '-i', manifest, '-c', 'copy', out]);

  const durations = list.map((f) => Number(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1', f,
  ], { encoding: 'utf8' }).trim()));

  return { file: out, segments: list.length, durations };
}

/* -------------------------------------------------------------- the drive */

async function drive() {
  // ---- intro / hero -----------------------------------------------------
  sh(['shell', 'am', 'start', '-n', `${PKG}/.MainActivity`], { stdio: 'pipe' });
  await until('welcome screen', (x) => seen(x, 'Start the scan'), 90_000);

  await beat('intro');
  await beat('problem');

  // ---- shop-for ---------------------------------------------------------
  await beat('shopfor', async () => {
    tapLabel("Show Women's clothing");
    await sleep(1400);
    tapLabel('Show Both clothing');
  });

  // ---- capture ----------------------------------------------------------
  await beat('capture', async () => {
    tapLabel('Start the scan');
    await until('capture screen', (x) => seen(x, 'Use demo model'));
    await scrollTo('Use demo model Deep');
  });

  // ---- live scan --------------------------------------------------------
  await beat('pickmodel', async () => {
    tapLabel('Use demo model Deep');
  });

  line('scanlive');

  // Waits on the READING ITSELF, not on the "Build my deck" button.
  //
  // That button sits below the fold on the result screen, and uiautomator only
  // dumps nodes that are actually visible — so the first version of this timed
  // out after two full minutes while the scan had in fact succeeded and was
  // sitting on screen the whole time. The reading card is the real state
  // change; the button is a second element that may never appear.
  await until(
    'skin reading to land',
    (x) => seen(x, 'Measured by YouCam') || seen(x, 'Recorded from YouCam') || seen(x, 'Scan failed'),
    120_000,
  );
  const afterScan = dumpUi();
  if (seen(afterScan, 'Scan failed')) throw new Error('SCAN FAILED — take aborted, fix before re-recording');
  await hold('scanlive');

  // Proves the live path ran. A recorded reading here is a real failure of the
  // thing this video exists to show, so it stops the take rather than narrating
  // over it.
  if (seen(afterScan, 'Recorded from YouCam')) {
    if (!TAIL) throw new Error('FELL BACK TO RECORDED READING — live scan did not run');
    degraded.scanlive = 'recorded reading — API grant exhausted; closing beats do not depend on it';
    log('  ! recorded reading (tail mode: closing beats are unaffected)');
  } else {
    log('  live reading confirmed (Measured by YouCam)');
  }

  await beat('reading');

  // ---- deck -------------------------------------------------------------
  await beat('deckopen', async () => {
    // Scroll it into view first — tapLabel cannot find a node uiautomator never
    // reported because it was off screen.
    await scrollTo('Build my deck');
    tapLabel('Build my deck');

    // Waits on the RESULT SCREEN GOING AWAY, not on the deck appearing.
    //
    // The deck opens under a full-screen coach overlay, and uiautomator cannot
    // dump through that modal — it kept returning the previous screen, so the
    // deck looked like it never opened while it was plainly on screen. The
    // reading card disappearing is the state change that is actually
    // observable.
    // Waits for the COACH ITSELF, not merely for the reading screen to leave.
    //
    // "Your reading" disappears the moment the preparing screen mounts, which is
    // a minute before the deck and its coach overlay actually appear. The old
    // wait returned there and tapped a fixed point into empty space, so the
    // coach was never dismissed — and since it is a full-screen overlay, every
    // subsequent swipe landed on it. The deck sat at "60 LEFT OF 60" for an
    // entire take while looking, frame by frame, like it was being swiped.
    await until(
      'deck and coach to appear',
      (x) => seen(x, 'Got it') || seen(x, 'left of'),
      240_000,
    );
    await sleep(1500);

    const deckXml = dumpUi();
    if (seen(deckXml, 'Got it')) {
      tapLabel('Got it', deckXml);
      await sleep(1800);
    }

    // Dismissing the coach lands a tap on the card underneath, which flips it.
    // The whole tryon beat then played over the detail side while its narration
    // said "that garment, rendered onto that body" — the render was never on
    // screen for the one line that exists to point at it. Flip it back to the
    // render before the beat that describes the render.
    // Retry, do not test once. A single dump returned nothing here and the flip
    // silently never happened, so the whole tryon beat played over the detail
    // side while its narration pointed at a render that was not on screen.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const xml = dumpUi();
      if (!seen(xml, 'Tap to flip back')) break;
      log('  (card flipped by the coach dismissal — flipping back)');
      tap(540, 1100);
      await sleep(1800);
    }

    // Assert it, rather than hope. This beat is the product's central claim and
    // the one frame that must not be the wrong side of the card.
    if (seen(dumpUi(), 'Tap to flip back')) {
      throw new Error('CARD_STUCK_FLIPPED: the try-on render is not on screen for the tryon beat');
    }
  });

  await beat('tryon');
  await beat('matchwhy', async () => {
    tap(540, 1100);           // flip the card
    await sleep(1600);
    tap(540, 1100);           // flip back
  });
  await beat('blind');

  // ---- blind swipes (>= MIN_SAMPLE of 3) --------------------------------
  await beat('swiperight', async () => {
    await swipeRight();
    await swipeRight();
  });

  await beat('swipeleft', async () => {
    // Four blind decisions in total across this beat and the last. MIN_SAMPLE is
    // three per side and a swipe occasionally fails to commit, so three exactly
    // leaves the console showing "still counting" instead of the actual gap.
    await swipeLeft();
    await swipeLeft();
  });

  // ---- revealed swipes --------------------------------------------------
  await beat('reveal', async () => {
    tapLabelOrAt('brand names while swiping', 504, 180);
    await sleep(1500);
    // Three kept and one skipped with the label showing, so the console has
    // MIN_SAMPLE on both sides of the blind comparison.
    await swipeRight();
    await swipeRight();
    await swipeLeft();
    await swipeRight();
  });

  // ---- bag --------------------------------------------------------------
  await beat('bag', async () => {
    tapLabelOrAt('Bag', 540, 2235);
    await until('bag screen', (x) => seen(x, 'Your bag') || seen(x, 'empty'));
  });

  // ---- outfit -----------------------------------------------------------
  // The outfit is two chained renders and genuinely slow — it has taken over
  // four minutes on this emulator. It is also the only beat whose failure says
  // nothing about the rest of the product, so it is allowed to come up short
  // rather than ending a take that still has the business case left to film.
  // A degraded outfit beat is recorded as degraded in the mark log, not hidden.
  if (!TAIL) await softBeat('outfit', async () => {
    try {
      await scrollTo('Build the fit');
      tapLabelOrAt('Build the fit', 540, 1560);

      const opened = dumpUi();
      if (seen(opened, 'Need both halves')) {
        degraded.outfit = 'bag lacked a top or a bottom';
        return;
      }

      await scrollTo('Render the look');
      tapLabelOrAt('Render the look', 540, 2000);
      await until('outfit render to start', (x) => seen(x, 'Layering it on') || seen(x, 'Could not build'), 90_000);
      await until('outfit result', (x) => seen(x, 'Build another') || seen(x, 'Could not build'), 150_000);
    } catch (error) {
      degraded.outfit = error instanceof Error ? error.message : String(error);
      log(`  ! outfit beat degraded: ${degraded.outfit}`);
    }
  });

  // ---- handoff ----------------------------------------------------------
  if (!TAIL) await softBeat('handoff', async () => {
    // The outfit screen is a modal route that covers the tab bar, so there is no
    // "Bag" tab to tap until we leave it by its own button.
    // The screen's own Close control. Not the hardware back key — the outfit
    // route is the root of its modal stack, so back exits the app entirely and
    // the take ended up on the Android home screen. Not "Back to the bag"
    // either: that button only renders once a look has finished, so it is
    // missing exactly while the render is still running.
    tapLabelOrAt('Close', 1000, 200);
    await until('bag screen again', (x) => seen(x, 'Your bag') || seen(x, 'empty'), 30_000);

    await scrollTo('Hand off to brands');
    tapLabelOrAt('Hand off to brands', 540, 1700);
    await until('handoff screen', (x) => seen(x, 'Handoff') || seen(x, 'Open all'), 30_000);
  });

  // ---- brand console ----------------------------------------------------
  await softBeat('console', async () => {
    // Tap, verify, tap again. The tab bounds are correct and a manual tap works
    // every time, but uiautomator dumps intermittently return nothing on this
    // emulator — which made the tap-by-label fall back AND made the verification
    // see an empty screen, so a landed tap looked like a failed one. Retrying
    // the whole tap-and-check is the only thing that survives an unreliable
    // dump.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (seen(dumpUi(), 'Brand console')) break;
      tap(879, 2274);            // measured centre of the brand tab
      await sleep(2500);
    }
  });

  if (false) await softBeat('console-old', async () => {
    // No back key here. From the bag the tab bar is already on screen, and back
    // exits the app entirely — which is how a take ended up filming the Android
    // search screen while reporting success.
    if (!TAIL) {
      sh(['shell', 'input', 'keyevent', 'KEYCODE_BACK']);
      await sleep(1200);
    }
    tapLabelOrAt('Brand', 885, 2235);

    // "Signal" is the console's own heading. Matching on "Brand" would match the
    // tab label itself and pass on any screen at all.
    await until('brand console', (x) => seen(x, 'Signal') || seen(x, 'Decision friction'), 30_000);
  });

  await softBeat('blindgap', async () => {
    swipe(540, 1800, 540, 700, 600);
    await sleep(1200);
  });

  await beat('outro');
}

/* ------------------------------------------------------------------- main */

await preflight();
await verifyRecorder();

log('recording');
recording = true;
const recorderLoop = recordSegments();
await sleep(2500);

t0 = Date.now();
let failure = null;
try {
  await drive();
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
  console.error(`\n  TAKE FAILED: ${failure}`);
}

const takeMs = Date.now() - t0;
await sleep(1500);
// Let the in-flight segment finish rather than killing it. screenrecord writes
// the moov atom on clean exit only; interrupting produces a file ffmpeg cannot
// open. Bounded by SEGMENT_SECONDS.
recording = false;
log('  letting the final segment finalise…');
await recorderLoop;
await sleep(2000);
const assembled = assembleVideo();

const errorsAfter = sh(['logcat', '-d']).split('\n').filter((l) => /FATAL EXCEPTION|E ReactNativeJS/.test(l));

/**
 * Wall-clock mark -> position in the concatenated video.
 *
 * Walks the segments, subtracting the gap before each one. A mark that lands in
 * a gap (the instant between screenrecord exiting and the next starting) is
 * clamped to the end of the previous segment — that footage genuinely does not
 * exist, and pretending otherwise is what put marks past the end of the file.
 */
function toVideoMs(wallMs) {
  const absolute = t0 + wallMs;
  let consumed = 0;
  for (let i = 0; i < assembled.durations.length; i += 1) {
    const start = segmentStarts[i];
    const lengthMs = assembled.durations[i] * 1000;
    if (start === undefined) break;
    if (absolute < start) return consumed;            // fell in the preceding gap
    if (absolute <= start + lengthMs) return consumed + (absolute - start);
    consumed += lengthMs;
  }
  return consumed;
}

for (const m of marks) m.videoMs = Math.round(toVideoMs(m.ms));

writeFileSync(
  `${OUT}/marks.json`,
  JSON.stringify(
    {
      takeMs,
      takeSeconds: Number((takeMs / 1000).toFixed(2)),
      success: failure === null,
      failure,
      signingBeats: [],
      degraded,
      note: 'No signing beats: this app has no blockchain component.',
      newRuntimeErrors: errorsAfter.length,
      videoSegments: assembled.segments,
      segmentSeams: Math.max(0, assembled.segments - 1),
      marks,
    },
    null,
    2,
  ) + '\n',
);

// The log carries VIDEO time. That is what an edit cuts on; wall-clock time is
// kept in marks.json for diagnostics only.
writeFileSync(`${OUT}/marks.log`, marks.map((m) => `DEMO_LINE ${m.videoMs} ${m.id}`).join('\n') + '\n');

console.log(`\n  take        ${(takeMs / 1000).toFixed(1)}s`);
console.log(`  beats       ${marks.length}/${Object.keys(durations.lines).length}`);
console.log(`  new errors  ${errorsAfter.length}`);
console.log(`  video       ${assembled.file ?? 'NONE'} (${assembled.segments} segments)`);
console.log(`  result      ${failure === null ? 'SUCCESS' : `FAILED — ${failure}`}`);
process.exit(failure === null ? 0 : 1);
