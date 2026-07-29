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

**How the first grant was spent** — recorded so it is not repeated:

| Consumer | Est. units |
|---|---|
| Searching for demo-model faces — ~60 candidates through `skin-tone-analysis` | ~500–800 |
| Verification scripts (`smoke-pipeline`, `check-faces`, `check-divergence`) | ~160 |
| On-device testing — 2 onboardings + ~26 deck renders | ~110 |
| API validation probes | ~15 |

The dominant cost was an **unbounded verification loop against the most expensive endpoint**. `skin-tone-analysis` bills 20 units per success — ten times a try-on — and the search was given a target lightness the API cannot actually return (it compresses toward a canonical skin range and tops out near L\* 68), so it iterated far past the point of diminishing returns. Units bill on `success` only, which makes exactly this pattern invisible until the balance is gone.

`src/services/youcam.ts` now enforces a per-session unit ceiling (`EXPO_PUBLIC_YOUCAM_UNIT_BUDGET`, default 400) and logs running spend in dev. For reference, real usage is small: **~85 units for a complete run** — one skin scan (29) plus a full 24-card deck (48) plus a couple of outfit chains.

Also worth checking before assuming a grant is spent: the 1,000 hackathon units arrive as a **redeem code by email after Devpost registration**, applied at Account → Redeem Code. A key that never had the code applied is running on a much smaller default balance.

The app handles this rather than breaking. Each bundled demo model ships with the `skin_color` hex a **real** `skin-tone-analysis` run returned for that exact file, and the scan falls back to it when the live call fails. The reveal screen then says `RECORDED` instead of `MEASURED` and explains why. Redeem a fresh code at Account → Redeem Code to restore live scanning; nothing in the code needs to change.

## Supabase — cross-session telemetry

On-device the brand console is honest but tiny: one person, one session. Supabase makes the same measurements aggregate across every session and device, which is the difference between "here is what I did" and "here is what shoppers do".

**One-time setup:** open the Supabase dashboard → **SQL Editor** → paste [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) → Run. Until you do, the app runs exactly as before — every telemetry call is fire-and-forget and returns null on failure.

**Security posture, deliberate:**

- The app ships the **publishable (anon)** key only. The service-role key bypasses Row Level Security entirely; putting it in a mobile bundle would hand full read/write on the database to anyone who unzips the APK. It is not in `.env` and must never be.
- Anon may `INSERT` telemetry and may `SELECT` only the aggregate views (`sku_signal`, `undertone_signal`, `reach`). There is no SELECT policy on the base tables, so one shopper's individual behaviour cannot be pulled out of the app.
- **No photograph is ever uploaded.** Images go to the render API and the device cache, nowhere else.
- The skin reading is stored as **L\* plus the undertone bucket** — not the measured hex. Enough to segment a cohort, not enough to reconstruct a face.
- Sessions are keyed by a random locally-generated device id. No account, no email, no name.

Writes are debounced 2.5s and carry a unique `client_key`, so a retry after a dropped connection cannot double-count a decision.

## Setup

```bash
npm install
cp .env.example .env      # then add your YouCam key
npx expo run:android      # or run:ios

npm run verify            # lint + both typechecks + tests — what CI runs
npm test                  # tests only, no network, ~150ms
npm run db:sql | pbcopy   # schema, as one paste — see Telemetry below
npm run db:verify         # confirm the schema landed, using only the anon key
npm run check:links       # 120 catalogue URLs against the live web (slow)
```

## Releasing an APK

```bash
npm run apk:build         # ./gradlew assembleRelease
npm run apk:publish       # verify the signature, copy to the site, record SHA-256
```

Release builds are signed by `plugins/withReleaseSigning.js`, a config plugin
rather than a hand edit — `expo prebuild` regenerates `android/` from scratch, so
anything written directly into `build.gradle` survives only until the next
prebuild. Expo's default signs release with the **debug** keystore, which ships
in every React Native project with the password `android`; an APK signed with it
can be updated by anyone and Play will not accept it.

The keystore is gitignored. A private signing key in a repository is one that
anyone with read access can publish a convincing update with. To create one:

```bash
mkdir -p credentials
keytool -genkeypair -v \
  -keystore credentials/fitcheck-release.keystore \
  -alias fitcheck -keyalg RSA -keysize 2048 -validity 10000
```

Then set `FITCHECK_KEYSTORE_PASSWORD`, `FITCHECK_KEY_ALIAS` and
`FITCHECK_KEY_PASSWORD`, or accept the development defaults in the plugin.

**Back the keystore up.** Android identifies an app by its signing key, so losing
it means never being able to update this package name again — the only route is
a new listing.

`apk:publish` refuses to publish anything it cannot prove is release-signed, and
fails rather than skipping the check when `apksigner` is missing. It writes the
SHA-256 onto the download page: a sideloaded APK passes no store review and the
user had to dismiss a warning to install it, so the hash is the only way they can
confirm the file they got is the file that was built.

`.env`:

```
EXPO_PUBLIC_YOUCAM_API_KEY=sk-...
EXPO_PUBLIC_YOUCAM_BASE_URL=https://yce-api-01.makeupar.com
```

**On an emulator, use a demo model.** The Android emulator's camera renders a synthetic test scene with no person in it, so the real capture flow cannot be exercised there. The bottom of the capture screen offers three bundled people spanning the skin-tone range. On real hardware the camera path works normally.

**`expo prebuild` wipes `android/local.properties`,** so the next Gradle run fails with "SDK location not found". Export `ANDROID_HOME` (or rewrite that file) before building.

**If the emulator will not boot, run it headless.** The windowed emulator crashes on this machine with `Failed to find ColorBuffer: NNN` — a renderer bug, not an app problem — and then blocks on a crash-consent dialog, so it looks like a slow boot rather than a dead one. Headless skips that path entirely and boots in about 30 seconds:

```bash
emulator -avd <name> -no-window -no-audio -no-boot-anim -no-snapshot-load -no-metrics \
  -gpu swiftshader_indirect &
adb wait-for-device
```

`adb exec-out screencap -p > shot.png` and `adb shell input tap X Y` both work headless, which is enough to drive and inspect the UI.

**One Metro only.** Two bundlers contending for port 8081 leaves the dev client unable to reach either, and the symptom is an app that renders correctly but ignores every touch — which reads exactly like broken event handling. `lsof -ti:8081` before blaming a component.

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

## Build the fit

The try-on API takes one garment per call, so every deck card renders a new top over whatever trousers you happened to be photographed in. **Build the fit** removes that limit by chaining: the rendered top is fed back in as the *input person* for the bottom render, so the result is one image of a complete outfit on your own body.

Reachable from the bag once you have both halves. Only the second call costs units — the top is reused from the deck cache.

## Decision friction — the measurement nobody else has

A retailer already knows its conversion rate. What it has never been able to see is the **hesitation before the buy**, and that is where returns begin. Four signals are captured directly from the gesture layer, and all four are real:

| Signal | What it captures |
|---|---|
| `dwellMs` | How long the card was on top before the decision committed |
| `inspected` | The card was flipped to read the breakdown first |
| `hesitated` | The commit threshold was crossed, then retreated from |
| `undone` | The decision was reversed |

These combine into a per-SKU friction score. The console also reports **colour rejection**: how often pieces that fight the shopper's undertone are kept versus pieces that flatter it — invisible to ordinary retail analytics, because the shoppers who reject a colourway never click anything.

Rates are suppressed below three observations per bucket. A percentage off one swipe is noise dressed as a finding.

## Things that are synthetic, and are labelled as such in the app

Listed here so nothing in the UI is mistaken for a measurement.

1. **Return-risk percentages** (`src/logic/reasoning.ts`) — a deterministic heuristic over category, cut, size-run breadth and colour match. It is built from published apparel-industry patterns, but it is **not** measured return data and no such data exists without a brand partnership. Every surface that shows a risk number also shows "Illustrative heuristic — not measured return data".
2. ~~Brand console baseline figures~~ — **removed.** An earlier version seeded synthetic per-SKU impressions and swipe rates. That was deleted rather than relabelled: invented numbers prove nothing and quietly undermine the real ones next to them. The console now reports only measured behaviour, and says so on its face.
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
