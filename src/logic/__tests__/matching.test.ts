import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { hexToLch, undertoneFromSkinHex, contrastLevel } from '../color.ts';
import { buildDeck, deriveSeason, garmentWarmth, scoreProduct } from '../matching.ts';
import type { Fit, Product, SkinProfile } from '../../types/index.ts';

/**
 * Locks in the product's central claim: the same catalogue, ordered by a
 * measured skin reading, produces a genuinely different deck for a warm-toned
 * and a cool-toned shopper.
 *
 * That claim was verified by hand at 24 and again at 60 SKUs. Verifying it by
 * hand is worth nothing the next time the scoring weights are touched, which is
 * the whole reason this file exists.
 */

function profileFor(skinHex: string, hairHex = '#2B2118'): SkinProfile {
  const { undertone, depth } = undertoneFromSkinHex(skinHex);
  const contrast = contrastLevel(skinHex, hairHex);
  return {
    skinHex,
    hairHex,
    eyeHex: null,
    lipHex: null,
    eyeColorName: null,
    hairColorName: null,
    undertone,
    depth,
    confidence: 0.8,
    contrast,
    season: deriveSeason(undertone, depth, contrast),
    concerns: [],
    scanTimestamp: 0,
    simulated: false,
    readingSource: 'live',
  };
}

let seq = 0;
function garment(colorHex: string, gender: Fit = 'unisex'): Product {
  seq += 1;
  return {
    id: `p${seq}`,
    brand: 'Test',
    name: `Garment ${seq}`,
    category: 'upper_body',
    mode: 'apparel',
    gender,
    price: 100,
    currency: 'USD',
    productImageUrl: '',
    brandProductUrl: '',
    colorName: colorHex,
    colorHex,
    sizeInfo: 'S-XL',
    fitNote: 'regular',
  };
}

/** A spread wide enough that any real sort has something to disagree about. */
const PALETTE = [
  '#E9492D', '#C25A2E', '#D9A15C', '#EBD22F', '#7E8F3C', '#1F8D42',
  '#2E6E7E', '#31518C', '#4D17F5', '#7B2E8E', '#B03A6B', '#8C2F39',
  '#F2E8DC', '#DCD3C3', '#9A958C', '#3A3A3C', '#0E0E10', '#FFFFFF',
];

const WARM = profileFor('#D9A26E');
const COOL = profileFor('#E7D2C8', '#1B1B1F');

describe('the deck actually re-sorts on skin tone', () => {
  const deck = PALETTE.map((hex) => garment(hex));

  test('the two shoppers are classified differently in the first place', () => {
    // If this fails the rest of the suite proves nothing.
    assert.notEqual(WARM.undertone, COOL.undertone, 'fixtures no longer differ in undertone');
  });

  test('every item changes position between a warm and a cool shopper', () => {
    const warmOrder = buildDeck(deck, WARM).map((c) => c.product.id);
    const coolOrder = buildDeck(deck, COOL).map((c) => c.product.id);

    const moved = warmOrder.filter((id, i) => coolOrder[i] !== id).length;
    assert.equal(moved, deck.length, `only ${moved}/${deck.length} items moved`);
  });

  test('the top of the two decks does not overlap', () => {
    const topWarm = buildDeck(deck, WARM).slice(0, 5).map((c) => c.product.id);
    const topCool = buildDeck(deck, COOL).slice(0, 5).map((c) => c.product.id);
    const shared = topWarm.filter((id) => topCool.includes(id));
    assert.deepEqual(shared, [], `shared top-five: ${shared.join(', ')}`);
  });

  test('ordering is deterministic — same input, same output', () => {
    assert.deepEqual(
      buildDeck(deck, WARM).map((c) => c.product.id),
      buildDeck(deck, WARM).map((c) => c.product.id),
    );
  });

  test('colour is never filtered out, only reordered', () => {
    // The deliberate design decision: a shopper who only ever sees flattering
    // colours cannot tell the sort is doing anything.
    for (const profile of [WARM, COOL]) {
      assert.equal(buildDeck(deck, profile).length, deck.length);
    }
  });

  test('scores stay within 0..100', () => {
    for (const product of deck) {
      for (const profile of [WARM, COOL]) {
        const { score } = scoreProduct(product, profile);
        assert.ok(score >= 0 && score <= 100, `${product.colorHex} -> ${score}`);
      }
    }
  });
});

describe('gender filter', () => {
  const deck = [
    garment('#E9492D', 'men'),
    garment('#4D17F5', 'women'),
    garment('#DCD3C3', 'unisex'),
  ];
  const ids = (shopFor: 'men' | 'women' | 'everything') =>
    buildDeck(deck, WARM, 'apparel', shopFor).map((c) => c.product.gender).sort();

  test('everything is the default and filters nothing', () => {
    assert.equal(buildDeck(deck, WARM).length, 3);
    assert.equal(buildDeck(deck, WARM, 'apparel', 'everything').length, 3);
  });

  test("women's rail excludes menswear but keeps unisex", () => {
    assert.deepEqual(ids('women'), ['unisex', 'women']);
  });

  test("men's rail excludes womenswear but keeps unisex", () => {
    assert.deepEqual(ids('men'), ['men', 'unisex']);
  });

  test('unisex is the only overlap between the two rails', () => {
    const men = new Set(buildDeck(deck, WARM, 'apparel', 'men').map((c) => c.product.id));
    const women = buildDeck(deck, WARM, 'apparel', 'women').map((c) => c.product.id);
    const shared = women.filter((id) => men.has(id));
    assert.equal(shared.length, 1);
  });
});

describe('garmentWarmth', () => {
  test('orange reads warm and blue reads cool', () => {
    assert.ok(garmentWarmth(hexToLch('#E9492D')) > 0.3);
    assert.ok(garmentWarmth(hexToLch('#31518C')) < -0.3);
  });

  test('near-neutrals land near zero rather than being forced onto a side', () => {
    // Black, oatmeal and indigo denim are all near-universal. A model that
    // pushes them to an extreme mis-sorts most of a real catalogue, since most
    // of a real catalogue is low chroma.
    for (const hex of ['#0E0E10', '#DCD3C3', '#FFFFFF', '#9A958C']) {
      assert.ok(Math.abs(garmentWarmth(hexToLch(hex))) < 0.35, `${hex}`);
    }
  });

  test('stays within -1..1', () => {
    for (const hex of PALETTE) {
      const w = garmentWarmth(hexToLch(hex));
      assert.ok(w >= -1 && w <= 1, `${hex} -> ${w}`);
    }
  });
});

describe('deriveSeason', () => {
  test('warm and cool never share a season at the same depth', () => {
    for (const depth of ['light', 'deep'] as const) {
      assert.notEqual(
        deriveSeason('warm', depth, 'medium'),
        deriveSeason('cool', depth, 'medium'),
      );
    }
  });

  test('neutral undertone falls back to contrast rather than throwing', () => {
    for (const contrast of ['low', 'medium', 'high'] as const) {
      assert.ok(deriveSeason('neutral', 'light', contrast));
    }
  });
});
