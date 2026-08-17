# Product

<!-- impeccable:product-schema 1 -->

## Platform

android

## Users

Primary: a 20–35 year old phone-first online shopper who browses clothing far more than they buy, and who has been burned by returns. They shop in short bursts — commute, sofa, bed — and they abandon carts because they cannot picture the garment on *themselves*, only on a 6'1" studio model.

Secondary (dashboard surface only): a retail brand's e-commerce or merchandising analyst, evaluating whether this discovery layer sends them qualified traffic.

Judging audience (real, and a design constraint): a hackathon panel scoring Technological Implementation, Design, Potential Impact, and Quality of Idea, on a submission deadline of **2026-08-17**.

## Product Purpose

SWIPEFIT turns clothing discovery into a swipe deck where **every card is the garment rendered on the shopper's own body**, not a stock photo. A one-time skin scan at onboarding decides what enters the deck and in what order.

Success is a shopper reaching the end of a session with a small cart of items they can picture themselves in, and a lower rate of "I bought it and sent it back."

## Positioning

Two AI capabilities that the market ships as separate features — skin analysis and apparel virtual try-on — are wired into a single causal chain here: **the face decides what you wear.** The skin scan is not a beauty side-quest; it is the sort key for the clothing deck.

SwipeFit is a discovery and try-on layer that sits *in front of* existing retail. It never takes payment. Checkout is a handoff: each item deep-links to the brand's own product page. That makes brands partners rather than competitors, and makes swipe data the thing of value.

## Operating Context

- Phone, held one-handed, thumb-driven. Sessions are short and interruptible.
- Onboarding requires two photographs: a forward-facing face shot and a standing full/upper-body shot. These are different photos with different technical requirements and cannot be collapsed into one.
- Network-dependent: every card requires a remote render. Renders take ~8 seconds each, so they must be produced ahead of the swipe cursor, never on demand.
- Demo/eval context: the app is run on an Android emulator with no usable camera. A bundled demo-model path is a functional requirement, not a convenience.

## Capabilities and Constraints

**Confirmed working (verified live against the API, not from documentation):**
- Auth is a plain `Authorization: Bearer sk-...` header. No RSA handshake, no token exchange.
- Base URL `https://yce-api-01.makeupar.com`.
- Apparel VTO: `POST /s2s/v2.0/task/cloth-v3`, where `src_*` is the person and `ref_*` is the garment. `garment_category` ∈ `full_body | lower_body | upper_body | shoes | auto` is required when a garment reference is supplied. Result URL lands at `data.results.url`. Measured latency ~8s. Verified end-to-end producing a photoreal render.
- Garment images may be passed as `ref_file_url` — a public CDN URL — so the catalog needs no upload step at all.
- Skin tone: `POST /s2s/v2.0/task/skin-tone-analysis`. Skin analysis: `POST /s2s/v2.0/task/skin-analysis` with `format:"json"`.
- File upload is a 3-step flow (request slot → PUT to presigned S3 → use `file_id`). **There is no confirm call**; skipping the PUT surfaces as a 500 at task-run time, not as a clear error.

**Constraints:**
- **The bundled key's skin endpoints are exhausted** (`CreditInsufficiency`, verified live). `cloth-v3` still works. Demo models therefore carry a recorded real reading of their own photo, surfaced as `RECORDED` rather than presented as a live measurement.
- Unit budget is **1,000 units total**. Cloth VTO costs 2 units; skin tone costs 20; skin analysis SD costs 9–15. A full 24-card deck is 48 units, so roughly 13 complete runs exist. A persistent on-device render cache is therefore load-bearing, not an optimization.
- Rate limit 250 requests / 300 seconds, enforced per-IP *and* per-token. Concurrency must be capped.
- Units are charged on `success` only; `running` polls and `error` results are free.
- Result download URLs expire after 2 hours; `task_id` stays valid 30 days.
- Input framing is strict: skin analysis wants the face at 60–80% of image width and near-frontal (a downward head tilt returns `error_face_angle_downward`); VTO wants a single standing forward-facing person filling ~80% of frame.
- No backend. Every call originates from the device; the key ships in the client. Acceptable for a hackathon key, and recorded here as a known production gap.

**Undecided / deliberately out of scope:**
- Real payment processing — permanently out of scope by design, not by timeline.
- Real return-rate modeling. v1 ships a labeled illustrative heuristic.
- Live multi-brand catalog integration. v1 uses a curated 24-SKU catalog.
- No demo video is being produced (user's explicit instruction).

## Brand Commitments

- Name: **SWIPEFIT**. Tagline: *the face decides what you wear.*
- The visual world is pinned by the user to **byooooob.com**, with tokens extracted from the live site rather than described from memory. The pin is binding; it is recorded in DESIGN.md.
- Voice: blunt, confident, lowercase-body / SHOUTING-DISPLAY. Never twee, never corporate-cheerful.

## Evidence on Hand

- Live-verified YouCam API integration spec, including a successful `cloth-v3` render (1024×1536 JPEG) produced during this build.
- Design tokens extracted from byooooob.com's computed styles.
- Curated 24-SKU catalog with real brand product-page URLs and real CDN image URLs.
- Bundled demo-model photographs spanning three skin-tone ranges, with photographer credits.

**Absences future work must not paper over:** there is no real return-rate data, no real brand partnership, no real user base, and no analytics history. The dashboard's baseline figures are synthetic and must stay labeled as such.

## Product Principles

1. **The render is the product.** A card showing a stock photo has failed, no matter how good the surrounding UI looks.
2. **Never make the user wait on a card.** Renders run ahead of the cursor. A visible spinner reads as "API wrapper," which is the exact failure this product is judged against.
3. **The skin scan must visibly change the deck.** If a viewer cannot see the causal link between the scan and the ordering, the central idea did not ship.
4. **Honest about what is synthetic.** Illustrative statistics are labeled illustrative, on the card, in the product's own voice — not buried in a footnote.
5. **Degrade, never crash.** A failed render becomes a labeled card that still swipes. The deck never dies.

## Accessibility & Inclusion

- Skin-tone coverage across the full range is a correctness requirement, not a diversity gesture: an algorithm tuned on light skin produces visibly worse matches on deep skin, and the demo models are chosen to expose that.
- Touch targets ≥48dp with ≥8dp separation; type in `sp` so it honors the system font-size setting.
- Swipe is the primary input and is gesture-only by explicit user decision; a first-run coach overlay teaches it, and every card's decision is reversible via undo.
- System Back must always work and must never be trapped.
