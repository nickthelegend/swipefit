/** Verification harness for the skin-informed sort. Not shipped in the app. */
import { contrastLevel, undertoneFromSkinHex } from '../src/logic/color';
import { buildDeck, deriveSeason, seasonLabel } from '../src/logic/matching';
import type { Product, SkinProfile } from '../src/types';

const SWATCHES: [string, string][] = [
  ['Camel', '#C19A6B'], ['Rust', '#A6412A'], ['Olive', '#6B6B3A'], ['Cream', '#F2E8D5'],
  ['Mustard', '#D9A404'], ['Terracotta', '#C86B4A'], ['Warm Brown', '#6B4423'], ['Tomato', '#D94F2B'],
  ['Navy', '#1C2541'], ['Charcoal', '#36393D'], ['True White', '#FBFBFB'], ['Cool Grey', '#9AA3AB'],
  ['Burgundy', '#5C1F2E'], ['Forest', '#1F4D33'], ['Slate Blue', '#4A6484'], ['Plum', '#5A3A5C'],
  ['Indigo Denim', '#3B4A66'], ['Black', '#141414'], ['Oatmeal', '#DCD3C3'], ['Taupe', '#8B7E६E'.replace('६','6')],
  ['Mid Grey', '#7E8285'], ['Stone', '#B8B0A4'], ['Ecru', '#E8E2D4'], ['Washed Black', '#2E2E2E'],
];

const products: Product[] = SWATCHES.map(([colorName, colorHex], i) => ({
  id: `p${i}`, brand: 'Test', name: colorName, category: 'upper_body', mode: 'apparel',
  price: 49, currency: 'USD', productImageUrl: '', brandProductUrl: '',
  colorName, colorHex, sizeInfo: 'XS-XL', fitNote: 'regular',
}));

function profileFor(skinHex: string, hairHex: string): SkinProfile {
  const { undertone, depth, confidence } = undertoneFromSkinHex(skinHex);
  const contrast = contrastLevel(skinHex, hairHex);
  const season = deriveSeason(undertone, depth, contrast);
  return { skinHex, hairHex, eyeHex: null, lipHex: null, eyeColorName: null, hairColorName: null,
    undertone, depth, confidence, contrast, season, concerns: [], scanTimestamp: 0, simulated: true };
}

const people: [string, string, string][] = [
  ['WARM / light  ', '#E5B887', '#6B4423'],
  ['COOL / light  ', '#F0C8C8', '#2B2B2B'],
  ['WARM / deep   ', '#6B4423', '#1A1A1A'],
  ['COOL / medium ', '#A9746B', '#241C1A'],
];

const orders: Record<string, string[]> = {};
for (const [label, skin, hair] of people) {
  const p = profileFor(skin, hair);
  const deck = buildDeck(products, p);
  orders[label] = deck.map((d) => d.product.name);
  console.log(`\n${label} → ${p.undertone}/${p.depth} contrast=${p.contrast} conf=${p.confidence} → ${seasonLabel(p.season)}`);
  console.log('  TOP 6 : ' + deck.slice(0, 6).map((d) => `${d.product.name}(${d.match.score})`).join(', '));
  console.log('  BOTTOM: ' + deck.slice(-4).map((d) => `${d.product.name}(${d.match.score})`).join(', '));
  console.log('  why   : ' + deck[0]!.match.reason);
  console.log('  why   : ' + deck[deck.length - 1]!.match.reason);
}

// The product's central claim: same catalogue, visibly different order.
const a = orders['WARM / light  ']!, b = orders['COOL / light  ']!;
const displaced = a.filter((n, i) => b.indexOf(n) !== i).length;
const topOverlap = a.slice(0, 6).filter((n) => b.slice(0, 6).includes(n)).length;
console.log(`\n=== warm-light vs cool-light: ${displaced}/${a.length} items change position; top-6 overlap ${topOverlap}/6 ===`);
