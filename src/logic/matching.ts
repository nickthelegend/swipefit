import { colorFamily, hexToLch, type Lch } from './color';
import type { MatchVerdict, Product, Season, ShopFor, SkinProfile } from '@/types';

/**
 * The skin-informed apparel sort — the feature the whole product turns on.
 *
 * This is seasonal colour analysis, implemented rather than gestured at. A
 * garment is scored on three independent axes against the shopper's measured
 * skin, and the deck is ordered by the result. The same catalogue produces a
 * visibly different order for a warm-undertone and a cool-undertone shopper,
 * which is the claim the product makes and must therefore be able to survive.
 */

/* -------------------------------------------------------------------------
 * Season
 * ---------------------------------------------------------------------- */

/**
 * Classical four-season analysis reads three axes: hue (warm/cool), value
 * (light/deep) and chroma (clear/muted). Undertone gives hue and depth gives
 * value; contrast between hair and skin stands in for chroma, because a
 * high-contrast person carries clear saturated colour and a low-contrast one
 * is overwhelmed by it.
 */
export function deriveSeason(
  undertone: SkinProfile['undertone'],
  depth: SkinProfile['depth'],
  contrast: SkinProfile['contrast'],
): Season {
  const isLight = depth === 'light';

  if (undertone === 'warm') return isLight ? 'spring' : 'autumn';
  if (undertone === 'cool') return isLight ? 'summer' : 'winter';

  // Neutral undertone has no hue signal, so contrast breaks the tie: high
  // contrast lands in the clear seasons, low contrast in the muted ones.
  if (contrast === 'high') return isLight ? 'spring' : 'winter';
  if (contrast === 'low') return isLight ? 'summer' : 'autumn';
  return isLight ? 'summer' : 'autumn';
}

type SeasonSpec = {
  /** +1 fully warm, -1 fully cool. */
  warmth: number;
  /** Preferred garment chroma, in LAB C* units. */
  chroma: number;
  /** How well pure neutrals (black, white, grey, stone) serve this season. */
  neutralAffinity: number;
  label: string;
  /** Colour names used in verdict copy so the reason is concrete. */
  signature: string;
};

const SEASON: Record<Season, SeasonSpec> = {
  spring: { warmth: 1, chroma: 52, neutralAffinity: 0.66, label: 'Warm Spring', signature: 'coral, camel and butter' },
  autumn: { warmth: 1, chroma: 38, neutralAffinity: 0.74, label: 'Deep Autumn', signature: 'rust, olive and bronze' },
  summer: { warmth: -1, chroma: 26, neutralAffinity: 0.72, label: 'Cool Summer', signature: 'slate, plum and soft navy' },
  winter: { warmth: -1, chroma: 58, neutralAffinity: 0.94, label: 'Cool Winter', signature: 'true white, ink and burgundy' },
};

export const seasonLabel = (s: Season) => SEASON[s].label;
export const seasonSignature = (s: Season) => SEASON[s].signature;

/* -------------------------------------------------------------------------
 * Garment temperature
 * ---------------------------------------------------------------------- */

/**
 * Continuous warmth in [-1, 1], rather than a warm/cool/neutral tag.
 *
 * The warm-cool axis in perceptual colour space runs from orange (~60°) to
 * blue (~250°), so a cosine about that axis gives a smooth reading that does
 * not snap at arbitrary hue boundaries. Multiplying by chroma is what makes
 * the model behave: a black tee, an oatmeal knit and indigo denim all have
 * near-zero chroma, land near zero warmth, and are correctly treated as
 * near-universal instead of being force-sorted onto one side.
 */
export function garmentWarmth({ C, h }: Lch): number {
  const axis = 60;
  const chromaWeight = Math.min(1, C / 45);
  return Math.cos(((h - axis) * Math.PI) / 180) * chromaWeight;
}

/* -------------------------------------------------------------------------
 * Scoring
 * ---------------------------------------------------------------------- */

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Ideal lightness separation between garment and skin, by contrast level. */
const IDEAL_SEPARATION: Record<SkinProfile['contrast'], number> = {
  high: 45,
  medium: 32,
  low: 22,
};

/* -------------------------------------------------------------------------
 * Beauty mode
 * ---------------------------------------------------------------------- */

/**
 * CIE76 colour difference. Adequate here because foundation shades and skin
 * both sit in the same small, well-behaved region of LAB, which is exactly
 * where CIE76's known weaknesses (saturated blues, very high chroma) do not
 * apply. ΔE below ~3 is imperceptible to most people; above ~20 is obviously
 * the wrong shade.
 */
function deltaE(a: Lch, b: Lch): number {
  const toAb = ({ C, h }: Lch) => ({
    a: C * Math.cos((h * Math.PI) / 180),
    b: C * Math.sin((h * Math.PI) / 180),
  });
  const ab1 = toAb(a);
  const ab2 = toAb(b);
  return Math.hypot(a.L - b.L, ab1.a - ab2.a, ab1.b - ab2.b);
}

function scoreBeauty(product: Product, profile: SkinProfile): MatchVerdict {
  if (product.beautyKind === 'skincare') {
    const concern = profile.concerns.find((c) => c.type === product.targetsConcern);

    if (!concern) {
      return {
        score: 50,
        band: 'fine',
        reason: `Your scan did not measure ${product.targetsConcern ?? 'this'}, so this is unranked.`,
      };
    }

    // Skin-analysis scores describe condition: high is healthy, low is a
    // problem. A treatment is therefore most relevant where the score is lowest.
    const score = Math.round(Math.max(0, Math.min(100, 100 - concern.rawScore)));
    return {
      score,
      band: score >= 78 ? 'hero' : score >= 62 ? 'good' : score >= 46 ? 'fine' : 'fights',
      reason:
        score >= 62
          ? `Your ${concern.label.toLowerCase()} scored ${Math.round(concern.rawScore)}/100 — this targets exactly that.`
          : `Your ${concern.label.toLowerCase()} already scored ${Math.round(concern.rawScore)}/100, so this is not a priority.`,
    };
  }

  // Foundation: perceptual distance from the measured skin colour.
  const distance = deltaE(hexToLch(product.colorHex), hexToLch(profile.skinHex));
  const score = Math.round(clamp01(1 - distance / 40) * 100);

  return {
    score,
    band: score >= 78 ? 'hero' : score >= 62 ? 'good' : score >= 46 ? 'fine' : 'fights',
    reason:
      distance < 6
        ? `Within ΔE ${distance.toFixed(1)} of your measured skin — effectively invisible.`
        : distance < 14
          ? `ΔE ${distance.toFixed(1)} from your skin. Close; blend at the jaw.`
          : `ΔE ${distance.toFixed(1)} from your skin — this will sit visibly ${
              hexToLch(product.colorHex).L > hexToLch(profile.skinHex).L ? 'lighter' : 'darker'
            } than you.`,
  };
}

export function scoreProduct(product: Product, profile: SkinProfile): MatchVerdict {
  if (product.mode === 'beauty') return scoreBeauty(product, profile);

  const garment = hexToLch(product.colorHex);
  const spec = SEASON[profile.season];
  const skinL = profile.confidence >= 0 ? hexToLch(profile.skinHex).L : 50;

  // --- Axis 1: warm/cool agreement -----------------------------------------
  const warmth = garmentWarmth(garment);
  const agreement = warmth * spec.warmth; // [-1, 1]
  const chromaticHue = (agreement + 1) / 2;

  // Near-neutral garments are judged on how well the season carries neutrals
  // rather than on a hue agreement they do not meaningfully have.
  const chromaticity = clamp01((garment.C - 8) / 26);
  const hueScore = chromaticity * chromaticHue + (1 - chromaticity) * spec.neutralAffinity;

  // --- Axis 2: clarity ------------------------------------------------------
  const chromaScore = clamp01(1 - Math.abs(garment.C - spec.chroma) / 55);

  // --- Axis 3: value against the wearer ------------------------------------
  const separation = Math.abs(garment.L - skinL);
  const valueScore = clamp01(1 - Math.abs(separation - IDEAL_SEPARATION[profile.contrast]) / 55);

  const raw = 0.5 * hueScore + 0.25 * chromaScore + 0.25 * valueScore;

  // A low-confidence undertone reading should not produce a confident sort, so
  // the score is pulled toward neutral in proportion to how uncertain the
  // measurement was. This is what stops a borderline scan from claiming a
  // decisive match it cannot justify.
  const certainty = 0.55 + 0.45 * profile.confidence;
  const damped = 0.5 + (raw - 0.5) * certainty;

  const score = Math.round(clamp01(damped) * 100);

  return {
    score,
    band: score >= 78 ? 'hero' : score >= 62 ? 'good' : score >= 46 ? 'fine' : 'fights',
    reason: explain(product, profile, { warmth, agreement, separation, garment }),
  };
}

/**
 * Names the axis that actually drove the score.
 *
 * The ordering here matters: it walks the axes by how much each one moved the
 * result, so a card never explains itself with a reason that contradicts its
 * own number. A garment scoring 82 must not describe itself as "a workable
 * middle" — that mismatch is exactly what makes a reasoning layer read as
 * decoration the first time someone checks it against a second product.
 */
function explain(
  product: Product,
  profile: SkinProfile,
  ctx: { warmth: number; agreement: number; separation: number; garment: Lch },
): string {
  const family = colorFamily(product.colorHex);
  const tone = profile.undertone;
  const direction = ctx.warmth > 0 ? 'warm' : 'cool';

  // Near-neutral garments never get a warm/cool story, because they do not have
  // one. Claiming otherwise would be inventing a reason.
  if (Math.abs(ctx.warmth) < 0.18) {
    if (ctx.separation < 14) {
      return `${family} sits almost at your own skin value — it will read as washed out.`;
    }
    return `${family} sits outside the warm–cool argument, so it holds up on ${tone} skin.`;
  }

  if (ctx.agreement > 0.3) {
    return `${family} runs ${direction}, same direction as your ${tone} undertone.`;
  }

  if (ctx.agreement < -0.3) {
    return `${family} pulls ${direction} against your ${tone} undertone — it will fight your face.`;
  }

  // Hue is genuinely inconclusive here, so the value axis gets to speak.
  if (ctx.separation < 16) {
    return `${family} sits too close to your own skin value; it flattens you out.`;
  }
  if (ctx.separation > 55) {
    return `${family} throws hard contrast against your skin — bold, and it will be noticed.`;
  }

  return `${family} leans ${direction} but only faintly; it neither lifts nor fights your ${tone} skin.`;
}

/* -------------------------------------------------------------------------
 * Deck ordering
 * ---------------------------------------------------------------------- */

/**
 * Sorts strictly by match score. Colour is never filtered on — a shopper who
 * only ever sees flattering colours cannot tell the sort is doing anything, and
 * hiding two thirds of the catalogue would leave nothing to swipe. Poor matches
 * sink to the bottom and arrive labelled.
 *
 * Gender IS filtered on, and the difference is worth being precise about,
 * because the two look like the same decision and are not. A cool-toned garment
 * shown to a warm-toned shopper is a weak recommendation — a judgement, and one
 * they are entitled to overrule. A dress shown to someone shopping menswear is
 * not a weak recommendation, it is the wrong catalogue; no amount of swiping
 * makes it right, and ranking it last still wastes a render on it. Sorting is
 * for opinions, filtering is for facts.
 *
 * `unisex` items appear for everyone, so the filter narrows the deck rather than
 * splitting it.
 */
export function buildDeck(
  products: Product[],
  profile: SkinProfile,
  mode: Product['mode'] = 'apparel',
  shopFor: ShopFor = 'everything',
): { product: Product; match: MatchVerdict }[] {
  return products
    .filter((p) => p.mode === mode)
    .filter((p) => shopFor === 'everything' || p.gender === shopFor || p.gender === 'unisex')
    .map((product) => ({ product, match: scoreProduct(product, profile) }))
    .sort((a, b) => b.match.score - a.match.score || a.product.id.localeCompare(b.product.id));
}
