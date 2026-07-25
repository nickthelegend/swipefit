/**
 * Proves the product's central claim against the LIVE API and the REAL catalogue:
 * the same 24 items produce materially different decks for different people.
 * Uses the bundled face crops via the real 3-step upload flow.
 */
import { readFileSync, statSync } from 'node:fs';
import { contrastLevel, undertoneFromSkinHex } from '../src/logic/color';
import { buildDeck, deriveSeason, seasonLabel } from '../src/logic/matching';
import type { Product, SkinProfile } from '../src/types';
import raw from '../src/data/catalog.json';

const KEY = process.env.EXPO_PUBLIC_YOUCAM_API_KEY!;
const BASE = 'https://yce-api-01.makeupar.com';
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const products: Product[] = (raw as any[]).map((r, i) => ({ ...r, id: `p${i}`, mode: 'apparel' as const }));

async function upload(feature: string, path: string): Promise<string> {
  const size = statSync(path).size;
  const slot = await (await fetch(`${BASE}/s2s/v2.0/file/${feature}`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ files: [{ content_type: 'image/jpeg', file_name: path.split('/').pop(), file_size: size }] }),
  })).json();
  const e = slot.data.files[0], q = e.requests[0];
  const put = await fetch(q.url, { method: q.method, headers: q.headers, body: readFileSync(path) });
  if (!put.ok) throw new Error(`PUT ${put.status}`);
  return e.file_id;
}

async function runTask(feature: string, body: object): Promise<any> {
  const s = await (await fetch(`${BASE}/s2s/v2.0/task/${feature}`, { method: 'POST', headers: H, body: JSON.stringify(body) })).json();
  for (let i = 0; i < 14; i++) {
    await sleep(3000);
    const p = await (await fetch(`${BASE}/s2s/v2.0/task/${feature}/${encodeURIComponent(s.data.task_id)}`, { headers: H })).json();
    if (p.data?.task_status === 'success') return p.data.results;
    if (p.data?.task_status === 'error') throw new Error(p.data.error);
  }
  throw new Error('timeout');
}

/** Mirrors services/youcam.ts: strict first, relaxed only on an angle rejection. */
async function scanTone(fileId: string) {
  try {
    return await runTask('skin-tone-analysis', { src_file_id: fileId, face_angle_strictness_level: 'medium' });
  } catch (e) {
    if (!String((e as Error).message).startsWith('error_face_angle')) throw e;
    console.log('      (medium rejected on head angle — retrying flexible, free)');
    return runTask('skin-tone-analysis', { src_file_id: fileId, face_angle_strictness_level: 'flexible' });
  }
}

(async () => {
  const decks: Record<string, string[]> = {};

  for (const id of ['a', 'b', 'c']) {
    console.log(`\n${'='.repeat(74)}\nmodel-${id}`);
    let skin: string, hair: string | null;
    try {
      const fileId = await upload('skin-tone-analysis', `assets/demo-models/model-${id}-face.jpg`);
      const res = await scanTone(fileId);
      skin = res.color.skin_color; hair = res.color.hair_color ?? null;
    } catch (e) { console.log(`  ✗ ${(e as Error).message}`); continue; }

    const { undertone, depth, confidence } = undertoneFromSkinHex(skin);
    const contrast = contrastLevel(skin, hair);
    const season = deriveSeason(undertone, depth, contrast);
    const profile: SkinProfile = { skinHex: skin, hairHex: hair, eyeHex: null, lipHex: null, eyeColorName: null, hairColorName: null, undertone, depth, confidence, contrast, season, concerns: [], scanTimestamp: 0, simulated: false };

    console.log(`  skin=${skin} hair=${hair} -> ${undertone}/${depth} contrast=${contrast} conf=${confidence} -> ${seasonLabel(season)}`);
    const deck = buildDeck(products, profile);
    decks[`model-${id}`] = deck.map((d) => d.product.id);
    console.log('  top 4: ' + deck.slice(0, 4).map((d) => `${d.product.colorName}(${d.match.score})`).join(', '));
    console.log('  bot 3: ' + deck.slice(-3).map((d) => `${d.product.colorName}(${d.match.score})`).join(', '));
  }

  const names = Object.keys(decks);
  console.log(`\n${'='.repeat(74)}\nPAIRWISE DIVERGENCE (${products.length}-item catalogue)`);
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = decks[names[i]!]!, b = decks[names[j]!]!;
      const moved = a.filter((id, k) => b.indexOf(id) !== k).length;
      const top5 = a.slice(0, 5).filter((id) => b.slice(0, 5).includes(id)).length;
      console.log(`  ${names[i]} vs ${names[j]}: ${moved}/${a.length} moved, top-5 overlap ${top5}/5`);
    }
  }
})();
