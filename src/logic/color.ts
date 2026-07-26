/**
 * Colour science for the skin-informed sort.
 *
 * This module exists because of a hard API constraint: `skin-tone-analysis`
 * returns *no* undertone classification and *no* concern list — only hex colours
 * (`skin_color`, `lip_color`, `eye_color`, `hair_color`). Every warm/cool
 * judgement in the product is therefore derived here, from that hex, in CIELAB.
 *
 * Working in LAB rather than HSL is not decoration. HSL's "hue" is a artefact of
 * the RGB cube and is perceptually non-uniform: two skin tones a shopper reads as
 * equally warm can sit 20 HSL degrees apart. LAB is built on measured human
 * colour response, so a hue-angle threshold means the same thing on fair and on
 * deep skin — which is precisely the axis where a naive implementation fails.
 */

export type Rgb = { r: number; g: number; b: number };
export type Lab = { L: number; a: number; b: number };
/** Cylindrical LAB: L*, chroma, hue angle in degrees. */
export type Lch = { L: number; C: number; h: number };

export function hexToRgb(hex: string): Rgb {
  const clean = hex.replace('#', '').trim();
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  const n = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return { r: 128, g: 128, b: 128 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** sRGB companding — the gamma curve, not a naive /255. */
function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** D65 reference white, matching the sRGB spec these hexes are authored in. */
const WHITE = { x: 95.047, y: 100.0, z: 108.883 };

export function rgbToLab({ r, g, b }: Rgb): Lab {
  const R = srgbToLinear(r) * 100;
  const G = srgbToLinear(g) * 100;
  const B = srgbToLinear(b) * 100;

  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / WHITE.x;
  const y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / WHITE.y;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / WHITE.z;

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

export function labToLch({ L, a, b }: Lab): Lch {
  const h = (Math.atan2(b, a) * 180) / Math.PI;
  return { L, C: Math.hypot(a, b), h: h < 0 ? h + 360 : h };
}

export const hexToLch = (hex: string): Lch => labToLch(rgbToLab(hexToRgb(hex)));

/* -------------------------------------------------------------------------
 * Undertone
 * ---------------------------------------------------------------------- */

export type Undertone = 'warm' | 'cool' | 'neutral';
export type Depth = 'light' | 'medium' | 'deep';

/**
 * The hue angle at which skin of a given lightness reads as neither warm nor
 * cool. This is a curve, not a constant, and getting that wrong is the single
 * biggest correctness bug available in this feature.
 *
 * All skin contains haemoglobin (pushes a*, red) and melanin/carotene (pushes
 * b*, yellow), so undertone is the balance between them — which is what hue
 * angle measures. But that balance is not lightness-invariant: as L* falls, b*
 * compresses faster than a*, so the whole skin locus rotates toward lower hue
 * angles. A fixed threshold therefore reads *every* deep skin tone as cool.
 *
 * Verified against 18 reference tones spanning L* 16–89: a fixed 46°/54° split
 * misclassified espresso (#3B2219, h 45.7°) as confidently cool. This curve
 * lands it at neutral with 0.20 confidence, which is the honest answer.
 */
function neutralHueAxis(L: number): number {
  return Math.max(48, Math.min(66, 44 + 0.25 * L));
}

/** Half-width of the neutral band, in degrees either side of the axis. */
const NEUTRAL_BAND = 3;

export function undertoneFromSkinHex(hex: string): {
  undertone: Undertone;
  depth: Depth;
  lch: Lch;
  /** 0–1. Distance from the neutral band; scales how hard the deck sorts. */
  confidence: number;
} {
  const lch = hexToLch(hex);
  const { L, h } = lch;

  // Signed degrees from the lightness-adjusted neutral axis. Positive is warm.
  const delta = h - neutralHueAxis(L);

  const undertone: Undertone =
    delta > NEUTRAL_BAND ? 'warm' : delta < -NEUTRAL_BAND ? 'cool' : 'neutral';

  // A near-axis reading is genuinely uncertain, and the deck sorts more gently
  // for it rather than pretending to a confidence the measurement cannot support.
  const confidence = Math.min(1, Math.abs(delta) / 12);

  // L* thresholds approximate the Fitzpatrick bands. Kept coarse on purpose:
  // three honest buckets beat six that misclassify at every boundary.
  const depth: Depth = L >= 68 ? 'light' : L >= 45 ? 'medium' : 'deep';

  return { undertone, depth, lch, confidence: Math.round(confidence * 100) / 100 };
}

/**
 * Contrast between hair and skin lightness. Classical colour analysis treats
 * high contrast as tolerating (and needing) stronger, clearer garment colour,
 * and low contrast as wanting softer ones.
 */
export function contrastLevel(skinHex: string, hairHex?: string | null): 'low' | 'medium' | 'high' {
  if (!hairHex) return 'medium';
  const delta = Math.abs(hexToLch(skinHex).L - hexToLch(hairHex).L);
  return delta >= 45 ? 'high' : delta >= 22 ? 'medium' : 'low';
}

/**
 * Human-readable colour family, used in verdict copy so a card names an actual
 * colour rather than a hex. The low-chroma band is handled before the hue
 * buckets on purpose: oatmeal (#DCD3C3) sits at h 75°, and running it through
 * the chromatic branches would confidently call it "mustard".
 */
export function colorFamily(hex: string): string {
  const { L, C, h } = hexToLch(hex);

  // True greyscale.
  if (C < 8) return L > 80 ? 'off-white' : L > 55 ? 'grey' : L > 28 ? 'charcoal' : 'black';

  // Desaturated colours are named by value, not by hue — these are the beiges,
  // taupes and slates whose hue angle is real but perceptually irrelevant.
  if (C < 20) {
    if (L > 80) return 'cream';
    if (L > 66) return 'oatmeal';
    if (L > 45) return 'taupe';
    if (L > 28) return h > 40 && h < 110 ? 'coffee' : 'slate';
    return 'near-black';
  }

  if (h < 20 || h >= 345) return L < 40 ? 'burgundy' : 'red';
  if (h < 45) return L < 45 ? 'rust' : 'terracotta';
  if (h < 70) return L < 45 ? 'olive-brown' : L > 80 ? 'butter' : 'camel';
  if (h < 100) return L < 45 ? 'olive' : 'mustard';
  if (h < 160) return L < 45 ? 'forest' : 'green';
  if (h < 210) return 'teal';
  if (h < 275) return L < 40 ? 'navy' : 'blue';
  if (h < 300) return L < 40 ? 'plum' : 'violet';
  return L < 45 ? 'wine' : 'pink';
}
