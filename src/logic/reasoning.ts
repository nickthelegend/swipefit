import type { MatchVerdict, Product, RegretFlag, SkinProfile } from '@/types';

/**
 * Regret prevention.
 *
 * IMPORTANT — HONESTY BOUNDARY. There is no real return-rate data behind this,
 * and there is no way to get any without a brand partnership. Every number this
 * module produces is a deterministic heuristic over facts we actually hold
 * (garment category, colour match, size breadth, cut). It is labelled as
 * illustrative on the card itself, in the product's own voice, not buried in a
 * footnote — see PRODUCT.md, "Absences future work must not paper over".
 *
 * The heuristic is built from published apparel-industry patterns that are not
 * in dispute: fit-sensitive categories return far more often than forgiving
 * ones, narrow size ranges strand people at the ends, and colour that fights
 * the wearer is a top cited reason for sending something back. Being derived
 * from real patterns does not make the output a measurement, and the copy never
 * implies that it is.
 */

/** Fit sensitivity by category — trousers strand people that tees do not. */
const CATEGORY_RISK: Record<Product['category'], number> = {
  lower_body: 34,
  full_body: 30,
  shoes: 28,
  upper_body: 18,
};

/**
 * Cut descriptions, split by HOW they go wrong rather than lumped as "unusual".
 *
 * These were one regex, which put `oversized`, `boxy`, `relaxed` and `slouch`
 * alongside `slim` and `skinny` and charged them all the same penalty. That is
 * backwards twice over: a relaxed tee is one of the safest things to buy
 * unseen, and the card was citing "the cut is relaxed" to the shopper as a
 * reason it might not fit. Worse, the branch below is an `else if`, so
 * "relaxed straight" matched the tight pattern first and never received the
 * forgiving discount it had earned.
 *
 * Narrow and voluminous cuts both carry more risk than a regular one, but not
 * the same risk and not the same amount:
 *
 *   NARROW strands people at the top of the size run — the classic too-small
 *   return, and the most common one.
 *
 *   VOLUME rarely arrives too small; it arrives bigger than it looked. Real,
 *   but a smaller effect, and it is specifically hard to judge from a render.
 */
const NARROW_CUT = /\b(slim|skinny|tapered|fitted|cropped)\b/i;
const VOLUME_CUT = /\b(oversized|boxy|slouch|slouchy)\b/i;
const FORGIVING_CUT = /\b(regular|straight|classic|standard|relaxed|loose)\b/i;

export function assessRegret(
  product: Product,
  match: MatchVerdict,
  profile: SkinProfile,
): RegretFlag {
  let risk = CATEGORY_RISK[product.category];
  const drivers: string[] = [];
  // What is working IN the garment's favour. Collected so the low-risk copy can
  // name the actual reasons instead of asserting a forgiving cut and a
  // flattering colour whether or not either applied.
  const eases: string[] = [];

  // A colour that fights the wearer is a documented top-three return reason.
  if (match.band === 'fights') {
    risk += 16;
    drivers.push('the colour works against your undertone');
  } else if (match.band === 'hero') {
    risk -= 6;
    eases.push('the colour is on your side');
  }

  // Narrow size runs strand people at both ends of the range.
  const sizeCount = countSizes(product.sizeInfo);
  if (sizeCount > 0 && sizeCount <= 4) {
    risk += 10;
    drivers.push('the size run is short');
  }

  // Checked narrowest-first: "relaxed straight" is forgiving, and an
  // oversized cut is a different problem from a slim one.
  if (NARROW_CUT.test(product.fitNote)) {
    risk += 9;
    drivers.push(`the cut is ${matchedCutWord(NARROW_CUT, product.fitNote)}`);
  } else if (VOLUME_CUT.test(product.fitNote)) {
    risk += 6;
    drivers.push(`an ${matchedCutWord(VOLUME_CUT, product.fitNote)} cut is hard to judge on screen`);
  } else if (FORGIVING_CUT.test(product.fitNote)) {
    risk -= 5;
    eases.push('the cut is forgiving');
  }

  // A deep-contrast wearer in a near-skin-value garment tends to bounce it.
  if (profile.contrast === 'high' && match.band === 'fine') {
    risk += 4;
  }

  risk = Math.max(6, Math.min(72, Math.round(risk)));
  const band: RegretFlag['band'] = risk >= 42 ? 'high' : risk >= 26 ? 'medium' : 'low';

  return { risk, band, reason: phrase(band, drivers, eases, product) };
}

function phrase(
  band: RegretFlag['band'],
  drivers: string[],
  eases: string[],
  product: Product,
): string {
  const because = drivers.length ? ` — ${drivers.slice(0, 2).join(', and ')}` : '';
  if (band === 'high') {
    return `High return risk on ${product.category === 'lower_body' ? 'these' : 'this'}${because}. Worth checking the size guide first.`;
  }
  if (band === 'medium') {
    return `Middling return risk${because}. Not a warning, just a heads-up.`;
  }

  // Only claim what actually fired. The old copy asserted a forgiving cut and a
  // flattering colour unconditionally, so a garment that reached `low` purely
  // because it was an upper body item with a wide size run still told the
  // shopper two specific things that were not true of it.
  if (eases.length) {
    return `Low return risk. ${capitalise(eases.slice(0, 2).join(', and '))}.`;
  }

  // Nothing specific helped, so the low score came from the category itself —
  // which is a real reason and the one actually responsible. Saying that beats
  // both inventing a flattering cut and leaving the shopper a bare three words.
  return `Low return risk. ${CATEGORY_EASE[product.category]}`;
}

/** Why a category is forgiving, when nothing more specific is carrying the score. */
const CATEGORY_EASE: Record<Product['category'], string> = {
  upper_body: 'A top forgives a lot about sizing.',
  lower_body: 'Nothing about this pair narrows who it fits.',
  full_body: 'Nothing about this one narrows who it fits.',
  shoes: 'Nothing about this pair narrows who it fits.',
};

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Parses "XS–XXL" or "28–38 waist" into an approximate number of options. */
function countSizes(sizeInfo: string): number {
  const LETTER_RUN = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  const letters = sizeInfo.toUpperCase().match(/\b(XXS|XS|S|M|L|XL|XXL|XXXL)\b/g);
  if (letters && letters.length >= 2) {
    const idx = letters.map((l) => LETTER_RUN.indexOf(l)).filter((i) => i >= 0);
    if (idx.length >= 2) return Math.max(...idx) - Math.min(...idx) + 1;
  }
  const numbers = sizeInfo.match(/\d+/g);
  if (numbers && numbers.length >= 2) {
    const nums = numbers.map(Number);
    return Math.round((Math.max(...nums) - Math.min(...nums)) / 2) + 1;
  }
  return 0;
}

function matchedCutWord(pattern: RegExp, fitNote: string): string {
  return (fitNote.match(pattern)?.[0] ?? 'unusual').toLowerCase();
}

/**
 * The one-line verdict shown in the card footer. Match reasoning owns colour,
 * so this owns fit — otherwise both lines say the same thing in two voices.
 */
export function fitVerdict(product: Product, profile: SkinProfile): string {
  const cut = product.fitNote.trim();
  const lead = cut.charAt(0).toUpperCase() + cut.slice(1);

  if (product.category === 'lower_body') return `${lead}. Sizing runs off the waist, not the hip.`;
  if (product.category === 'full_body') return `${lead}. One piece, so the shoulder decides everything.`;
  if (profile.contrast === 'high') return `${lead}. You carry hard contrast, so this holds its shape on you.`;
  return `${lead}.`;
}
