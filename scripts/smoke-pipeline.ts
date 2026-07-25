/**
 * End-to-end pipeline check against the REAL catalogue and the REAL API.
 * Exercises: skin-tone scan -> undertone derivation -> deck sort -> VTO render.
 * Not shipped in the app.
 */
import { contrastLevel, undertoneFromSkinHex } from '../src/logic/color';
import { buildDeck, deriveSeason, seasonLabel } from '../src/logic/matching';
import { assessRegret } from '../src/logic/reasoning';
import type { Product, SkinProfile } from '../src/types';
import raw from '../src/data/catalog.json';

const KEY = process.env.EXPO_PUBLIC_YOUCAM_API_KEY!;
const BASE = 'https://yce-api-01.makeupar.com';
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const products: Product[] = (raw as any[]).map((r, i) => ({
  ...r, id: `p${i}`, mode: 'apparel' as const,
}));

const MODELS = [
  { id: 'model-a', label: 'Fair / Cool', face: 'https://images.pexels.com/photos/4830781/pexels-photo-4830781.jpeg?auto=compress&w=1200', body: 'https://images.pexels.com/photos/4830779/pexels-photo-4830779.jpeg?auto=compress&w=1200' },
  { id: 'model-b', label: 'Medium / Warm', face: 'https://images.pexels.com/photos/8217535/pexels-photo-8217535.jpeg?auto=compress&w=1200', body: 'https://images.pexels.com/photos/8217535/pexels-photo-8217535.jpeg?auto=compress&w=1200' },
  { id: 'model-c', label: 'Deep / Neutral', face: 'https://images.pexels.com/photos/27542890/pexels-photo-27542890.jpeg?auto=compress&w=1200', body: 'https://images.pexels.com/photos/27542890/pexels-photo-27542890.jpeg?auto=compress&w=1200' },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runTask(feature: string, body: object): Promise<any> {
  const start = await (await fetch(`${BASE}/s2s/v2.0/task/${feature}`, { method: 'POST', headers: H, body: JSON.stringify(body) })).json();
  if (!start?.data?.task_id) throw new Error(`start failed: ${JSON.stringify(start).slice(0, 200)}`);
  for (let i = 0; i < 15; i++) {
    await sleep(3000);
    const poll = await (await fetch(`${BASE}/s2s/v2.0/task/${feature}/${encodeURIComponent(start.data.task_id)}`, { headers: H })).json();
    if (poll.data?.task_status === 'success') return poll.data.results;
    if (poll.data?.task_status === 'error') throw new Error(poll.data.error);
  }
  throw new Error('timeout');
}

(async () => {
  const orders: Record<string, string[]> = {};

  for (const m of MODELS) {
    console.log(`\n${'='.repeat(72)}\n${m.label}`);
    let tone: any;
    try {
      tone = await runTask('skin-tone-analysis', { src_file_url: m.face, face_angle_strictness_level: 'medium' });
    } catch (e) {
      console.log(`  ✗ SKIN TONE FAILED: ${(e as Error).message}`);
      continue;
    }
    const skinHex = tone.color.skin_color;
    const hairHex = tone.color.hair_color ?? null;
    const { undertone, depth, confidence } = undertoneFromSkinHex(skinHex);
    const contrast = contrastLevel(skinHex, hairHex);
    const season = deriveSeason(undertone, depth, contrast);

    console.log(`  skin=${skinHex} hair=${hairHex} -> ${undertone}/${depth} contrast=${contrast} conf=${confidence} -> ${seasonLabel(season)}`);

    const profile: SkinProfile = { skinHex, hairHex, eyeHex: null, lipHex: null, eyeColorName: null, hairColorName: null, undertone, depth, confidence, contrast, season, concerns: [], scanTimestamp: 0, simulated: false };
    const deck = buildDeck(products, profile);
    orders[m.label] = deck.map((d) => d.product.id);

    console.log('  TOP 5:');
    for (const d of deck.slice(0, 5)) {
      const r = assessRegret(d.product, d.match, profile);
      console.log(`    ${String(d.match.score).padStart(3)} [${d.product.colorHex}] ${d.product.brand} ${d.product.name.slice(0, 34).padEnd(34)} risk ${r.risk}%`);
    }
    console.log(`  BOTTOM 2:`);
    for (const d of deck.slice(-2)) console.log(`    ${String(d.match.score).padStart(3)} [${d.product.colorHex}] ${d.product.name.slice(0, 40)}`);
    console.log(`  reason(top):    ${deck[0]!.match.reason}`);
    console.log(`  reason(bottom): ${deck[deck.length - 1]!.match.reason}`);

    // Render the top card for this person.
    const top = deck[0]!.product;
    try {
      const t0 = Date.now();
      const res = await runTask('cloth-v3', { src_file_url: m.body, ref_file_url: top.productImageUrl, garment_category: top.category });
      console.log(`  ✓ VTO ${top.brand} ${top.name.slice(0,30)} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      console.log(`    ${res.url.slice(0, 110)}...`);
      const fs = await import('node:fs');
      const buf = Buffer.from(await (await fetch(res.url)).arrayBuffer());
      fs.writeFileSync(`/private/tmp/claude-501/-Volumes-Extreme-SSD-Projects-swipe-fit/5420ace9-de65-45ac-b456-2a4f0654cd9e/scratchpad/render-${m.id}.jpg`, buf);
      console.log(`    saved render-${m.id}.jpg (${(buf.length / 1024).toFixed(0)}KB)`);
    } catch (e) {
      console.log(`  ✗ VTO FAILED: ${(e as Error).message}`);
    }
  }

  const keys = Object.keys(orders);
  if (keys.length >= 2) {
    const a = orders[keys[0]!]!, b = orders[keys[keys.length - 1]!]!;
    const moved = a.filter((id, i) => b.indexOf(id) !== i).length;
    const overlap = a.slice(0, 5).filter((id) => b.slice(0, 5).includes(id)).length;
    console.log(`\n${'='.repeat(72)}`);
    console.log(`DECK DIVERGENCE  "${keys[0]}" vs "${keys[keys.length-1]}": ${moved}/${a.length} moved, top-5 overlap ${overlap}/5`);
  }
})();
