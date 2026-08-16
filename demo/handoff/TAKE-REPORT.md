# FITCHECK demo — take report

**Result: partial. 17 of 20 beats, 340s of real footage, no edit applied.**

The three missing beats are the closing argument — brand console, brand
blindness, outro. They are not in any take. Everything before them is.

Everything below was captured from the signed release APK on a real device,
talking to the live API over the real network. Nothing is staged, mocked or
re-enacted.

## What is in this folder

| File | What it is |
| --- | --- |
| `fitcheck-raw-take.mp4` | The take. 1080x2400, h264, 340s, three concatenated segments. |
| `marks.log` | `DEMO_LINE <ms> <line-id>` — when each beat actually started. |
| `marks.json` | Same, plus measured durations and the failure record. |
| `narration/` | 20 WAV files, one per line. |
| `durations.json` | Every duration **measured with ffprobe**, never estimated. |
| `bgm.wav` | Music bed, 215.8s, measured at -25.8 LUFS. |
| `narration.json` | The script. |
| `recording.md` | The plan, and the two detections behind it. |

## No signing beats

This app has no blockchain component. Verified by grepping the whole tree for
wallet, web3, ethers, solana, algorand, sign and mainnet — no matches. No
testnet key was needed and none was injected. `signingBeats` is empty in
`marks.json` for that reason, not because the step was skipped.

## Beats captured

All 17 marks are in `marks.log`. The ones that matter:

- **`scanlive` / `reading`** — a genuinely live YouCam skin call. The frame
  reads `MEASURED BY YOUCAM`, skin `#634733`, hair `#0E0B0E`, lips `#734944`,
  with the CIELAB note and the full skin-condition panel. The driver aborts the
  take if this shows `RECORDED`, so its presence is proof the live path ran.
- **`tryon`** — real `cloth-v3` renders. The card shows that person actually
  wearing the terracotta linen pants at MATCH 85, and later the merino polo at
  MATCH 79. This is the product's central claim, on camera, for real.
- **`blind` / `swiperight` / `reveal`** — brand hidden before the decision,
  revealed after, deck counting down 60 → 57, bag filling.

## What fell short, and why

**`outfit` — the render failed on camera.** The frame shows the app's own
message: *"Could not build it — The render failed (error_download_image)."*

That is left in. It is a real failure of a real chained render — the top's
output URL could not be fetched as the input for the bottom — and the brief is
explicit that a take shows the app failing rather than hiding it. It is also
worth fixing properly rather than papering over: presigned result URLs are
short-lived, and chaining one render into the next races that expiry.

**`console`, `blindgap`, `outro` — not captured.** The take aborted at `handoff`
when navigation out of the outfit screen timed out. The last three beats have
narration and durations ready; only the footage is missing.

## The API is now out of credits

This matters more than the missing beats.

```
"Your account doesn't have enough credits to complete this request."
error_code: CreditInsufficiency
```

That is my doing. Reaching a clean take took about ten full runs, and each one
spends roughly 45-60 units — 20 for the skin tone, 12 for the concerns, 12 for
the deck prefetch, plus the outfit chain. The grant was live at the start of the
session and is exhausted now.

The app is behaving correctly about it: the scan falls back to a recorded
reading and labels itself `RECORDED` with the real reason, which is exactly the
degradation that was designed. But **no further live takes are possible until
credits are topped up**, and neither are the three missing beats.

## Four bugs in the recording harness, not the app

Recorded because each one produced a convincing false report about FITCHECK:

1. The pre-flight luma check read ffmpeg's stdout while `signalstats` reports
   through lavfi frame tags. It scored every frame 0 and failed two takes for a
   black screen while the recorder was working perfectly.
2. `dumpUi` did not delete the previous dump. uiautomator leaves the old file
   when it refuses to run, so a stale hierarchy still parsed — a bag that had
   just gained an item kept reporting zero.
3. The deck-open wait watched for the reading screen leaving, which happens the
   moment the *preparing* screen mounts, a minute before the deck exists. The
   coach overlay was therefore never dismissed, and being full-screen it ate
   every swipe. An entire take sat at `60 LEFT OF 60` while looking, frame by
   frame, exactly like it was being swiped.
4. `screenrecord` emits ~1MB of codec config per call and blew execFileSync's
   default buffer, throwing with the whole log as the error message.

## The closing beats: attempted three times, not captured

After credits ran out I tried to capture `console`, `blindgap` and `outro`
separately. Those three are computed entirely from local swipe telemetry, so
they are identical whether the scan ran live or fell back — capturing them at
zero units is legitimate, not a cheat. It still did not work:

- **Attempt 1** filmed the Android search screen. The app had been exited by a
  stray fallback tap minutes earlier and the harness reported SUCCESS anyway,
  because it only checked that beats were *marked*. Fixed: `line()` now refuses
  to mark a beat unless FITCHECK is genuinely the focused app.
- **Attempt 2** truncated. `screenrecord` writes its moov atom only on a clean
  exit, so killing the in-flight segment produced a 110KB fragment. Fixed:
  segments are now 60s and the last one is allowed to finish.
- **Attempt 3** reached the bag — four items across four brands, $294, good
  footage — but the Brand tab never opened, and the emulator switched to another
  app entirely partway through.

The honest summary is that the closing beats are **not** in any usable take.
What exists for them is narration, measured durations, and a driver that now
navigates to the console without the back key that was exiting the app.

## To finish this

1. Top up the YouCam grant.
2. `npm run demo:drive` — the harness is fixed and reaches `handoff`
   consistently now; the three closing beats need one clean run.
3. Fix the chained-render URL expiry so the `outfit` beat succeeds, or accept
   the honest failure frame that is already captured.

No editing has been applied, per the brief. `marks.log` is what an editor aligns
the narration to.
