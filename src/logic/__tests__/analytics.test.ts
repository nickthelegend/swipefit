import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import {
  blindComparison,
  buildDashboard,
  colourVerdict,
  sizeFriction,
  type Dashboard,
  type SkuRow,
} from '../analytics.ts';
import { contrastLevel, undertoneFromSkinHex } from '../color.ts';
import { deriveSeason, scoreProduct } from '../matching.ts';
import type { CartItem, Product, SkinProfile, SwipeEvent } from '../../types/index.ts';

/**
 * The brand console's whole claim is that every figure on it is measured. That
 * claim only survives if the aggregation is right, so this file goes after the
 * two things that can quietly break it: the arithmetic (a rate computed off an
 * empty denominator, a weight that stopped summing to one) and the honesty
 * guards (MIN_SAMPLE, the null returns) that stop a number being quoted before
 * it means anything.
 *
 * Note what is NOT asserted here: nothing checks that the friction weights are
 * the *right* weights. They are a judgement call, not a measurement. What is
 * checked is that they stay ordered — hesitation must outweigh a reversal,
 * which outweighs nothing at all — because a reordering there silently changes
 * which SKU a brand is told to look at first.
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

const WARM = profileFor('#D9A26E');

function garment(id: string, over: Partial<Product> = {}): Product {
  return {
    id,
    brand: 'Test',
    name: `Garment ${id}`,
    category: 'upper_body',
    mode: 'apparel',
    gender: 'unisex',
    price: 100,
    currency: 'USD',
    productImageUrl: '',
    brandProductUrl: '',
    colorName: 'colour',
    colorHex: '#DCD3C3',
    sizeInfo: 'XS–XXL',
    fitNote: 'regular',
    ...over,
  };
}

function swipe(productId: string, over: Partial<SwipeEvent> = {}): SwipeEvent {
  return {
    productId,
    direction: 'left',
    timestamp: 0,
    matchScore: 50,
    dwellMs: 0,
    inspected: false,
    hesitated: false,
    confirmed: false,
    blind: false,
    undone: false,
    ...over,
  };
}

const times = <T,>(n: number, make: (i: number) => T): T[] => Array.from({ length: n }, (_, i) => make(i));

function bagged(product: Product, sentToBrand = false): CartItem {
  return { product, addedAt: 0, sentToBrand, renderUri: null };
}

/** Named lookup, so a missing row fails as a missing row rather than as a NaN. */
function rowFor(dashboard: Dashboard, id: string): SkuRow {
  const row = dashboard.rows.find((r) => r.product.id === id);
  assert.ok(row, `no row for ${id}`);
  return row;
}

/** One product, one set of events, one row. */
function soleRow(swipes: SwipeEvent[], product = garment('a')): SkuRow {
  return rowFor(buildDashboard([product], swipes, [], WARM), product.id);
}

/* -------------------------------------------------------------------------
 * buildDashboard
 * ---------------------------------------------------------------------- */

describe('buildDashboard', () => {
  test('a SKU nobody has seen produces no row at all', () => {
    // An unseen SKU at zero would render as a measurement of indifference. It
    // is an absence, and the screen must not print absences as data.
    const products = [garment('seen'), garment('unseen-a'), garment('unseen-b')];
    const { rows, hasData } = buildDashboard(products, [swipe('seen')], [], WARM);

    assert.deepEqual(rows.map((r) => r.product.id), ['seen']);
    assert.equal(hasData, true);
  });

  test('an empty session reports no data rather than zeroes', () => {
    const { rows, hasData, totals } = buildDashboard([garment('a')], [], [], WARM);
    assert.deepEqual(rows, []);
    assert.equal(hasData, false);
    // Every one of these is a division by zero waiting to happen.
    assert.equal(totals.rightRate, 0);
    assert.equal(totals.handoffRate, 0);
    assert.equal(totals.medianDwellMs, 0);
  });

  test('a single swipe produces no quotable note', () => {
    /**
     * frictionNote states a behavioural finding to a partner who may act on it,
     * so it now requires MIN_SAMPLE impressions rather than merely more than
     * zero. One hesitation used to yield a 100% hesitation rate and the note
     * "Started to add it, then pulled back" — on a screen whose header promises
     * every number on it is measured.
     *
     * The rate itself is still computed and still says 100, because it is
     * arithmetically true and the row shows the impression count beside it. The
     * note is the part that makes a claim, so the note is the part that waits.
     */
    const row = soleRow([swipe('a', { hesitated: true })]);

    assert.equal(row.impressions, 1);
    assert.equal(row.hesitationRate, 100);
    assert.equal(row.frictionNote, null);
  });

  test('the same note appears once the sample is large enough', () => {
    // The guard must delay the finding, not delete it.
    const row = soleRow(times(3, () => swipe('a', { hesitated: true })));

    assert.equal(row.impressions, 3);
    assert.equal(row.frictionNote, 'Started to add it, then pulled back');
  });

  test('a maximally difficult SKU scores exactly 100', () => {
    // The friction weights must sum to 1. If they drift the scale stops being a
    // percentage and the 0–100 contract in the type is a lie.
    const events = times(4, () =>
      swipe('a', { dwellMs: 6000, inspected: true, hesitated: true, undone: true }),
    );
    assert.equal(soleRow(events).friction, 100);
  });

  test('friction stays inside 0..100 across every combination of signals', () => {
    for (const dwellMs of [0, 300, 6000, 120_000]) {
      for (const inspected of [false, true]) {
        for (const hesitated of [false, true]) {
          for (const undone of [false, true]) {
            const { friction } = soleRow(
              times(3, () => swipe('a', { dwellMs, inspected, hesitated, undone })),
            );
            assert.ok(
              friction >= 0 && friction <= 100,
              `${dwellMs}/${inspected}/${hesitated}/${undone} -> ${friction}`,
            );
          }
        }
      }
    }
  });

  test('longer deliberation reads as more friction, up to the six-second ceiling', () => {
    const frictionAt = (dwellMs: number) =>
      soleRow(times(3, () => swipe('a', { dwellMs }))).friction;

    assert.ok(frictionAt(5000) > frictionAt(500), 'dwell is not moving the score');
    // Normalised against 6s: past that, someone put the phone down. Treating a
    // two-minute dwell as twenty times the friction of a six-second one would
    // let one abandoned session dominate the whole table.
    assert.equal(frictionAt(60_000), frictionAt(6000));
  });

  test('hesitation outweighs inspection, which outweighs a reversal', () => {
    const products = [garment('hesitated'), garment('inspected'), garment('undone')];
    const swipes = [
      ...times(4, () => swipe('hesitated', { hesitated: true })),
      ...times(4, () => swipe('inspected', { inspected: true })),
      ...times(4, () => swipe('undone', { undone: true })),
    ];
    const dashboard = buildDashboard(products, swipes, [], WARM);
    const hesitated = rowFor(dashboard, 'hesitated').friction;
    const inspected = rowFor(dashboard, 'inspected').friction;
    const undone = rowFor(dashboard, 'undone').friction;

    assert.ok(hesitated > inspected, `hesitated ${hesitated} vs inspected ${inspected}`);
    assert.ok(inspected > undone, `inspected ${inspected} vs undone ${undone}`);

    // And the table leads with the hardest decision, since that is the row a
    // brand is being asked to act on.
    assert.deepEqual(dashboard.rows.map((r) => r.product.id), ['hesitated', 'inspected', 'undone']);
  });

  test('a confirm sheet counts as hesitation even when the gesture never retreated', () => {
    // Both are the same observation: they were made to stop and think before it
    // committed. Counting only the gesture would under-report exactly the
    // high-risk items the sheet exists to catch.
    const row = soleRow([swipe('a', { confirmed: true })]);
    assert.equal(row.hesitationRate, 100);
    assert.ok(row.friction > 0);
  });

  test('events rehydrated from before the behavioural fields existed do not produce NaN', () => {
    // A stale install rehydrates swipes with no dwellMs. Left uncoerced this
    // renders NaN across the entire screen rather than failing loudly.
    const legacy = {
      productId: 'a',
      direction: 'right',
      timestamp: 0,
      matchScore: 61,
    } as unknown as SwipeEvent;

    const dashboard = buildDashboard([garment('a')], [legacy], [], WARM);
    const row = rowFor(dashboard, 'a');
    const numbers = [
      row.rightRate,
      row.medianDwellMs,
      row.inspectRate,
      row.hesitationRate,
      row.undoRate,
      row.friction,
      dashboard.totals.rightRate,
      dashboard.totals.medianDwellMs,
      dashboard.totals.inspectRate,
      dashboard.totals.hesitationRate,
    ];
    for (const n of numbers) assert.ok(Number.isFinite(n), `${n}`);
    assert.equal(row.rightRate, 100);
  });

  test('bag state is read from the cart, and handoff only from what was actually sent', () => {
    const kept = garment('kept');
    const sent = garment('sent');
    const products = [kept, sent, garment('neither')];
    const swipes = products.map((p) => swipe(p.id, { direction: 'right' }));
    const cart = [bagged(kept), bagged(sent, true)];

    const dashboard = buildDashboard(products, swipes, cart, WARM);

    assert.deepEqual(
      [rowFor(dashboard, 'kept').addedToBag, rowFor(dashboard, 'kept').handedOff],
      [true, false],
      'an item in the bag was reported as handed off to the brand',
    );
    assert.deepEqual(
      [rowFor(dashboard, 'sent').addedToBag, rowFor(dashboard, 'sent').handedOff],
      [true, true],
    );
    assert.equal(rowFor(dashboard, 'neither').addedToBag, false);
    assert.equal(dashboard.totals.bagged, 2);
    assert.equal(dashboard.totals.handedOff, 1);
    assert.equal(dashboard.totals.handoffRate, 50);
  });
});

/* -------------------------------------------------------------------------
 * blindComparison
 * ---------------------------------------------------------------------- */

describe('blindComparison', () => {
  test('returns nothing at all when there is nothing to compare', () => {
    assert.equal(blindComparison([]), null);
  });

  test('gap is revealed-minus-blind, so brand pull is the positive direction', () => {
    const swipes = [
      ...times(4, (i) => swipe('a', { blind: true, direction: i < 1 ? 'right' : 'left' })),
      ...times(4, (i) => swipe('a', { blind: false, direction: i < 3 ? 'right' : 'left' })),
    ];
    const result = blindComparison(swipes)!;

    assert.equal(result.blindSeen, 4);
    assert.equal(result.revealedSeen, 4);
    assert.equal(result.blindKeep, 25);
    assert.equal(result.revealedKeep, 75);
    // Seeing the label made them 50 points more likely to keep it. A sign flip
    // here inverts the single number the whole screen is built to sell.
    assert.equal(result.gap, 50);
  });

  test('significance needs MIN_SAMPLE in BOTH arms, not overall', () => {
    const arm = (blind: boolean, n: number) => times(n, () => swipe('a', { blind }));

    // Twelve observations, but two of them blind — the gap is one shopper wide.
    assert.equal(blindComparison([...arm(true, 2), ...arm(false, 10)])!.significant, false);
    assert.equal(blindComparison([...arm(true, 10), ...arm(false, 2)])!.significant, false);
    assert.equal(blindComparison([...arm(true, 3), ...arm(false, 3)])!.significant, true);
  });

  test('a one-sided session is never significant', () => {
    // With no revealed arm, revealedKeep falls out of the empty-denominator
    // guard as 0 and the gap becomes the negated blind rate — a real-looking
    // number with nothing behind it. `significant` is the only thing standing
    // between that and the screen.
    const blindOnly = times(8, () => swipe('a', { blind: true, direction: 'right' }));
    const result = blindComparison(blindOnly)!;

    assert.equal(result.revealedSeen, 0);
    assert.equal(result.significant, false);
  });
});

/* -------------------------------------------------------------------------
 * colourVerdict
 * ---------------------------------------------------------------------- */

/**
 * Chosen by hand against the warm-spring fixture, then pinned below. Picking
 * them dynamically off scoreProduct would make the aggregation tests agree with
 * the scorer by construction and measure nothing.
 */
const HERO = ['#A34B2A', '#9E3B2E', '#B2582B', '#A0522D'];
const FIGHTS = ['#0000FF', '#00BFFF', '#3355EE', '#5566FF'];
const MIDDLING = ['#CC5500', '#2244AA'];

describe('colourVerdict', () => {
  const heroes = HERO.map((hex, i) => garment(`hero-${i}`, { colorHex: hex }));
  const fights = FIGHTS.map((hex, i) => garment(`fight-${i}`, { colorHex: hex }));
  const middling = MIDDLING.map((hex, i) => garment(`mid-${i}`, { colorHex: hex }));
  const products = [...heroes, ...fights, ...middling];

  test('the fixtures still land in the bands the rest of this block assumes', () => {
    // If the scorer is retuned these stop being heroes and fights, and every
    // assertion below becomes vacuously true without failing.
    for (const p of heroes) assert.equal(scoreProduct(p, WARM).band, 'hero', p.colorHex);
    for (const p of fights) assert.equal(scoreProduct(p, WARM).band, 'fights', p.colorHex);
    for (const p of middling) {
      assert.ok(['good', 'fine'].includes(scoreProduct(p, WARM).band), p.colorHex);
    }
  });

  test('returns nothing without a reading, and nothing without swipes', () => {
    const swipes = products.map((p) => swipe(p.id));
    assert.equal(colourVerdict(products, swipes, null), null);
    assert.equal(colourVerdict(products, [], WARM), null);
  });

  test('returns nothing when only middling colours were seen', () => {
    // The verdict is a story about the two extremes. With neither bucket
    // populated there is no story, and printing 0% against 0% would imply one.
    const swipes = middling.map((p) => swipe(p.id, { direction: 'right' }));
    assert.equal(colourVerdict(products, swipes, WARM), null);
  });

  test('keeps the two buckets separate and rates them independently', () => {
    const swipes = [
      // Three of four heroes kept.
      ...heroes.map((p, i) => swipe(p.id, { direction: i < 3 ? 'right' : 'left' })),
      // One of four fights kept.
      ...fights.map((p, i) => swipe(p.id, { direction: i < 1 ? 'right' : 'left' })),
      // Middling colours belong to neither bucket and must not dilute either.
      ...middling.map((p) => swipe(p.id, { direction: 'right' })),
    ];
    const result = colourVerdict(products, swipes, WARM)!;

    assert.equal(result.flattered, 4);
    assert.equal(result.fought, 4);
    assert.equal(result.flatteredRightRate, 75);
    assert.equal(result.foughtRightRate, 25);
    assert.ok(
      result.flatteredRightRate > result.foughtRightRate,
      'the shopper kept the colours that fight them more often than the ones that suit them',
    );
  });

  test('a swipe on a product outside the supplied catalogue is ignored, not counted', () => {
    const swipes = [
      ...heroes.map((p) => swipe(p.id, { direction: 'right' })),
      ...fights.map((p) => swipe(p.id, { direction: 'left' })),
      swipe('a-sku-that-was-deleted', { direction: 'right' }),
    ];
    const result = colourVerdict(products, swipes, WARM)!;
    assert.equal(result.flattered + result.fought, 8);
  });

  test('significance needs MIN_SAMPLE in each bucket', () => {
    const some = (list: Product[], n: number) => list.slice(0, n).map((p) => swipe(p.id));

    assert.equal(colourVerdict(products, [...some(heroes, 2), ...some(fights, 4)], WARM)!.significant, false);
    assert.equal(colourVerdict(products, [...some(heroes, 4), ...some(fights, 2)], WARM)!.significant, false);
    assert.equal(colourVerdict(products, [...some(heroes, 3), ...some(fights, 3)], WARM)!.significant, true);
  });
});

/* -------------------------------------------------------------------------
 * sizeFriction
 * ---------------------------------------------------------------------- */

describe('sizeFriction', () => {
  // 34 (lower body) + short size run + a slim cut clears the high band on its
  // own, whatever the colour does — so anything that drops it from the list
  // dropped it for a reason other than risk.
  const risky = garment('risky', {
    category: 'lower_body',
    sizeInfo: '30–32',
    fitNote: 'slim tapered',
    colorHex: FIGHTS[0],
  });
  const forgiving = garment('forgiving', {
    category: 'upper_body',
    sizeInfo: 'XS–XXL',
    fitNote: 'regular',
    colorHex: HERO[0],
  });
  const beautyItem = garment('foundation', {
    mode: 'beauty',
    category: 'lower_body',
    sizeInfo: '30–32',
    fitNote: 'slim tapered',
    colorHex: '#D9A26E',
  });

  test('nothing is flagged without a reading to judge against', () => {
    assert.deepEqual(sizeFriction([risky, forgiving], null), []);
  });

  test('flags the high-risk garment and leaves the forgiving one alone', () => {
    assert.deepEqual(
      sizeFriction([risky, forgiving], WARM).map((p) => p.id),
      ['risky'],
    );
  });

  test('beauty products are excluded even when their fit fields would flag them', () => {
    // Same category, same short size run, same cut as `risky`. Only `mode`
    // differs — a foundation has no size run to be stranded by.
    assert.deepEqual(
      sizeFriction([beautyItem], WARM).map((p) => p.id),
      [],
    );
  });
});
