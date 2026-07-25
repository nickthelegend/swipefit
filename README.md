# FITCHECK

**the face decides what you wear**

A swipe-to-shop app where every card is a live YouCam Apparel VTO render of the garment **on your own body** — not a stock photo. A one-time Skin AI scan at onboarding decides which items enter the deck and in what order. Right-swipes land in a multi-brand bag. Checkout takes no payment: it hands you off to each brand's real product page.

Built for the **YouCam API Skin AI & Apparel VTO Hackathon** (Perfect Corp / Devpost).

---

## The loop

```
two photos  →  skin scan  →  deck re-sorted around your undertone
            →  swipe (every card rendered on you)
            →  bag, grouped by brand
            →  handoff to the brand's own site
            →  brand console shows what that traffic is worth
```

## Which YouCam APIs are used

| API | Endpoint | Used for | Cost |
|---|---|---|---|
| **Apparel VTO** | `POST /s2s/v2.0/task/cloth-v3` | Every card in the deck | 2 units |
| **Skin Tone Analysis** | `POST /s2s/v2.0/task/skin-tone-analysis` | Skin, hair, eye, lip colour at onboarding | 20 units |
| **Skin Analysis** | `POST /s2s/v2.0/task/skin-analysis` | Condition scores driving beauty mode | 9–15 units |

Base URL `https://yce-api-01.makeupar.com`. Auth is a plain `Authorization: Bearer sk-...` — the v1.0 RSA handshake in older docs does not apply to v2.0 keys.

---

## ⚠️ Current API credit state

**The skin endpoints are out of credits on the bundled key.** Verified live:

| Endpoint | Cost | Status |
|---|---|---|
| `cloth-v3` (try-on) | 2 units | ✅ working |
| `skin-tone-analysis` | 20 units | ❌ `CreditInsufficiency` |
| `skin-analysis` | 9–15 units | ❌ `CreditInsufficiency` |

The 1,000-unit grant was consumed largely by iterating on demo-model face photos — each accepted skin-tone reading costs 20 units, and finding three faces the API would accept took many attempts.

The app handles this rather than breaking. Each bundled demo model ships with the `skin_color` hex a **real** `skin-tone-analysis` run returned for that exact file, and the scan falls back to it when the live call fails. The reveal screen then says `RECORDED` instead of `MEASURED` and explains why. Redeem a fresh code at Account → Redeem Code to restore live scanning; nothing in the code needs to change.

## Setup

```bash
npm install
cp .env.example .env      # then add your YouCam key
npx expo run:android      # or run:ios
```

`.env`:

```
EXPO_PUBLIC_YOUCAM_API_KEY=sk-...
EXPO_PUBLIC_YOUCAM_BASE_URL=https://yce-api-01.makeupar.com
```

**On an emulator, use a demo model.** The Android emulator's camera renders a synthetic test scene with no person in it, so the real capture flow cannot be exercised there. The bottom of the capture screen offers three bundled people spanning the skin-tone range. On real hardware the camera path works normally.

---

## How the skin-informed sort actually works

This is the part that is easy to fake and was not faked. `src/logic/color.ts` and `src/logic/matching.ts` carry the whole thing.

**The API gives us less than you'd expect.** `skin-tone-analysis` returns *no* undertone classification, *no* Fitzpatrick type and *no* concern list — only hex colours (`skin_color`, `hair_color`, `eye_color`, `lip_color`). Every warm/cool judgement in the product is derived locally from that hex, in CIELAB.

**Undertone** comes from the hue angle: skin contains both haemoglobin (pushes a\*, red) and melanin/carotene (pushes b\*, yellow), and undertone is the balance between them.

**The neutral axis is a curve, not a constant** — and this is the one thing most implementations get wrong. As L\* falls, b\* compresses faster than a\*, rotating the whole skin locus toward lower hue angles. A fixed threshold therefore reads *every* deep skin tone as cool. Verified against 18 reference tones spanning L\* 16–89: a fixed 46°/54° split misclassified espresso (`#3B2219`) as confidently cool; the lightness-adaptive axis lands it at neutral with 0.20 confidence, which is the honest answer. 13/14 labelled samples classify correctly, and the one miss sits at 0.40 confidence rather than being confidently wrong.

**Season** is classical four-season analysis over three axes: hue (undertone), value (depth), chroma (hair↔skin contrast).

**Scoring** runs three independent axes per garment — warm/cool agreement, clarity, and value contrast against the wearer — weighted 50/25/25. Garment temperature is continuous (`cos(h − 60°)` weighted by chroma) rather than a warm/cool tag, which is what makes black, oatmeal and indigo denim correctly behave as near-universal instead of being force-sorted onto one side.

**Low confidence produces a gentler sort.** The final score is pulled toward neutral in proportion to how uncertain the undertone reading was, so a borderline scan cannot claim a decisive match it can't justify.

**Verified divergence:** against a 24-item catalogue, a warm-light and a cool-light profile produce **24/24 items in different positions, with 0/6 overlap in the top six.** Reproduce it:

```bash
npx tsx scripts/check-matching.ts     # offline, no API calls
npx tsx scripts/smoke-pipeline.ts     # live: scan → sort → render
```

There is also a **live undertone override** on the deck header (tap your skin swatch). It re-sorts the same catalogue instantly, so the causal claim can be demonstrated in three seconds without a second person or another 20-unit scan. Anything it produces is labelled `Sim`.

---

## Engineering notes

**Renders run ahead of the cursor.** A `cloth-v3` render measures ~8–13 seconds. The first six are produced behind the "putting clothes on you" screen; after that the pipeline keeps four rendered ahead of wherever you are. A visible spinner behind every card is the exact failure mode this product is judged against.

**The render cache is load-bearing, not an optimisation.** The unit budget is 1,000 and a 24-card deck costs 48, so an uncached app burns the whole allowance in ~13 launches. Result URLs are presigned and expire after 2 hours, so caching means downloading the bytes, not remembering the URL. Cache key is `(person, product)`, so re-sorting after an undertone change costs nothing.

**Failed renders never remove a card.** A failure becomes a labelled card showing the flat product shot, still swipeable. One bad garment image cannot end a session.

**Concurrency is capped at 4.** The documented limit is 250 requests / 300 seconds enforced per-IP *and* per-token, with no elevated allowance for hackathon keys. Polling multiplies request count quickly.

**Strict-then-relaxed skin scan.** Units are charged on `success` only, so a rejected attempt is free. The scan tries `medium` face-angle strictness first and falls back to `flexible` only on an angle rejection — accuracy when the photo allows it, resilience when it doesn't, at zero extra cost.

**No backend.** Every call originates on the device.

---

## Things that are synthetic, and are labelled as such in the app

Listed here so nothing in the UI is mistaken for a measurement.

1. **Return-risk percentages** (`src/logic/reasoning.ts`) — a deterministic heuristic over category, cut, size-run breadth and colour match. It is built from published apparel-industry patterns, but it is **not** measured return data and no such data exists without a brand partnership. Every surface that shows a risk number also shows "Illustrative heuristic — not measured return data".
2. **Brand console baseline figures** (`src/logic/analytics.ts`) — synthetic per-SKU impressions and right-swipe rates, seeded deterministically so they don't reshuffle. The banner at the top of that screen says so. **The current session's swipes are real** and are layered on top; rows the session touched are marked `LIVE`, so a right-swipe on the deck visibly moves that SKU's bar.
3. **Beauty mode does not call the makeup-VTO API.** That is a separately-billed feature outside the judged track. Foundations are matched by ΔE from the measured skin hex and composited over your own face photo in-app; treatments are ranked against measured concern scores.
4. **Prices** are real as observed, but some Levi's and COS entries were captured at promotional rather than list price.
5. **The API key ships in the client bundle.** Acceptable for a hackathon key; a real deployment needs a proxy.

## Catalogue

24 real products across **Uniqlo, COS and Levi's** — 8 each, balanced 8/8/8 warm/cool/neutral, 13 upper-body / 10 lower-body / 1 full-body. Every `productImageUrl` is a verified-200 flat-lay of the garment alone; every `brandProductUrl` is a real product page.

`src/data/catalog.json` is plain data with no ids and no styling — ids, brand accent colours and mode tags are derived in `src/data/catalog.ts`, so dropping in a refreshed file is a one-file change.

`scripts/build_catalog.py` rebuilds the Uniqlo portion from their public commerce API. Note what it does **not** do: the original plan was an HTML scraper, but major retail sites render product grids client-side behind bot protection, so that returns nothing. It also does not trust the API's own flat-lay marker — the same URL path serves on-model photos for some colourways, and a model-worn garment reference produces a render of a person wearing a picture of another person. Flat-lays are detected by measuring skin coverage (in YCbCr, so it works across the tone range rather than only on light skin) and vertical extent.

---

## Layout

```
app/                       expo-router
  onboarding/              welcome → capture → scanning → result → preparing
  (app)/                   swipe · bag · brand   (custom tab bar)
  checkout.tsx             per-brand handoff
src/
  logic/color.ts           CIELAB, undertone derivation      ← the interesting part
  logic/matching.ts        seasonal analysis, deck sort      ← the interesting part
  logic/reasoning.ts       fit verdict + regret heuristic
  logic/analytics.ts       brand console figures
  services/youcam.ts       every API call, one module
  services/renderCache.ts  on-disk render cache
  store/useAppStore.ts     zustand + AsyncStorage, render pipeline
  theme/                   tokens extracted from byooooob.com
  ui/                      SwipeDeck, ProductCard, doodles, primitives
scripts/                   verification harnesses (not shipped)
```

Design system and its rationale: [DESIGN.md](DESIGN.md). Product truth and constraints: [PRODUCT.md](PRODUCT.md).

## Credits

Demo model photography from Pexels — Polina Tankilevitch, MART PRODUCTION, Jesutobiloba Precious. Product imagery and links belong to Uniqlo, COS and Levi's. Visual direction after [byooooob.com](https://byooooob.com).
