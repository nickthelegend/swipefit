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

/** Cut descriptions that reliably narrow who a garment actually fits. */
const TIGHT_CUT = /\b(slim|skinny|tapered|fitted|cropped|slouch|oversized|boxy|relaxed)\b/i;
const FORGIVING_CUT = /\b(regular|straight|classic|standard|loose)\b/i;

export function assessRegret(
  product: Product,
  match: MatchVerdict,
  profile: SkinProfile,
): RegretFlag {
  let risk = CATEGORY_RISK[product.category];
  const drivers: string[] = [];

  // A colour that fights the wearer is a documented top-three return reason.
  if (match.band === 'fights') {
    risk += 16;
    drivers.push('the colour works against your undertone');
  } else if (match.band === 'hero') {
    risk -= 6;
  }

  // Narrow size runs strand people at both ends of the range.
  const sizeCount = countSizes(product.sizeInfo);
  if (sizeCount > 0 && sizeCount <= 4) {
    risk += 10;
    drivers.push('the size run is short');
  }

  if (TIGHT_CUT.test(product.fitNote)) {
    risk += 9;
    drivers.push(`the cut is ${firstCutWord(product.fitNote)}`);
  } else if (FORGIVING_CUT.test(product.fitNote)) {
    risk -= 5;
  }

  // A deep-contrast wearer in a near-skin-value garment tends to bounce it.
  if (profile.contrast === 'high' && match.band === 'fine') {
    risk += 4;
  }

  risk = Math.max(6, Math.min(72, Math.round(risk)));
  const band: RegretFlag['band'] = risk >= 42 ? 'high' : risk >= 26 ? 'medium' : 'low';

  return { risk, band, reason: phrase(band, drivers, product) };
}

function phrase(band: RegretFlag['band'], drivers: string[], product: Product): string {
  const because = drivers.length ? ` — ${drivers.slice(0, 2).join(', and ')}` : '';
  if (band === 'high') {
    return `High return risk on ${product.category === 'lower_body' ? 'these' : 'this'}${because}. Worth checking the size guide first.`;
  }
  if (band === 'medium') {
    return `Middling return risk${because}. Not a warning, just a heads-up.`;
  }
  return `Low return risk. Forgiving cut, and the colour is on your side.`;
}

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

function firstCutWord(fitNote: string): string {
  return (fitNote.match(TIGHT_CUT)?.[0] ?? 'unusual').toLowerCase();
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
