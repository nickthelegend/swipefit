# Design

<!-- impeccable:design-schema 1 -->

## Direction contract

**THESIS.** A shopping app where the merchandise is *you*. The card is not a product tile with a photo in it — the card **is** the photograph of you wearing the thing, edge to edge, and every piece of chrome is a sticker slapped on top of it. This refuses the category default: the e-commerce grid of equal white cards with a centered product cutout, a name, a price, and a heart icon.

**OWN-WORLD.** Warm paper-grey ground `#EEEEEC`. Everything contained is outlined in 1–2px pure black — never a border-radius under 9px, never a shadow that isn't `4px 5px 0 #000` with zero blur. Five saturated flats that never blend: violet, tomato, acid yellow, bubblegum, forest. Type is Archivo, and it is either enormous and shouting in uppercase with -0.03em tracking, or it is quiet sentence-case body at 15–17sp. Nothing in between. Hand-drawn ink doodles — starburst, googly eyes, chevron trio, cursor arrow, squiggle — sit *on top of* content at rotations, never in a neat icon slot. Recognizable with all content removed by: cream ground, black hairline outlines, hard offset shadow, pill everything, flat color blocks that own whole regions.

**STORY.** "It analyzed my face and now it's showing me clothes that suit me, on my actual body." The visitor sees their own photograph wearing a garment before they read a single product name. They understand the sort order is causal, not random, because the card says which undertone it matched and why. They leave with a small bag and the sense that they were told the truth about fit.

**FIRST VIEWPORT (deck).** The card is the screen — a 16dp gutter and nothing else, so the stack behind stays visible but the render dominates. Inside the card there is no padding at all: the render runs edge to edge to the ink border. A `MATCH 94` sticker rotated -6° overlaps the top-left corner; a return-risk sticker overlaps the top-right when risk is medium or high. The footer is a hard-edged colour-blocked strip in the brand's assigned accent: brand name in micro caps, product name in 26sp Archivo Black uppercase, price in a pill, one line of verdict copy. No buttons — the gesture is the interface, taught once by a coach overlay that demonstrates the arc rather than describing it.

**FORM.** Pinned by the user's brief to byooooob.com, with tokens extracted from the live site's computed styles rather than recalled. The pin binds the world; the rendition is pushed to the world's full saturated range rather than its softest reading. No seed roll was run — a brief-pinned direction beats the roll.

## Platform posture

Android-native via Expo. The **look** is fully governed by the pinned world, not Material 3. The **behaviors** Material owns as OS guarantees are honored without exception: system Back always works and is never trapped, edge-to-edge layout respects status/navigation/cutout insets, touch targets are ≥48dp with ≥8dp separation, and type is sized in `sp` so it follows the system font-size setting.

Light-only, deliberately. The ground colour is the identity; an inverted scheme would be a different product. This is a brief-driven decision, recorded rather than defaulted.

## Color

Extracted from byooooob.com computed styles.

| Role | Token | Hex |
|---|---|---|
| Ground | `ground` | `#EEEEEC` |
| Ground, recessed | `groundSunk` | `#E1E1D9` |
| Ink | `ink` | `#000000` |
| Ink, secondary | `inkSoft` | `#333333` |
| Paper (raised) | `paper` | `#FFFFFF` |
| Violet | `violet` | `#4D17F5` |
| Tomato | `tomato` | `#E9492D` |
| Acid | `acid` | `#EBD22F` |
| Bubblegum | `bubblegum` | `#FA9DCD` |
| Forest | `forest` | `#1F8D42` |

Strategy: **Full palette.** Accents own whole regions — a footer strip, a full-bleed panel, a filled pill — never a scattered tint on a neutral ground. Each brand in the catalog is assigned one accent and keeps it everywhere it appears, so colour carries brand identity across deck, bag, and dashboard.

Text on `acid` and `bubblegum` is always `ink`. Text on `violet`, `tomato`, and `forest` is always `paper`. These pairings are fixed; no other combination is permitted.

## Type

**Archivo** only — one family, four weights. Archivo Black for display, Archivo 400/500/600 for everything else. Space Grotesk was explicitly rejected: its quirky forms fight the reference, and it is the most over-shipped default in this category.

| Role | Face | Size | Tracking | Case |
|---|---|---|---|---|
| `mega` | Archivo Black | 56sp | -0.035em | UPPER |
| `display` | Archivo Black | 36sp | -0.03em | UPPER |
| `title` | Archivo Black | 26sp | -0.02em | UPPER |
| `heading` | Archivo 600 | 19sp | -0.01em | UPPER |
| `body` | Archivo 400 | 16sp | 0 | sentence |
| `label` | Archivo 600 | 13sp | 0.06em | UPPER |
| `micro` | Archivo 600 | 11sp | 0.08em | UPPER |

Display type is allowed to overlap graphics and run off the edge. Body copy never does.

## Shape & depth

- Radii: `sm 9`, `md 13`, `lg 23`, `xl 30`, `pill 999`, `round 50%`. Nothing below 9.
- Borders: `hair 1`, `bold 2`. **Never above 2px** — the heavy 3–4px outline is the generic brutalist stereotype this world is explicitly not.
- One shadow only: `offsetX 4, offsetY 5, radius 0, opacity 1, color #000`. It never blurs, never tints, never scales. Elements either sit flat or they sit on this shadow.
- Pressed state travels `(4, 5)` toward its shadow and drops the shadow to zero, so the element physically lands on the page.

## Motion

Snappy, never elegant. Springs with `damping 18–20, stiffness 220–260`; timed transitions at 140–220ms. Card entrance scales from 0.92 with a slight rotation. The one authored moment is the **swipe**: the card tilts up to 12° with translation, a full-bleed verdict stamp fades in past the decision threshold, and release either flings the card off-screen along its velocity vector or springs it home. Everything else is restrained so this reads.

Haptics are part of the motion design, not an add-on: selection tick when crossing the decision threshold, success notification on a right-swipe commit, warning notification when a high-risk item bounces back.

## Doodles

Hand-drawn ink shapes authored as `react-native-svg` components: `Starburst`, `Eyes`, `Chevrons`, `Cursor`, `Squiggle`, `Blob`, `Globe`. They are decoration in the world's own grammar — always rotated off-axis, always allowed to overlap, never used as a functional icon and never given a tidy icon slot. Functional iconography is drawn in the same ink weight so the two never look borrowed from different systems.

## Component rules

- **StickerCard** — the base container: 2px ink border, `lg` radius, hard shadow, colour-blocked footer strip. This is the only card shape in the product; there are no nested cards.
- **PillButton** — fully rounded, 1px ink border, hard shadow, uppercase `label` text, press travel. Minimum height 48dp.
- **Sticker** — a small rotated label with border and optional shadow, used for match scores, risk flags, and status. Rotation is always between -8° and 8°.
- **Tab bar** — custom, ink-outlined, sitting on the hard shadow, with the active tab as a filled accent block rather than a tinted icon.

Prohibitions, each checked against the world's own materials: no gradient fills (the world is flat), no blur or glass (the world is printed), no shadow with a blur radius (the world's shadow is a cut-out offset), no border above 2px (the reference's own borders are 1–2px), no radius below 9px (the reference has no hard corners). Grayed-out disabled states are replaced by reduced opacity on the ink outline, because this world has no grey scale between `#333` and `#E1E1D9`.
