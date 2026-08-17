# SwipeFit — Devpost submission

Copy each block into the matching field. Anything marked **[YOU]** is yours to
answer or supply — I have not invented it.

---

## Project name

```
SWIPEFIT
```

## Elevator pitch (200 char limit)

```
One skin scan decides every garment you see. Sixty real products re-sorted to your undertone, each one rendered onto your own body before you ever see the brand name.
```
*(162 characters)*

---

## About the project

```markdown
## The shop is sorted for everyone except you

Every clothing app shows the same grid to every person. You scroll, you guess,
you order three sizes, you send two back. The decision that actually matters —
does this colour work against *my* skin, does this cut work on *my* body — is
the one you are asked to make from a photo of a model who is not you.

SwipeFit inverts it. One skin scan happens first, and it decides the entire
catalogue you are shown. Not a filter you apply afterwards. The sort order
itself.

## What it does

**One scan, then everything follows.** You look at the lens. YouCam Skin AI
returns your skin tone and a fourteen-metric skin condition reading. From that
single scan the app derives your undertone, depth and season, then re-sorts all
60 products against it. Three different people scanning produce three genuinely
different decks from the same catalogue — which is the whole point.

**Every card is you, not a model.** Each garment is rendered onto your actual
body through YouCam Apparel Virtual Try-On before it reaches the deck. The card
you swipe on is the claim: this is what it looks like on you.

**Blind mode: the brand is hidden until you decide.** Cards show the garment,
the price, and the match score — no logo, no brand name. You judge the clothes.
The name is revealed only after you swipe right. The app then shows you the gap
between what you chose blind and what you would have chosen with the labels
visible, which is a number most shopping apps would rather you never saw.

**It tells you why.** Tap a card and it explains the score in words —
"terracotta runs warm, same direction as your warm undertone" — plus fit notes
and a return-risk heuristic. Every claim is traceable to a number the API
returned.

**Outfits, not items.** Bag a top and a bottom and it renders the complete
outfit on you in one pass, with a running total across brands.

**Handoff, not checkout.** SwipeFit never takes payment. Every item opens the
brand's own product page. It is a discovery layer, not a competing store.

**A brand console.** Brands see aggregate demand by tone bucket — which
undertones are swiping right on which garments — without ever receiving a face,
a photo, or a scan.

## How we built it

Expo 57 / React Native 0.86 / React 19 with expo-router and Reanimated 4.5,
Supabase for catalogue, auth and the brand console, and a Next.js web surface
for brands. Sixty real products across nine real brands — A.P.C., COS, H&M,
Levi's, Massimo Dutti, Outerknown, Sunspel, Uniqlo and Zara — split 30
upper-body, 26 lower-body, 4 full-body so the try-on categories map cleanly onto
`cloth-v3`.

Three YouCam endpoints do the work: `skin-tone-analysis` and `skin-analysis` for
the reading, and Apparel VTO `cloth-v3` for every render.

The matching runs in CIELAB, not RGB. Skin tone and garment colour are both
converted to Lab, and the score is built from the angular distance between their
hue vectors plus a lightness-contrast term. Hue direction is what "warm" and
"cool" actually mean perceptually; RGB distance would have called a muddy brown
a great match for terracotta.

## What we learned

**The API gives you measurements, not conclusions — and that is correct.**
`skin-tone-analysis` returns colour. It does not return "you are a Deep Autumn",
because that is a styling opinion and an API has no business asserting one. We
derive undertone, depth and season ourselves in CIELAB and label them in the UI
as *derived*, with the raw hex values shown next to them. Being explicit about
which numbers are measured and which are inferred made the product more
trustworthy, not less.

**Raw scores and display scores are different things.** `skin-analysis` returns
both a raw score and a friendlier display score per metric. We show the raw one
and say so. A redness reading of 100 is more useful to a person than a polished
72.

## Challenges we ran into

**The try-on API will not chain its own output.** Building a full outfit means
rendering a top onto you, then rendering trousers onto *that result*. Handing
the API its own result URL back as an input fails. The fix was to keep the
original body image as the anchor for every pass and composite forward, never
feeding a generated URL back in. This was the single biggest architectural
constraint in the app and it is now enforced in code rather than remembered.

**Renders fail, and pretending otherwise is worse than failing.** Try-on
occasionally returns `error_download_image`. The app shows "TRY-ON UNAVAILABLE —
the render failed" on the card with the real error code, and falls back to the
product photo. It never silently swaps in a stock image and lets you believe it
is you. A demo take that captured a genuine failure was kept honest rather than
re-shot until it looked clean.

**Gendered catalogues are a real modelling problem.** A unisex-by-default
catalogue produces bad decks for everyone. We added explicit gender targeting
(34 men, 19 women, 7 unisex) with an onboarding preference and a deck-level
filter, so the sort has something meaningful to sort.
```

---

## Built with

```
expo, react-native, react, typescript, supabase, nextjs, expo-router,
react-native-reanimated, zustand, youcam-skin-ai, youcam-apparel-vto,
perfect-corp-api, cielab, postgres, android, ffmpeg, python
```

---

## "Try it out" links

- `https://github.com/nickthelegend/swipefit`
- **[YOU]** APK download link, if you host the signed release.

## Video demo link

**[YOU]** Upload `demo/final/swipefit.mp4` (3m21s) to YouTube as **unlisted or
public**, then paste the link. Devpost cannot embed a private video.

Suggested title and chapters are in `demo/final/PUBLISH-KIT.md`.

## Image gallery

Best five, 3:2 crops from the app:

1. The deck — a real try-on render with the match score and BRAND HIDDEN
2. The reading — undertone, season and the CIELAB swatches
3. The detail card — the written "why this scored what it scored"
4. The outfit builder — top and bottom rendered together with a running total
5. The brand console — aggregate demand by tone bucket

---

## Additional info (judges and organizers)

### Submitter type
**[YOU]** — Individual or Team.

### Country of residence
**[YOU]**

### App status
```
Existing — built during the submission period
```
Started **07-26-26**. If the form treats any pre-existing scaffold as "Existing",
state: the entire skin-scan pipeline, CIELAB matching, blind mode, outfit
chaining and brand console were built during the submission period.

### Date started (MM-DD-YY)
```
07-26-26
```

### Text description — features, functionality, consumer and retail value

```
SwipeFit is a mobile shopping app in which a single skin scan determines the
entire catalogue a shopper sees.

FEATURES
- Live skin scan via YouCam Skin AI (skin-tone-analysis + skin-analysis),
  returning skin tone plus a 14-metric condition reading.
- Undertone, depth and season derived in CIELAB from the returned colour, shown
  alongside the raw measured hex values and labelled as derived.
- 60 real products across 9 real brands, re-sorted per shopper by hue-vector
  distance between garment colour and skin tone in Lab space.
- Every card rendered onto the shopper's own body via YouCam Apparel Virtual
  Try-On (cloth-v3), not shown on a model.
- Blind mode: brand names and logos hidden until after the swipe, then the app
  surfaces the gap between blind and branded preference.
- Written explanations for every score, plus fit notes and a return-risk
  heuristic.
- Outfit builder chaining multiple garments onto one body with a cross-brand
  running total.
- Brand console showing aggregate demand by tone bucket, with no face, photo or
  scan ever leaving the shopper's device.

CONSUMER VALUE
The shopper sees clothes on their own body, in colours matched to their own
skin, before buying. The two most common reasons for a return — wrong colour
against skin, wrong cut on body — are answered before the order, not after it.

RETAIL VALUE
Returns are the dominant cost in online apparel. A shopper who has already seen
the garment on themselves orders with far more confidence. Brands additionally
receive demand signal segmented by skin tone — which garments genuinely appeal
across the tone range — which is information no current analytics stack gives
them. SwipeFit takes no payment and competes with no one: every item hands off
to the brand's own product page.
```

### Repository URL
`https://github.com/nickthelegend/swipefit`

---

## Was there a moment where the API surprised you?

```
Yes — twice, and in opposite directions.

The good surprise: skin-tone-analysis refuses to tell you what it does not
measure. It returns colour, not "you are a Deep Autumn". I expected a styling
verdict and initially read its absence as a gap. It is the opposite of a gap.
Undertone and season are interpretations, and an API asserting them would be
inventing authority it does not have. That restraint pushed us to do the
derivation ourselves in CIELAB and to label it in the UI as derived, with the
raw hex shown next to it. The product is more honest because the API declined
to be.

The frustrating one: Apparel VTO will not accept its own output as an input.
Chaining a top and then trousers onto the same person seems like it should be
render-then-render-again, and handing the API a result URL back fails. Once we
stopped fighting it and kept the original body image as the anchor for every
pass, outfit chaining worked reliably. It cost us an afternoon and it is now the
single most important rule in our try-on layer.
```

---

## Industries or use cases nobody is talking about yet

```
UNIFORM AND WORKWEAR PROCUREMENT. Hospitals, airlines, hotels and schools issue
one palette to entire workforces, chosen by a committee looking at fabric
swatches. Skin Analysis across a workforce would show which palette options
actually work across the real tone range of the people who have to wear them
every day, rather than the range of the people who picked them.

COSTUME AND CASTING. Wardrobe departments do camera tests to find out how a
colour reads against a performer's skin under lights. That is exactly a
tone-to-garment question, and it is currently answered by shooting film.

RETURNS UNDERWRITING. Return rate is partly predictable from the gap between a
garment's colour and a buyer's undertone. An insurer or a marketplace could
price that risk per transaction. We ship a naive version as a return-risk
heuristic and label it as a heuristic — a real model trained on outcome data
would be a genuine financial product.

DERMATOLOGY TRIAGE WAITLISTS. Skin Analysis returns redness, texture and pore
metrics. Not a diagnosis, and it must never be presented as one — but as a way
to prioritise a queue of people already waiting for an appointment, an objective
repeatable measurement beats self-reported severity.

SECOND-HAND AND RESALE. Resale listings are photographed on hangers or on
sellers who are not the buyer. Apparel VTO could put a one-off vintage piece on
the actual buyer, which matters far more when the item is unique and
non-returnable.
```

---

## Where did you hit a wall technically? How did you work around it?

```
THE WALL: Apparel VTO does not chain. Building an outfit means rendering a top
onto a person and then rendering trousers onto that result, and feeding the API
its own generated result URL as the next input fails. Outfit building was a core
feature and it was dead.

THE WORKAROUND: the original body image stays the anchor for every pass. Each
garment is rendered against that same source rather than against the previous
output, and the results are composited forward. Outfit chaining now works across
multiple garments and multiple brands. The rule is enforced in code — passing a
generated URL back as an input throws by name — rather than left as something a
future contributor has to remember.

A SECOND WALL, IN OUR OWN TOOLING: we automated the demo recording, and it lied
to us repeatedly. Android's screenrecord restarts between segments and the gap
is absent from the concatenated file, so our beat marks drifted ahead of the
picture until the final marks pointed past the end of the video. Then ffmpeg's
setpts and tpad filters left stale duration metadata, so clips silently rendered
at up to double their intended length. Every one of these reported success.

The fix in both cases was to stop trusting reported state and measure the real
thing: marks are now recorded in video time computed from each segment's actual
duration, every clip length comes from ffprobe, and a clip that runs longer than
its narration fails loudly by name instead of quietly shipping. The lesson
generalises well past video — a pipeline that cannot fail is a pipeline that
cannot tell you it is wrong.
```

---

## Social posts

**[YOU]** — optional field, leave blank if you have not posted.

---

# Repository — done

Pushed and private: **https://github.com/nickthelegend/swipefit**

The hackathon requires the repo be public with licensing, or private and shared
with `contact_event@PerfectCorp.com`. It is private and MIT-licensed, so either
share it with that address, or make it public:

```bash
gh repo edit nickthelegend/swipefit --visibility public
```

**Secrets: checked, and clean.** The YouCam key is read from `process.env` in
`src/services/youcam.ts:21` — never a literal. `.env` and `.env.local` are
gitignored (`.gitignore:44-45`), and only `.env.example` is tracked. Nothing to
scrub before pushing.

**One size note:** `demo/handoff/` is 68 MB of raw take. Either use `git lfs`,
or leave the raw footage out of the repo and link the video separately — judges
need the source, not the 563-second uncut recording.
