/** Verifies the bundled demo face crops pass skin-tone analysis via upload. */
import { readFileSync, statSync } from 'node:fs';
import { contrastLevel, undertoneFromSkinHex } from '../src/logic/color';
import { deriveSeason, seasonLabel } from '../src/logic/matching';

const KEY = process.env.EXPO_PUBLIC_YOUCAM_API_KEY!;
const BASE = 'https://yce-api-01.makeupar.com';
const H = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function upload(feature: string, path: string): Promise<string> {
  const size = statSync(path).size;
  const name = path.split('/').pop()!;
  const slot = await (await fetch(`${BASE}/s2s/v2.0/file/${feature}`, {
    method: 'POST', headers: H,
    body: JSON.stringify({ files: [{ content_type: 'image/jpeg', file_name: name, file_size: size }] }),
  })).json();
  const entry = slot.data.files[0];
  const req = entry.requests[0];
  const put = await fetch(req.url, { method: req.method, headers: req.headers, body: readFileSync(path) });
  if (!put.ok) throw new Error(`PUT ${put.status}`);
  return entry.file_id;
}

async function runTask(feature: string, body: object): Promise<any> {
  const start = await (await fetch(`${BASE}/s2s/v2.0/task/${feature}`, { method: 'POST', headers: H, body: JSON.stringify(body) })).json();
  for (let i = 0; i < 14; i++) {
    await sleep(3000);
    const p = await (await fetch(`${BASE}/s2s/v2.0/task/${feature}/${encodeURIComponent(start.data.task_id)}`, { headers: H })).json();
    if (p.data?.task_status === 'success') return p.data.results;
    if (p.data?.task_status === 'error') throw new Error(p.data.error);
  }
  throw new Error('timeout');
}

(async () => {
  for (const id of ['a', 'b', 'c']) {
    const path = `assets/demo-models/model-${id}-face.jpg`;
    process.stdout.write(`model-${id}: `);
    try {
      const fileId = await upload('skin-tone-analysis', path);
      const res = await runTask('skin-tone-analysis', { src_file_id: fileId, face_angle_strictness_level: 'medium' });
      const skin = res.color.skin_color, hair = res.color.hair_color ?? null;
      const { undertone, depth, confidence } = undertoneFromSkinHex(skin);
      const contrast = contrastLevel(skin, hair);
      console.log(`✓ skin=${skin} hair=${hair} -> ${undertone}/${depth} contrast=${contrast} conf=${confidence} -> ${seasonLabel(deriveSeason(undertone, depth, contrast))}`);
    } catch (e) {
      console.log(`✗ ${(e as Error).message}`);
    }
  }
})();
