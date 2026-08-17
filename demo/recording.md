# SwipeFit — demo recording plan

Status: **PLAN ONLY. Nothing recorded yet, awaiting go-ahead.**

## Detection results (worked out, not assumed)

**This is not a blockchain app.** No wallet, no chain, no signing, no on-chain
anything — it is a swipe-to-shop app in front of existing retail, and the
"checkout" is deliberately a handoff to the brand's own site with no payment
path at all. So the entire wallet/testnet/signing branch of the brief does not
apply, and there are **no signing beats to flag**. Verified by grepping the
whole repo for wallet, chain, sign, tx and web3: nothing.

**The YouCam API is live.** Probed it directly: `skin-tone-analysis` accepted a
real photo and returned a real reading (`skin_color #b29076`, eye, hair, face
quality). Credits are **not** exhausted. This matters enormously — it means the
video can show the actual product claim happening for real, rather than the
fallback path.

> Note: the app previously claimed "the API key is out of credits" on every
> fallback. That copy was hardcoded and false. Fixed before planning this, so
> the take cannot show the app misdiagnosing itself.

**Supabase is gone.** The project subdomain no longer resolves — free tier,
paused, deleted. The brand console and the blind-vs-revealed comparison are the
only beats that need it. See "Decision required" below.

## Platform reality — the driver cannot be a DOM driver

The brief's driver spec (SVG cursor, `glide`, `typeInto`, click rings) assumes a
browser. SwipeFit is a **React Native Android app**. There is no DOM to inject a
cursor into and no way to render an SVG overlay above native views without
shipping demo-only code into the app, which would make the take staged.

Adapted honestly, keeping the intent (real interactions, one clock, named
failures):

| Brief | Android equivalent |
| --- | --- |
| `glide(x,y,ms)` SVG cursor | `scrcpy` shows real touch feedback; Android's own "Show taps" developer option draws the touch indicator. Real input, real visual. |
| click ring | Android "Show taps" overlay — the OS's own, not faked by us |
| `typeInto` ~24cps | `adb shell input text` per character with jitter — real key events |
| `until(label, pred, timeout)` | poll real UI state via `uiautomator dump` + named throw |
| `line(id)` | writes `DEMO_LINE <ms> <line-id>` to the mark log |
| `hold()` | sleeps this beat's **measured** audio duration + 0.45s |
| fixed window geometry + crop during capture | `adb shell screenrecord --size 1080x2400` — the device *is* the frame, already exact. No crop needed, nothing else on screen. |

`screenrecord` caps at 3 minutes per file, so the take is captured in segments
and concatenated losslessly, or driven through `scrcpy --record` which has no
cap. Preference: `scrcpy --record`, no time limit, no re-encode.

## Narration voice

Kokoro is **not installed** and pulling it in (torch, ~2 GB) the night before a
submission is a bad trade. Using macOS `say` with **Samantha** (en_US, the
highest-quality voice present) → AIFF → `ffmpeg` → WAV, then measuring every
file's **real** duration with `ffprobe`. Same one-clock guarantee; no estimates.

Say the word and I'll install Kokoro instead — it is better, it just costs time
and disk we may not want to spend tonight.

---

## Beats

Target ~2 min 40 s of app footage. `[NEEDS SUPABASE]` marks the two at risk.
No beat is a signing beat — this app has none.

| # | id | What happens on screen |
| --- | --- | --- |
| 00 | `intro` | Title card. Logo mark, "the face decides what you wear". *(HyperFrames, not device capture)* |
| 01 | `problem` | Hero screen held. The thesis headline is already the pitch. |
| 02 | `shopfor` | Tap "Women's" then "Both" on the Show-me picker — the one question the scan cannot answer. |
| 03 | `capture` | Capture screen. Two-shot framing explained; scroll to the bundled people. |
| 04 | `pickmodel` | Tap the deep-tone demo person. |
| 05 | `scanlive` | **Real** `skin-tone-analysis` call. Sweep animation runs while the network call is genuinely in flight. |
| 06 | `reading` | The reading lands: WARM / DEEP, Deep Autumn, confidence, measured hex. Emphasise this is derived in CIELAB, not returned by the API. |
| 07 | `deckopen` | "Build my deck" → prefetch → deck opens. Progress bar reads 60 of 60. |
| 08 | `tryon` | **Real** `cloth-v3` render: the garment on that person's actual body. The product's whole claim, live. |
| 09 | `matchwhy` | Tap the card to flip — the match score and the colour reason in words. |
| 10 | `blind` | Point out BRAND HIDDEN. Explain why the label is off before the decision. |
| 11 | `swiperight` | Swipe right. Brand reveal fires. Progress advances, bag count increments. |
| 12 | `swipeleft` | Swipe left on a poor match to show the sort is doing real work. |
| 13 | `bag` | Bag screen — multi-brand grouping, per-brand accents, running total. |
| 14 | `outfit` | **Build the fit**: two chained renders, top then bottom, on the same body. The money shot. |
| 15 | `handoff` | Handoff screen. No payment, ever — opens the brand's own product page. |
| 16 | `console` | `[NEEDS SUPABASE]` Brand console: friction, flagged SKUs. |
| 17 | `blindgap` | `[NEEDS SUPABASE]` Brand blindness — keep rate with the label hidden vs shown. The metric no retailer can run on their own shop. |
| 18 | `outro` | Closing card. Thanks. *(HyperFrames)* |

## Pre-flight (each of these has eaten a take)

- `adb shell pm clear com.swipefit.app` before driving — persisted onboarding,
  cart and render cache all survive reinstalls otherwise.
- Detect scan completion by the **result screen's own state**, not by a spinner
  disappearing — the spinner is a `withRepeat` animation that never stops.
- Disable notifications, set Do Not Disturb, and pin the app so no system
  dialog can steal the frame.
- Count logcat errors **before** the run; only treat the count *growing* as a
  failure.
- Record 2 s, pull a frame, verify it is not black before committing to the take.
- Renders cost units. A full take spends roughly 20 (tone) + 12 (concerns) +
  12 (six prefetch) + 4 (outfit chain) ≈ **48 units**. The session guard is 400,
  so a take plus two retries is comfortably inside budget.

## Decision required before recording

**Supabase.** Beats 16 and 17 are the strongest business case in the whole
video — brand blindness is genuinely the thing no competitor can measure. They
need a working project.

- **Restore it** (~5 min, yours to do): new project → URL + anon key into `.env`
  and `web/.env.local` → `npm run db:sql | pbcopy` → paste → `npm run db:verify`.
  Then I record all 19 beats.
- **Skip it**: I cut 16 and 17, and the video ends at handoff. Still a complete
  story, noticeably weaker close.

Everything else is ready to shoot.
