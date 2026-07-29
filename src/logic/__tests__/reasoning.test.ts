import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { assessRegret, fitVerdict } from '../reasoning.ts';
import type { MatchVerdict, Product, SkinProfile } from '../../types/index.ts';

/**
 * Regret is an openly declared heuristic, not a measurement, and the module says
 * so at length. That does not make it exempt from being tested — it makes the
 * test different. There is nothing here to validate the number against, so what
 * is pinned instead is that each stated input actually moves the output in the
 * stated direction and by the stated amount, that the bands stay ordered, and
 * that the sentence shown to a shopper names the reasons the arithmetic
 * actually used.
 *
 * The last one is the point. A reasoning layer that cites a driver it did not
 * apply, or applies one it does not cite, is decoration — and a shopper only has
 * to compare two cards once to notice.
 */

function profileWith(contrast: SkinProfile['contrast']): SkinProfile {
  return {
    skinHex: '#D9A26E',
    hairHex: '#2B2118',
    eyeHex: null,
    lipHex: null,
    eyeColorName: null,
    hairColorName: null,
    undertone: 'warm',
    depth: 'light',
    confidence: 0.8,
    contrast,
    season: 'spring',
    concerns: [],
    scanTimestamp: 0,
    simulated: false,
    readingSource: 'live',
  };
}

const MEDIUM = profileWith('medium');
const HIGH = profileWith('high');

/** assessRegret takes the verdict as an argument, so it can be stated outright. */
const verdict = (band: MatchVerdict['band']): MatchVerdict => ({ score: 60, band, reason: '' });

/**
 * Deliberately inert baseline: an upper-body garment (the most forgiving
 * category), a six-step size run, and a cut description matching neither the
 * tight nor the forgiving pattern. Every test below moves exactly one thing.
 */
function garment(over: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    brand: 'Test',
    name: 'Garment',
    category: 'upper_body',
    mode: 'apparel',
    gender: 'unisex',
    price: 100,
    currency: 'USD',
    productImageUrl: '',
    brandProductUrl: '',
    colorName: 'stone',
    colorHex: '#DCD3C3',
    sizeInfo: 'XS–XXL',
    fitNote: 'draped',
    ...over,
  };
}

const riskOf = (over: Partial<Product>, band: MatchVerdict['band'], profile = MEDIUM) =>
  assessRegret(garment(over), verdict(band), profile).risk;

/* -------------------------------------------------------------------------
 * assessRegret — the drivers
 * ---------------------------------------------------------------------- */

describe('assessRegret drivers', () => {
  const BASE = riskOf({}, 'good');

  test('the baseline fixture is genuinely inert', () => {
    // If the baseline picks up a driver by accident, every delta below is
    // measured from the wrong place and the whole block stops meaning anything.
    assert.equal(BASE, 18);
    assert.equal(assessRegret(garment(), verdict('good'), MEDIUM).band, 'low');
  });

  test('a fit-sensitive category carries more risk than a forgiving one', () => {
    const trousers = riskOf({ category: 'lower_body' }, 'good');
    const dress = riskOf({ category: 'full_body' }, 'good');
    const shoes = riskOf({ category: 'shoes' }, 'good');
    const tee = riskOf({ category: 'upper_body' }, 'good');

    // Trousers strand people that tees do not, and the ordering is the claim.
    const byCategory = [trousers, dress, shoes, tee];
    assert.deepEqual([...byCategory].sort((a, b) => b - a), byCategory, `${byCategory}`);
    assert.ok(trousers > tee);
  });

  test('a colour that fights the wearer adds risk; a hero colour removes some', () => {
    assert.equal(riskOf({}, 'fights') - BASE, 16);
    assert.equal(riskOf({}, 'hero') - BASE, -6);
    // 'good' and 'fine' are the unopinionated middle at medium contrast.
    assert.equal(riskOf({}, 'fine'), BASE);
  });

  test('a short size run adds risk, in both letter and waist notation', () => {
    assert.equal(riskOf({ sizeInfo: 'S–M' }, 'good') - BASE, 10);
    assert.equal(riskOf({ sizeInfo: '30–32' }, 'good') - BASE, 10);

    // A wide run in either notation is not penalised.
    assert.equal(riskOf({ sizeInfo: '28–38 waist' }, 'good'), BASE);
    assert.equal(riskOf({ sizeInfo: 'XS–XXL' }, 'good'), BASE);
  });

  test('size info that cannot be parsed adds nothing rather than being guessed at', () => {
    // "One size" and "true to size" carry no run to count. Treating an
    // unparseable string as a narrow run would invent a penalty out of a
    // formatting difference between two retailers' feeds.
    for (const sizeInfo of ['One size', 'true to size', '']) {
      assert.equal(riskOf({ sizeInfo }, 'good'), BASE, sizeInfo);
    }
  });

  test('a cut that narrows who it fits adds risk; a forgiving one removes some', () => {
    assert.equal(riskOf({ fitNote: 'slim fit' }, 'good') - BASE, 9);
    assert.equal(riskOf({ fitNote: 'cropped' }, 'good') - BASE, 9);
    assert.equal(riskOf({ fitNote: 'regular fit' }, 'good') - BASE, -5);
    assert.equal(riskOf({ fitNote: 'classic straight' }, 'good') - BASE, -5);
  });

  test('hard contrast only penalises the merely-workable colours', () => {
    // A high-contrast wearer in a garment sitting near their own skin value
    // tends to bounce it — but that is a statement about the ambiguous middle,
    // not about a colour that already scored well or badly.
    assert.equal(riskOf({}, 'fine', HIGH) - riskOf({}, 'fine', MEDIUM), 4);
    assert.equal(riskOf({}, 'good', HIGH), riskOf({}, 'good', MEDIUM));
    assert.equal(riskOf({}, 'hero', HIGH), riskOf({}, 'hero', MEDIUM));
    assert.equal(riskOf({}, 'fights', HIGH), riskOf({}, 'fights', MEDIUM));
  });
});

/* -------------------------------------------------------------------------
 * assessRegret — the shape of the answer
 * ---------------------------------------------------------------------- */

describe('assessRegret bounds and bands', () => {
  const CATEGORIES = ['lower_body', 'full_body', 'shoes', 'upper_body'] as const;
  const BANDS = ['hero', 'good', 'fine', 'fights'] as const;
  const CUTS = ['slim', 'regular', 'draped'];
  const SIZES = ['S–M', 'XS–XXL', '30–32', 'One size'];
  const RANK = { low: 0, medium: 1, high: 2 };

  function every(fn: (product: Product, band: MatchVerdict['band'], profile: SkinProfile) => void) {
    for (const category of CATEGORIES)
      for (const fitNote of CUTS)
        for (const sizeInfo of SIZES)
          for (const profile of [MEDIUM, HIGH])
            for (const band of BANDS) fn(garment({ category, fitNote, sizeInfo }), band, profile);
  }

  test('risk never leaves 6..72 and never lands on a non-integer', () => {
    every((product, band, profile) => {
      const { risk } = assessRegret(product, verdict(band), profile);
      assert.ok(risk >= 6 && risk <= 72, `${product.category}/${band} -> ${risk}`);
      assert.ok(Number.isInteger(risk), `${risk}`);
    });
  });

  test('the band is monotone in the risk, and all three bands are reachable', () => {
    // The card shows the band and the sheet shows the number, so any pair where
    // the higher risk carries the calmer band is visible to a shopper. A single
    // threshold typo produces exactly that.
    const seen: { risk: number; band: 'low' | 'medium' | 'high' }[] = [];
    every((product, band, profile) => {
      const { risk, band: flag } = assessRegret(product, verdict(band), profile);
      seen.push({ risk, band: flag });
    });

    for (const a of seen) {
      for (const b of seen) {
        if (a.risk > b.risk) {
          assert.ok(RANK[a.band] >= RANK[b.band], `${a.risk}/${a.band} vs ${b.risk}/${b.band}`);
        }
      }
    }
    assert.equal(new Set(seen.map((s) => s.band)).size, 3, 'a band is unreachable');
  });

  test('a fighting colour is never scored safer than a hero colour on the same garment', () => {
    every((product, _band, profile) => {
      const fights = assessRegret(product, verdict('fights'), profile);
      const hero = assessRegret(product, verdict('hero'), profile);
      assert.ok(fights.risk > hero.risk, `${product.category}/${product.fitNote}`);
      assert.ok(RANK[fights.band] >= RANK[hero.band]);
    });
  });

  test('every verdict comes with a non-empty reason', () => {
    every((product, band, profile) => {
      const { reason } = assessRegret(product, verdict(band), profile);
      assert.ok(reason.trim().length > 20, `${reason}`);
      assert.match(reason, /risk/i);
    });
  });
});

/* -------------------------------------------------------------------------
 * assessRegret — the sentence
 * ---------------------------------------------------------------------- */

describe('assessRegret copy', () => {
  test('names the drivers it actually applied', () => {
    const colourOnly = assessRegret(garment(), verdict('fights'), MEDIUM).reason;
    assert.match(colourOnly, /undertone/);
    assert.doesNotMatch(colourOnly, /size run/);

    const sizeOnly = assessRegret(garment({ sizeInfo: 'S–M' }), verdict('good'), MEDIUM).reason;
    assert.match(sizeOnly, /size run is short/);
    assert.doesNotMatch(sizeOnly, /undertone/);

    const cutOnly = assessRegret(garment({ fitNote: 'skinny' }), verdict('good'), MEDIUM).reason;
    assert.match(cutOnly, /the cut is skinny/);
  });

  test('stops at two drivers rather than reciting the whole list', () => {
    // Three drivers fire here. The sentence is read on a card at a glance, so it
    // takes the two that moved the number most and drops the rest.
    const { risk, band, reason } = assessRegret(
      garment({ category: 'lower_body', sizeInfo: 'S–M', fitNote: 'slim tapered' }),
      verdict('fights'),
      MEDIUM,
    );

    assert.equal(risk, 69);
    assert.equal(band, 'high');
    assert.match(reason, /undertone/);
    assert.match(reason, /size run is short/);
    assert.doesNotMatch(reason, /slim/, 'the third driver was recited anyway');
  });

  test('addresses trousers as a pair and everything else as a single thing', () => {
    const trousers = assessRegret(
      garment({ category: 'lower_body', sizeInfo: 'S–M', fitNote: 'slim' }),
      verdict('fights'),
      MEDIUM,
    );
    const top = assessRegret(
      garment({ category: 'upper_body', sizeInfo: 'S–M', fitNote: 'slim' }),
      verdict('fights'),
      MEDIUM,
    );

    assert.equal(trousers.band, 'high');
    assert.equal(top.band, 'high');
    assert.match(trousers.reason, /risk on these/);
    assert.match(top.reason, /risk on this/);
  });
});

/* -------------------------------------------------------------------------
 * fitVerdict
 * ---------------------------------------------------------------------- */

describe('fitVerdict', () => {
  test('always leads with the garment’s own cut, capitalised and closed', () => {
    for (const category of ['upper_body', 'lower_body', 'full_body', 'shoes'] as const) {
      for (const profile of [MEDIUM, HIGH]) {
        const line = fitVerdict(garment({ category, fitNote: 'relaxed through the body' }), profile);
        assert.ok(line.startsWith('Relaxed through the body.'), `${category} -> ${line}`);
        assert.ok(line.endsWith('.'), line);
      }
    }
  });

  test('surrounding whitespace in the feed does not reach the card', () => {
    assert.equal(fitVerdict(garment({ fitNote: '  slim fit  ' }), MEDIUM), 'Slim fit.');
  });

  test('says something concrete and category-specific about where the fit is decided', () => {
    assert.match(fitVerdict(garment({ category: 'lower_body' }), MEDIUM), /waist/);
    assert.match(fitVerdict(garment({ category: 'full_body' }), MEDIUM), /shoulder/);
  });

  test('mentions contrast only when the wearer actually carries it', () => {
    const withContrast = fitVerdict(garment({ category: 'upper_body' }), HIGH);
    const without = fitVerdict(garment({ category: 'upper_body' }), MEDIUM);

    assert.match(withContrast, /contrast/);
    assert.doesNotMatch(without, /contrast/);
    assert.ok(withContrast.length > without.length);
  });

  test('category beats colouring — trousers never get the contrast line', () => {
    // Both branches could fire for a high-contrast wearer in trousers. Sizing
    // off the waist is the more useful of the two, and only one line is shown.
    const line = fitVerdict(garment({ category: 'lower_body' }), HIGH);
    assert.match(line, /waist/);
    assert.doesNotMatch(line, /contrast/);
  });
});
