/**
 * Checks every URL in the catalogue against the live web.
 *
 * Deliberately separate from `npm test`: it is slow, it needs a network, and it
 * fails for reasons that have nothing to do with the code — so it must never be
 * the thing that breaks a test run.
 *
 * Limitations, stated plainly, because a link checker that reports false
 * confidence is worse than no link checker:
 *
 *   1. SOFT 404s. Massimo Dutti answers HTTP 200 with a "PAGE DOES NOT EXIST"
 *      body; six catalogue links were dead exactly that way while passing every
 *      status check. The body is therefore scanned for dead-page markers.
 *
 *      BUT: that only works when the host lets us read a body at all, and
 *      Massimo Dutti bot-walls this script, so the very links that motivated the
 *      check come back UNVERIFIED here rather than DEAD. They were found with a
 *      real browser. This script narrows where to look; it does not replace
 *      opening the UNVERIFIED ones by hand.
 *
 *   2. BOT WALLS. Zara, H&M, Levi's and Massimo Dutti reject non-browser
 *      clients — either a ~2.4KB Akamai interstitial served with HTTP 200, or a
 *      bare 403. Neither means the page is missing. Both are reported as
 *      UNVERIFIED and neither counts as a pass; an earlier version called them
 *      dead and reported 22 broken links when the true count was zero.
 *
 *   npm run check:links
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const catalogue = JSON.parse(
  readFileSync(fileURLToPath(new URL('../src/data/catalog.json', import.meta.url)), 'utf8'),
);

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const DEAD_MARKERS = /page does not exist|page not found|no longer available|404 not found/i;

/**
 * Signals that a real product is on the page.
 *
 * Required before trusting a dead-page marker, because single-page apps ship
 * their own error copy inside the shell on EVERY route. All eight Uniqlo links
 * were reported dead on that basis and every one of them loads a product in a
 * browser — the marker was boilerplate, not a verdict.
 */
const PRODUCT_MARKERS = /"@type"\s*:\s*"Product"|"priceCurrency"|itemprop="price"|add to (cart|bag)/i;

/** An Akamai/Cloudflare challenge: tiny body, no real title, often a verify hook. */
function isBotWall(body) {
  return body.length < 4096 && (/bm-verify|_Incapsula_|cf-browser-verification/.test(body) || !/<title>[^<]{3,}/.test(body));
}

/**
 * Anti-bot rejections, not missing pages.
 *
 * Levi's and H&M answer 403 to anything without a browser fingerprint. Counting
 * those as dead reported 22 broken links when the real number was zero, which is
 * the failure mode that makes a checker worth ignoring.
 */
const BOT_STATUS = new Set([401, 403, 405, 429, 503]);

async function check(url, { wantImage = false } = {}) {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: wantImage ? 'image/*' : 'text/html' },
      signal: AbortSignal.timeout(25_000),
    });

    if (BOT_STATUS.has(res.status)) {
      return { state: 'UNVERIFIED', detail: `HTTP ${res.status} — anti-bot, not a missing page` };
    }
    if (!res.ok) return { state: 'DEAD', detail: `HTTP ${res.status}` };

    if (wantImage) {
      const type = res.headers.get('content-type') ?? '';
      return type.startsWith('image/')
        ? { state: 'OK', detail: type.split(';')[0] }
        : { state: 'DEAD', detail: `content-type ${type || 'absent'}` };
    }

    const body = await res.text();
    if (isBotWall(body)) return { state: 'UNVERIFIED', detail: `bot wall (${body.length}B)` };
    if (DEAD_MARKERS.test(body) && !PRODUCT_MARKERS.test(body)) {
      return { state: 'DEAD', detail: 'soft 404 — 200 with a dead-page body and no product' };
    }
    return { state: 'OK', detail: `HTTP 200, ${Math.round(body.length / 1024)}KB` };
  } catch (err) {
    return { state: 'DEAD', detail: err?.name === 'TimeoutError' ? 'timeout' : String(err?.message ?? err).slice(0, 60) };
  }
}

/** Bounded concurrency — 60 products means 120 requests, and politeness matters. */
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

const results = await mapLimit(catalogue, 6, async (p) => ({
  name: `${p.brand} — ${p.name}`,
  page: await check(p.brandProductUrl),
  image: await check(p.productImageUrl, { wantImage: true }),
  url: p.brandProductUrl,
}));

const tally = { OK: 0, DEAD: 0, UNVERIFIED: 0 };
for (const r of results) {
  for (const kind of ['page', 'image']) {
    tally[r[kind].state] += 1;
    if (r[kind].state !== 'OK') {
      console.log(`  ${r[kind].state.padEnd(10)} ${kind.padEnd(5)} ${r.name}`);
      console.log(`  ${' '.repeat(10)} ${' '.repeat(5)} ${r[kind].detail} — ${r.url}`);
    }
  }
}

console.log(
  `\n${tally.OK} ok · ${tally.DEAD} dead · ${tally.UNVERIFIED} unverifiable ` +
    `(${results.length} products, ${results.length * 2} URLs)`,
);
if (tally.UNVERIFIED) {
  console.log('Unverifiable means a bot wall answered, not that the link is good. Open those by hand.');
}
process.exit(tally.DEAD ? 1 : 0);
