import type { AccentName } from '@/theme/tokens';
import type { Depth, Undertone } from '@/logic/color';

export type { Depth, Undertone };

/** Maps 1:1 onto the VTO API's `garment_category` parameter. */
export type GarmentCategory = 'upper_body' | 'lower_body' | 'full_body' | 'shoes';

export type Mode = 'apparel' | 'beauty';

export type Product = {
  id: string;
  brand: string;
  name: string;
  category: GarmentCategory;
  mode: Mode;
  price: number;
  currency: string;
  /** Public CDN URL, passed straight to the VTO API as `ref_file_url`. */
  productImageUrl: string;
  /** Where "checkout" hands the shopper off to. */
  brandProductUrl: string;
  colorName: string;
  colorHex: string;
  sizeInfo: string;
  fitNote: string;

  /** Beauty mode only. Foundations match on shade; skincare matches on concern. */
  beautyKind?: 'foundation' | 'skincare';
  /** Skin-analysis concern type this product targets, e.g. "pore". */
  targetsConcern?: string;
};

export type Brand = {
  name: string;
  accent: AccentName;
};

export type SkinProfile = {
  /** Hex values straight from `skin-tone-analysis`. */
  skinHex: string;
  hairHex: string | null;
  eyeHex: string | null;
  lipHex: string | null;
  eyeColorName: string | null;
  hairColorName: string | null;

  /** Derived locally — the API returns none of these. See logic/color.ts. */
  undertone: Undertone;
  depth: Depth;
  confidence: number;
  contrast: 'low' | 'medium' | 'high';
  season: Season;

  /** From `skin-analysis`, when it succeeded. Empty when it was skipped. */
  concerns: SkinConcern[];

  scanTimestamp: number;
  /** True when the undertone was forced by the demo override, not measured. */
  simulated: boolean;
  /**
   * Where the colour reading came from. `recorded` means a real measurement of
   * this exact photo, taken earlier and shipped with the app — used when the
   * live call cannot run. Surfaced in the UI; never silently substituted.
   */
  readingSource: 'live' | 'recorded';
};

export type SkinConcern = {
  type: string;
  label: string;
  /** Use raw_score, never ui_score — the API inflates ui_score deliberately. */
  rawScore: number;
};

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export type MatchVerdict = {
  score: number;
  band: 'hero' | 'good' | 'fine' | 'fights';
  /** One short sentence naming the actual reason, shown on the card. */
  reason: string;
};

export type RegretFlag = {
  /** 0–100. Illustrative heuristic — labelled as such wherever it is shown. */
  risk: number;
  band: 'low' | 'medium' | 'high';
  reason: string;
};

export type DeckCard = {
  product: Product;
  match: MatchVerdict;
  regret: RegretFlag;
  render: RenderState;
};

export type RenderState =
  | { status: 'queued' }
  | { status: 'rendering' }
  | { status: 'ready'; uri: string; cached: boolean }
  | { status: 'failed'; reason: string };

export type SwipeDirection = 'left' | 'right';

export type SwipeEvent = {
  productId: string;
  direction: SwipeDirection;
  timestamp: number;
  matchScore: number;
};

export type CartItem = {
  product: Product;
  addedAt: number;
  sentToBrand: boolean;
  /** Kept so the bag can show the render the shopper actually said yes to. */
  renderUri: string | null;
};

export type DemoModel = {
  id: string;
  label: string;
  faceAsset: number;
  bodyAsset: number;
  credit: string;
};
