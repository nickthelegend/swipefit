import type { AccentName } from '@/theme/tokens';
import type { Brand, Fit, GarmentCategory, Mode, Product } from '@/types';
import rawCatalog from './catalog.json';
import { BEAUTY_PRODUCTS } from './beauty';

/**
 * Catalogue loader.
 *
 * `catalog.json` is the single source of truth and is deliberately shaped as
 * plain data with no ids and no brand styling — dropping in a refreshed file is
 * meant to be a one-file change. Ids, brand accent assignment and the apparel
 * `mode` tag are all derived here.
 */

type RawProduct = {
  brand: string;
  name: string;
  category: string;
  price: number;
  currency?: string;
  productImageUrl: string;
  brandProductUrl: string;
  colorName: string;
  colorHex: string;
  sizeInfo?: string;
  fitNote?: string;
  gender?: string;
};

const VALID_CATEGORIES: GarmentCategory[] = ['upper_body', 'lower_body', 'full_body', 'shoes'];

/**
 * Unknown or absent reads as unisex, which shows the garment to everyone.
 *
 * That direction is deliberate. Guessing wrong toward `men` or `women` hides a
 * real product from the person it was made for and there is no way for them to
 * discover the mistake; guessing wrong toward `unisex` only shows one extra
 * item, which they swipe past. The failure that is recoverable by the user is
 * the one to prefer.
 */
function normaliseGender(value: string | undefined): Fit {
  return value === 'men' || value === 'women' ? value : 'unisex';
}

function normaliseCategory(value: string): GarmentCategory {
  const found = VALID_CATEGORIES.find((c) => c === value);
  // Falling back to upper_body rather than throwing keeps one malformed row
  // from emptying the entire deck.
  return found ?? 'upper_body';
}

/** Stable, deterministic id so cached renders survive a catalogue refresh. */
function slugify(brand: string, name: string, colorName: string): string {
  return `${brand}-${name}-${colorName}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const ACCENT_CYCLE: AccentName[] = ['violet', 'tomato', 'forest', 'acid'];

function buildBrands(products: RawProduct[]): Map<string, Brand> {
  const brands = new Map<string, Brand>();
  // Assignment follows first-appearance order so a brand keeps its colour across
  // the deck, the bag and the dashboard for as long as the catalogue is stable.
  for (const product of products) {
    if (brands.has(product.brand)) continue;
    const accent = ACCENT_CYCLE[brands.size % ACCENT_CYCLE.length] ?? 'violet';
    brands.set(product.brand, { name: product.brand, accent });
  }
  return brands;
}

const rawList = rawCatalog as RawProduct[];

// Beauty brands are folded in so they get their own accent rather than all
// falling back to the same default — colour is how a brand stays recognisable
// across the deck, the bag and the dashboard.
export const BRANDS = buildBrands([
  ...rawList,
  ...BEAUTY_PRODUCTS.map((p) => ({ ...p }) as unknown as RawProduct),
]);

export const APPAREL_PRODUCTS: Product[] = rawList.map((raw) => ({
  id: slugify(raw.brand, raw.name, raw.colorName),
  brand: raw.brand,
  name: raw.name,
  category: normaliseCategory(raw.category),
  mode: 'apparel' as Mode,
  gender: normaliseGender(raw.gender),
  price: raw.price,
  currency: raw.currency ?? 'USD',
  productImageUrl: raw.productImageUrl,
  brandProductUrl: raw.brandProductUrl,
  colorName: raw.colorName,
  colorHex: raw.colorHex,
  sizeInfo: raw.sizeInfo ?? 'One size run',
  fitNote: raw.fitNote ?? 'regular fit',
}));

export const ALL_PRODUCTS: Product[] = [...APPAREL_PRODUCTS, ...BEAUTY_PRODUCTS];

export function brandAccent(brandName: string): AccentName {
  return BRANDS.get(brandName)?.accent ?? 'violet';
}


export function formatPrice(product: Pick<Product, 'price' | 'currency'>): string {
  const symbol = product.currency === 'GBP' ? '£' : product.currency === 'EUR' ? '€' : '$';
  return `${symbol}${product.price.toFixed(product.price % 1 === 0 ? 0 : 2)}`;
}
