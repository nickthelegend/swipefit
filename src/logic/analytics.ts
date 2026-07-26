import { scoreProduct } from './matching';
import { assessRegret } from './reasoning';
import type { CartItem, Product, SkinProfile, SwipeEvent } from '@/types';

/**
 * Brand-side analytics.
 *
 * EVERY NUMBER ON THIS SCREEN IS MEASURED. There is no synthetic baseline, no
 * seeded impression count, no invented traffic. An earlier version of this file
 * generated plausible-looking demo figures; that was removed, because a
 * dashboard of fabricated numbers proves nothing about the product and quietly
 * teaches the viewer to distrust the parts that are real.
 *
 * What replaced it is the thing a brand cannot get anywhere else. A retailer
 * already knows its conversion rate. What it has never been able to see is the
 * *hesitation* in front of the buy: how long someone looked, whether they had to
 * open the detail before deciding, whether they started to say yes and pulled
 * back, whether they took it back after adding it. Those are the moments a
 * return begins, and they happen entirely before any event a retailer's own
 * analytics can observe.
 *
 * All four are captured directly from the gesture layer:
 *   dwellMs    — time the card was on top before the decision committed
 *   inspected  — the card was flipped to read the breakdown first
 *   hesitated  — the commit threshold was crossed, then retreated from
 *   undone     — the decision was reversed
 */

export type SkuRow = {
  product: Product;
  impressions: number;
  rights: number;
  /** 0–100. */
  rightRate: number;
  medianDwellMs: number;
  inspectRate: number;
  hesitationRate: number;
  undoRate: number;
  /** Derived friction score, 0–100. Explained in `frictionOf`. */
  friction: number;
  frictionNote: string | null;
  addedToBag: boolean;
  handedOff: boolean;
};

export type Dashboard = {
  rows: SkuRow[];
  hasData: boolean;
  totals: {
    impressions: number;
    rights: number;
    rightRate: number;
    medianDwellMs: number;
    inspectRate: number;
    hesitationRate: number;
    bagged: number;
    handedOff: number;
    handoffRate: number;
  };
};

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)
    : (sorted[mid] ?? 0);
}

const rate = (numerator: number, denominator: number) =>
  denominator === 0 ? 0 : (numerator / denominator) * 100;

/**
 * Friction: how hard this SKU was to decide on, regardless of the answer.
 *
 * Weighted toward the signals that are hardest to fake and most predictive of a
 * return. A slow, inspected, hesitated-over, then-reversed decision is the
 * profile of a garment someone talks themselves into — which is precisely the
 * one that comes back.
 *
 * Dwell is normalised against 6 seconds, roughly where a confident swipe ends
 * and deliberation begins in observed sessions.
 */
function frictionOf(row: Omit<SkuRow, 'friction' | 'frictionNote'>): number {
  const dwellPressure = Math.min(1, row.medianDwellMs / 6000) * 100;
  return Math.round(
    0.3 * dwellPressure + 0.25 * row.inspectRate + 0.3 * row.hesitationRate + 0.15 * row.undoRate,
  );
}

function frictionNote(row: Omit<SkuRow, 'friction' | 'frictionNote'>): string | null {
  if (row.impressions === 0) return null;
  if (row.hesitationRate >= 50) return 'Started to add it, then pulled back';
  if (row.undoRate >= 50) return 'Added, then taken back out';
  if (row.inspectRate >= 50) return 'Had to open the detail before deciding';
  if (row.medianDwellMs >= 8000) return `Deliberated ${(row.medianDwellMs / 1000).toFixed(1)}s`;
  return null;
}

export function buildDashboard(
  products: Product[],
  swipes: SwipeEvent[],
  cart: CartItem[],
  _profile: SkinProfile | null,
): Dashboard {
  const bagged = new Set(cart.map((i) => i.product.id));
  const sent = new Set(cart.filter((i) => i.sentToBrand).map((i) => i.product.id));

  // Events recorded before the behavioural fields existed rehydrate without
  // them. Coercing here rather than migrating the store keeps a stale install
  // from rendering NaN across the whole screen.
  const events = swipes.map((e) => ({
    ...e,
    dwellMs: Number.isFinite(e.dwellMs) ? e.dwellMs : 0,
    inspected: e.inspected === true,
    hesitated: e.hesitated === true,
    confirmed: e.confirmed === true,
    undone: e.undone === true,
  }));

  const byProduct = new Map<string, SwipeEvent[]>();
  for (const swipe of events) {
    const list = byProduct.get(swipe.productId) ?? [];
    list.push(swipe);
    byProduct.set(swipe.productId, list);
  }

  const rows: SkuRow[] = [];

  for (const product of products) {
    const seen = byProduct.get(product.id);
    // Products nobody has seen contribute nothing. Showing them at zero would
    // pad the screen with rows that look like measurements but are absences.
    if (!seen || seen.length === 0) continue;

    const base = {
      product,
      impressions: seen.length,
      rights: seen.filter((e) => e.direction === 'right').length,
      rightRate: rate(seen.filter((e) => e.direction === 'right').length, seen.length),
      medianDwellMs: median(seen.map((e) => e.dwellMs)),
      inspectRate: rate(seen.filter((e) => e.inspected).length, seen.length),
      hesitationRate: rate(seen.filter((e) => e.hesitated || e.confirmed).length, seen.length),
      undoRate: rate(seen.filter((e) => e.undone).length, seen.length),
      addedToBag: bagged.has(product.id),
      handedOff: sent.has(product.id),
    };

    rows.push({ ...base, friction: frictionOf(base), frictionNote: frictionNote(base) });
  }

  rows.sort((a, b) => b.friction - a.friction || b.impressions - a.impressions);

  const rights = events.filter((e) => e.direction === 'right').length;

  return {
    rows,
    hasData: events.length > 0,
    totals: {
      impressions: events.length,
      rights,
      rightRate: rate(rights, events.length),
      medianDwellMs: median(events.map((e) => e.dwellMs)),
      inspectRate: rate(events.filter((e) => e.inspected).length, events.length),
      hesitationRate: rate(
        events.filter((e) => e.hesitated || e.confirmed).length,
        events.length,
      ),
      bagged: cart.length,
      handedOff: cart.filter((i) => i.sentToBrand).length,
      handoffRate: rate(cart.filter((i) => i.sentToBrand).length, cart.length),
    },
  };
}

/**
 * The colour-fit story aggregated across everything seen.
 *
 * This is the part of the data only this product can produce: a brand learns
 * which of its colourways are being rejected by people whose skin they fight,
 * which is invisible in ordinary sales data because those shoppers never
 * clicked anything.
 */
/**
 * Minimum observations in EACH bucket before a rate is quoted.
 *
 * Without this the screen happily prints "kept 0%" off a single swipe, which is
 * arithmetically true and completely meaningless — and a fabricated-looking
 * number does more damage here than showing nothing, on a screen whose entire
 * claim is that its figures are real.
 */
const MIN_SAMPLE = 3;

export function colourVerdict(
  products: Product[],
  swipes: SwipeEvent[],
  profile: SkinProfile | null,
): {
  fought: number;
  flattered: number;
  foughtRightRate: number;
  flatteredRightRate: number;
  /** False when either bucket is too small to quote a rate from. */
  significant: boolean;
} | null {
  if (!profile || swipes.length === 0) return null;

  const byId = new Map(products.map((p) => [p.id, p]));
  let fought = 0;
  let flattered = 0;
  let foughtRights = 0;
  let flatteredRights = 0;

  for (const swipe of swipes) {
    const product = byId.get(swipe.productId);
    if (!product) continue;
    const band = scoreProduct(product, profile).band;
    if (band === 'fights') {
      fought += 1;
      if (swipe.direction === 'right') foughtRights += 1;
    } else if (band === 'hero') {
      flattered += 1;
      if (swipe.direction === 'right') flatteredRights += 1;
    }
  }

  if (fought === 0 && flattered === 0) return null;

  return {
    fought,
    flattered,
    foughtRightRate: rate(foughtRights, fought),
    flatteredRightRate: rate(flatteredRights, flattered),
    significant: fought >= MIN_SAMPLE && flattered >= MIN_SAMPLE,
  };
}

/** Size-run exposure, computed from the real catalogue rather than invented. */
export function sizeFriction(products: Product[], profile: SkinProfile | null): SkuRow['product'][] {
  if (!profile) return [];
  return products
    .filter((p) => p.mode === 'apparel')
    .filter((p) => assessRegret(p, scoreProduct(p, profile), profile).band === 'high');
}
