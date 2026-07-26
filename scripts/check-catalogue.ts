/** Divergence and coverage over the REAL catalogue. Offline, no API calls. */
import { contrastLevel, undertoneFromSkinHex } from '../src/logic/color';
import { buildDeck, deriveSeason, seasonLabel } from '../src/logic/matching';
import type { Product, SkinProfile } from '../src/types';
import raw from '../src/data/catalog.json';

const products: Product[] = (raw as any[]).map((r, i) => ({ ...r, id: `p${i}`, mode: 'apparel' as const }));

function profileFor(skin: string, hair: string): SkinProfile {
  const { undertone, depth, confidence } = undertoneFromSkinHex(skin);
  const contrast = contrastLevel(skin, hair);
  return { skinHex: skin, hairHex: hair, eyeHex: null, lipHex: null, eyeColorName: null,
    hairColorName: null, undertone, depth, confidence, contrast,
    season: deriveSeason(undertone, depth, contrast), concerns: [], scanTimestamp: 0,
    simulated: false, readingSource: 'live' };
}

const people: [string, string, string][] = [
  ['warm / light ', '#E5B887', '#6B4423'],
  ['cool / light ', '#F0C8C8', '#2B2B2B'],
  ['warm / deep  ', '#6B4423', '#1A1A1A'],
  ['cool / medium', '#A9746B', '#241C1A'],
];

const orders: Record<string, string[]> = {};
for (const [label, skin, hair] of people) {
  const p = profileFor(skin, hair);
  const deck = buildDeck(products, p);
  orders[label] = deck.map((d) => d.product.id);
  console.log(`\n${label} ${p.undertone}/${p.depth} -> ${seasonLabel(p.season)}`);
  console.log('  top 5: ' + deck.slice(0, 5).map((d) => `${d.product.brand}/${d.product.colorName}(${d.match.score})`).join(', '));
  console.log('  bot 3: ' + deck.slice(-3).map((d) => `${d.product.colorName}(${d.match.score})`).join(', '));
}

console.log(`\n${'='.repeat(74)}`);
const names = Object.keys(orders);
for (let i = 0; i < names.length; i++)
  for (let j = i + 1; j < names.length; j++) {
    const a = orders[names[i]!]!, b = orders[names[j]!]!;
    const moved = a.filter((id, k) => b.indexOf(id) !== k).length;
    const top10 = a.slice(0, 10).filter((id) => b.slice(0, 10).includes(id)).length;
    console.log(`${names[i]} vs ${names[j]}: ${moved}/${a.length} moved, top-10 overlap ${top10}/10`);
  }
const cats = new Set(products.map((p) => p.category));
console.log(`\ncatalogue: ${products.length} SKUs, ${new Set(products.map((p) => p.brand)).size} brands, categories ${[...cats].join('/')}`);
