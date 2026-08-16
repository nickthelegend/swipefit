# FITCHECK demo — handoff

Two sets, because the brief was given in two parts: the raw take with its marks,
and the finished cut made from it.

## Raw (recording pass — no editing applied)

| File | What it is |
| --- | --- |
| `raw-take.mp4` | The take, exactly as captured. 1080x2400, 563.5s, 20/20 beats. |
| `marks.log` | `DEMO_LINE <ms> <line-id>` in **video time**. |
| `marks.json` | Same, plus wall-clock, measured spans and per-beat degradation. |
| `narration/` | 20 WAVs, one per line. |
| `durations.json` | Every duration **measured with ffprobe**, never estimated. |
| `bgm.wav` | Music bed, 215.8s, measured at -25.8 LUFS. |
| `narration.json` | The script. |
| `recording.md` | The plan, and the two detections behind it. |

**No signing beats.** This app has no blockchain component — verified by grepping
the tree for wallet, web3, ethers, solana, algorand, sign and mainnet. No testnet
key was needed and none was injected. `signingBeats` is empty in `marks.json` for
that reason, not because the step was skipped.

**Marks are in video time, not wall clock.** screenrecord restarts between
segments and each ~5s gap is absent from the concatenated file, so wall-clock
marks drift ahead of the picture — on the first take the final mark landed 40s
past the end and the last two beats had no footage under them. `marks.json`
keeps both: `videoMs` is what an edit cuts on, `ms` is kept for diagnostics.

## Finished cut

`../final/fitcheck.mp4` — 3m21s, burned-in captions.
`../final/fitcheck-clean.mp4` — same cut, no captions.
`../final/fitcheck.srt` — the cues.
`../final/PUBLISH-KIT.md` — title, chapters, links.

## One honest note about the cut

The `tryon` and `matchwhy` narration lines are swapped relative to the original
plan. Dismissing the coach overlay taps the card underneath and flips it, so the
card sits on its detail side for the tryon span and shows the render for the
matchwhy span. Rather than narrate "that garment, rendered onto that body" over
a card whose render was not on screen, each line was moved to the span that
actually shows what it describes. Checked frame by frame.

## Reproducing

```
npm run demo:tts      # narration + measured durations
npm run demo:bgm      # music bed
npm run demo:drive    # record a take (~60 API units)
npm run demo:cut      # assemble from the marks
npm run demo:finish   # intro/outro, captions, music, publish kit
```
