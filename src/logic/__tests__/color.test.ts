import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { colorFamily, hexToLch, undertoneFromSkinHex } from '../color.ts';

/**
 * Runs on Node's built-in test runner with native type stripping — no jest, no
 * babel, no transform config. These modules are deliberately free of React
 * Native imports precisely so they can be tested this way; the moment one of
 * them imports a native module, that stops being true.
 *
 *   npm test
 */

describe('undertone', () => {
  /**
   * This is the regression that motivated the whole file.
   *
   * The first implementation compared hue against a fixed 55-degree axis, which
   * read EVERY deep skin tone as confidently cool — espresso came back "cool"
   * at full confidence. The cause is that b* compresses faster than a* as
   * lightness falls, so the neutral point genuinely moves; a constant threshold
   * cannot describe it. The axis is now a function of L*.
   *
   * If someone simplifies neutralHueAxis back to a constant, these fail.
   */
  const DEEP = ['#3B2219', '#4A2C1D', '#2E1B12', '#5A3823'];

  for (const hex of DEEP) {
    test(`${hex} is not confidently cool`, () => {
      const { undertone, confidence } = undertoneFromSkinHex(hex);
      assert.notEqual(
        `${undertone}:${confidence > 0.5}`,
        'cool:true',
        `${hex} read as confidently cool — the neutral axis is probably fixed again`,
      );
    });
  }

  test('spans more than one undertone across a range of real skin tones', () => {
    const tones = ['#F7E1CE', '#EBC8A6', '#D9A26E', '#B57C4E', '#8D5A34', '#5A3823', '#3B2219'];
    const seen = new Set(tones.map((h) => undertoneFromSkinHex(h).undertone));
    // A classifier that answers the same thing for every input is not measuring
    // anything, and would still satisfy every individual assertion above.
    assert.ok(seen.size > 1, `every tone classified as ${[...seen]}`);
  });

  test('confidence is bounded to 0..1', () => {
    for (const hex of ['#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF', '#B4A48C']) {
      const { confidence } = undertoneFromSkinHex(hex);
      assert.ok(confidence >= 0 && confidence <= 1, `${hex} -> ${confidence}`);
    }
  });

  test('depth ordering follows lightness', () => {
    assert.equal(undertoneFromSkinHex('#F7E1CE').depth, 'light');
    assert.equal(undertoneFromSkinHex('#3B2219').depth, 'deep');
  });
});

describe('colorFamily', () => {
  /**
   * Low-chroma colours must be named by their neutrality, not by their hue.
   * Oatmeal sits at hue ~75 degrees, which is squarely in the yellow bucket, so
   * a hue-first implementation calls it "mustard" — a garment description that
   * is simply wrong, and one a shopper sees on the card.
   */
  test('oatmeal is not called mustard', () => {
    const family = colorFamily('#DCD3C3');
    assert.doesNotMatch(family, /mustard|yellow/i, `#DCD3C3 -> ${family}`);
  });

  test('near-neutrals read as neutral regardless of hue angle', () => {
    for (const hex of ['#DCD3C3', '#C9C9C4', '#2B2B2E', '#F2F0EB']) {
      const family = colorFamily(hex);
      assert.doesNotMatch(family, /mustard|lime|magenta|cyan/i, `${hex} -> ${family}`);
    }
  });

  test('genuinely saturated colours still get a hue name', () => {
    // The low-chroma band must not be so wide that it swallows real colour.
    assert.doesNotMatch(colorFamily('#E9492D'), /neutral|grey|gray/i);
    assert.doesNotMatch(colorFamily('#4D17F5'), /neutral|grey|gray/i);
  });
});

describe('hexToLch', () => {
  test('white and black sit at the ends of L*', () => {
    assert.ok(hexToLch('#FFFFFF').L > 99);
    assert.ok(hexToLch('#000000').L < 1);
  });

  test('greys carry effectively no chroma', () => {
    assert.ok(hexToLch('#808080').C < 1);
  });

  test('is case- and hash-insensitive', () => {
    assert.deepEqual(hexToLch('#b4a48c'), hexToLch('#B4A48C'));
  });
});
