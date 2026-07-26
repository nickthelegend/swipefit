import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { ALL_PRODUCTS, APPAREL_PRODUCTS, BRANDS, brandAccent, formatPrice } from '../../data/catalog.ts';

/**
 * Runs against the real shipping catalogue, not a fixture.
 *
 * catalog.json is maintained by hand and by generation, and it has drifted
 * before — a regenerated file silently swapped one brand for another and shifted
 * every brand's accent colour, because accent assignment depends on
 * first-appearance order. These are the invariants that drift breaks first.
 *
 * Nothing here touches the network, so it says nothing about whether the URLs
 * still resolve. Six Massimo Dutti links were dead while passing every check in
 * this file. Link liveness needs `npm run check:links`.
 */

describe('catalogue integrity', () => {
  test('is not empty', () => {
    assert.ok(APPAREL_PRODUCTS.length >= 60, `only ${APPAREL_PRODUCTS.length} apparel products`);
  });

  test('ids are unique', () => {
    const seen = new Map<string, number>();
    for (const p of ALL_PRODUCTS) seen.set(p.id, (seen.get(p.id) ?? 0) + 1);
    const dupes = [...seen].filter(([, n]) => n > 1).map(([id]) => id);
    assert.deepEqual(dupes, [], `duplicate ids: ${dupes.join(', ')}`);
  });

  test('ids are URL- and filesystem-safe', () => {
    // Ids key the on-device render cache, so a stray slash or space becomes a
    // path traversal or a cache miss rather than a cosmetic problem.
    for (const p of ALL_PRODUCTS) {
      assert.match(p.id, /^[a-z0-9-]+$/, `${p.id} (${p.name})`);
    }
  });

  test('every product declares a gender the filter understands', () => {
    for (const p of ALL_PRODUCTS) {
      assert.ok(
        ['men', 'women', 'unisex'].includes(p.gender),
        `${p.name} -> ${String(p.gender)}`,
      );
    }
  });

  test('gendered garments are actually gendered', () => {
    // A dress or skirt tagged men or unisex means the gender data has been
    // regenerated badly — this is the failure that put womenswear on a male
    // demo model in the first place.
    for (const p of APPAREL_PRODUCTS) {
      if (/\b(dress|skirt|robe)\b/i.test(p.name)) {
        assert.equal(p.gender, 'women', `${p.name} is tagged ${p.gender}`);
      }
    }
  });

  test('colours are parseable six-digit hex', () => {
    // The entire sort is derived from these. A malformed value does not throw,
    // it silently scores as black, which is far worse than a crash.
    for (const p of ALL_PRODUCTS) {
      assert.match(p.colorHex, /^#[0-9a-fA-F]{6}$/, `${p.name} -> ${p.colorHex}`);
    }
  });

  test('categories are ones the try-on API accepts', () => {
    for (const p of APPAREL_PRODUCTS) {
      assert.ok(
        ['upper_body', 'lower_body', 'full_body', 'shoes'].includes(p.category),
        `${p.name} -> ${p.category}`,
      );
    }
  });

  test('both halves of an outfit exist, or the builder is unreachable', () => {
    const tops = APPAREL_PRODUCTS.filter((p) => p.category === 'upper_body');
    const bottoms = APPAREL_PRODUCTS.filter((p) => p.category === 'lower_body');
    assert.ok(tops.length > 0 && bottoms.length > 0);
  });

  test('handoff URLs are absolute https', () => {
    // These open in an external browser. A relative or http URL either fails or
    // downgrades the connection.
    for (const p of APPAREL_PRODUCTS) {
      assert.match(p.brandProductUrl, /^https:\/\//, `${p.name} -> ${p.brandProductUrl}`);
    }
  });

  test('no handoff URL is a known-dead Massimo Dutti pattern', () => {
    // Their product ids are zero-padded to eight digits and the paths carry no
    // .html suffix. The un-padded form returns HTTP 200 with a soft-404 body, so
    // a status check does not catch it — hence pinning the shape here.
    for (const p of APPAREL_PRODUCTS) {
      if (p.brandProductUrl.includes('massimodutti.com')) {
        assert.doesNotMatch(p.brandProductUrl, /\.html$/, `${p.name} uses the dead .html form`);
        assert.match(p.brandProductUrl, /-l\d{8}$/, `${p.name} id is not zero-padded to 8 digits`);
      }
    }
  });

  test('garment images are absolute URLs the render API can fetch', () => {
    for (const p of APPAREL_PRODUCTS) {
      assert.match(p.productImageUrl, /^https:\/\//, `${p.name}`);
    }
  });

  test('prices are positive and finite', () => {
    for (const p of ALL_PRODUCTS) {
      assert.ok(Number.isFinite(p.price) && p.price > 0, `${p.name} -> ${p.price}`);
    }
  });
});

describe('brand accents', () => {
  test('every product resolves to a brand', () => {
    for (const p of ALL_PRODUCTS) {
      assert.ok(BRANDS.has(p.brand), `${p.brand} is not in BRANDS`);
    }
  });

  test('a brand keeps one accent across the whole catalogue', () => {
    // Colour is how a brand stays recognisable across the deck, the bag, the
    // directory and the console. Two accents for one brand breaks that.
    const byBrand = new Map<string, Set<string>>();
    for (const p of ALL_PRODUCTS) {
      if (!byBrand.has(p.brand)) byBrand.set(p.brand, new Set());
      byBrand.get(p.brand)!.add(brandAccent(p.brand));
    }
    for (const [brand, accents] of byBrand) {
      assert.equal(accents.size, 1, `${brand} has accents ${[...accents].join(', ')}`);
    }
  });

  test('accents are drawn only from the four-colour cycle', () => {
    for (const brand of BRANDS.keys()) {
      assert.ok(['violet', 'tomato', 'forest', 'acid'].includes(brandAccent(brand)), brand);
    }
  });
});

describe('formatPrice', () => {
  test('picks the right symbol per currency', () => {
    assert.equal(formatPrice({ price: 40, currency: 'USD' }), '$40');
    assert.equal(formatPrice({ price: 40, currency: 'GBP' }), '£40');
    assert.equal(formatPrice({ price: 40, currency: 'EUR' }), '€40');
  });

  test('shows pence only when there are pence', () => {
    assert.equal(formatPrice({ price: 40, currency: 'USD' }), '$40');
    assert.equal(formatPrice({ price: 39.5, currency: 'USD' }), '$39.50');
  });
});
