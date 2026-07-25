import { assessRegret } from './reasoning';
import { scoreProduct } from './matching';
import type { CartItem, Product, SkinProfile, SwipeEvent } from '@/types';

/**
 * Brand-side analytics.
 *
 * HONESTY BOUNDARY, same as reasoning.ts: there is no real traffic behind this.
 * The baseline is synthetic, and the dashboard says so on its face.
 *
 * What is *not* synthetic is the current session. Real swipes are layered on top
 * of the baseline, so a right-swipe on the deck visibly moves that SKU's bar
 * here. That makes the mechanism demonstrable rather than merely claimed — and
 * it is why the two are tracked separately rather than blended into one number.
 */

/** Deterministic per-SKU baseline so the dashboard never reshuffles on rerender. */
function seededRate(id: string, min: number, max: number, salt = 0): number {
  let h = 0x811c9dc5 ^ salt;
  for (let i = 0; i < id.length; i += 1) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const unit = ((h >>> 0) % 10000) / 10000;
  return min + unit * (max - min);
}

export type SkuRow = {
  product: Product;
  baselineImpressions: number;
  baselineRights: number;
  sessionImpressions: number;
  sessionRights: number;
  /** Combined right-swipe rate, 0–100. */
  rate: number;
  /** True when this session contributed data to the row. */
  live: boolean;
  frictionFlag: string | null;
};

export type Dashboard = {
  rows: SkuRow[];
  totals: {
    baselineImpressions: number;
    sessionImpressions: number;
    rightRate: number;
    handoffRate: number;
    bagged: number;
    handedOff: number;
  };
};

export function buildDashboard(
  products: Product[],
  swipes: SwipeEvent[],
  cart: CartItem[],
  profile: SkinProfile | null,
): Dashboard {
  const apparel = products.filter((p) => p.mode === 'apparel');

  const sessionBySku = new Map<string, { impressions: number; rights: number }>();
  for (const swipe of swipes) {
    const entry = sessionBySku.get(swipe.productId) ?? { impressions: 0, rights: 0 };
    entry.impressions += 1;
    if (swipe.direction === 'right') entry.rights += 1;
    sessionBySku.set(swipe.productId, entry);
  }

  const rows: SkuRow[] = apparel.map((product) => {
    const baselineImpressions = Math.round(seededRate(product.id, 180, 1400));
    const baselineRights = Math.round(baselineImpressions * seededRate(product.id, 0.14, 0.52, 7));

    const session = sessionBySku.get(product.id) ?? { impressions: 0, rights: 0 };

    const impressions = baselineImpressions + session.impressions;
    const rights = baselineRights + session.rights;

    // Friction flags surface the same heuristic the shopper saw, aggregated —
    // which is the actual product being sold to a brand: not "people liked it",
    // but "here is why they hesitated".
    let frictionFlag: string | null = null;
    if (profile) {
      const regret = assessRegret(product, scoreProduct(product, profile), profile);
      if (regret.band === 'high') frictionFlag = 'Fit risk flagged pre-add';
      else if (product.category === 'lower_body') frictionFlag = 'Waist sizing queried';
    }

    return {
      product,
      baselineImpressions,
      baselineRights,
      sessionImpressions: session.impressions,
      sessionRights: session.rights,
      rate: impressions > 0 ? (rights / impressions) * 100 : 0,
      live: session.impressions > 0,
      frictionFlag,
    };
  });

  rows.sort((a, b) => b.rate - a.rate);

  const baselineImpressions = rows.reduce((s, r) => s + r.baselineImpressions, 0);
  const baselineRights = rows.reduce((s, r) => s + r.baselineRights, 0);
  const sessionImpressions = swipes.length;
  const sessionRights = swipes.filter((s) => s.direction === 'right').length;

  const handedOff = cart.filter((i) => i.sentToBrand).length;

  return {
    rows,
    totals: {
      baselineImpressions,
      sessionImpressions,
      rightRate:
        baselineImpressions + sessionImpressions > 0
          ? ((baselineRights + sessionRights) / (baselineImpressions + sessionImpressions)) * 100
          : 0,
      handoffRate: cart.length > 0 ? (handedOff / cart.length) * 100 : 0,
      bagged: cart.length,
      handedOff,
    },
  };
}
