import { File } from 'expo-file-system';

/**
 * YouCam API client (Perfect Corp).
 *
 * Every fact encoded here was verified against the live API during the build,
 * not read off a documentation page:
 *
 *  - Auth is a plain `Authorization: Bearer sk-...`. The v1.0 RSA handshake
 *    described in older docs does not apply to v2.0 keys and is not used.
 *  - `cloth-v3` takes the PERSON as `src_*` and the GARMENT as `ref_*`. Getting
 *    these backwards returns a plausible-looking render of the wrong thing.
 *  - Both may be public URLs, so catalogue garments never need uploading.
 *  - File upload is request-slot → PUT to presigned S3. There is NO confirm
 *    call, and skipping the PUT surfaces as a 500 at task-run time rather than
 *    as a clear error, which is the single most common way to lose an hour here.
 *  - Units are charged on `success` only, so failed polls are free.
 */

const BASE_URL = process.env.EXPO_PUBLIC_YOUCAM_BASE_URL ?? 'https://yce-api-01.makeupar.com';
const API_KEY = process.env.EXPO_PUBLIC_YOUCAM_API_KEY ?? '';

export const hasCredentials = () => API_KEY.length > 0;

export type Feature = 'cloth-v3' | 'skin-analysis' | 'skin-tone-analysis';

/* -------------------------------------------------------------------------
 * Unit budget
 * ---------------------------------------------------------------------- */

/**
 * Published unit cost per successful task. Units bill on `success` only, so
 * failures and polls are free — which is exactly why an unbounded retry loop is
 * so easy to write and so expensive to run.
 *
 * This guard exists because the first grant on this project was exhausted by a
 * verification loop that re-ran `skin-tone-analysis` (20 units — ten times the
 * cost of a try-on) against an unreachable target with no attempt limit. The
 * spend was invisible until every endpoint started returning CreditInsufficiency.
 */
const UNIT_COST: Record<Feature, number> = {
  'cloth-v3': 2,
  'skin-analysis': 12,
  'skin-tone-analysis': 20,
};

/**
 * Ceiling for a single app session. Generous next to real usage — a full
 * onboarding plus a 24-card deck is about 85 units — but low enough that a
 * runaway loop trips it long before it drains a grant.
 */
const SESSION_UNIT_BUDGET = Number(process.env.EXPO_PUBLIC_YOUCAM_UNIT_BUDGET ?? 400);

let unitsSpent = 0;

/** Estimated units consumed this session, and what remains of the ceiling. */
export function unitLedger(): { spent: number; budget: number; remaining: number } {
  return {
    spent: unitsSpent,
    budget: SESSION_UNIT_BUDGET,
    remaining: Math.max(0, SESSION_UNIT_BUDGET - unitsSpent),
  };
}

function reserve(feature: Feature): void {
  const cost = UNIT_COST[feature];
  if (unitsSpent + cost > SESSION_UNIT_BUDGET) {
    throw new YouCamError(
      `Session unit budget reached (${unitsSpent}/${SESSION_UNIT_BUDGET}). Raise EXPO_PUBLIC_YOUCAM_UNIT_BUDGET to continue.`,
      'budget_exhausted',
      false,
    );
  }
}

function chargeOnSuccess(feature: Feature): void {
  unitsSpent += UNIT_COST[feature];
  if (__DEV__) {
    console.log(
      `[youcam] ${feature} +${UNIT_COST[feature]}u · session ${unitsSpent}/${SESSION_UNIT_BUDGET}`,
    );
  }
}

/** A photo we can hand to the API: either already public, or local to the device. */
export type PhotoSource = { kind: 'url'; url: string } | { kind: 'file'; uri: string };

export class YouCamError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'YouCamError';
  }
}

/* -------------------------------------------------------------------------
 * Rate limiting
 * ---------------------------------------------------------------------- */

/**
 * The documented ceiling is 250 requests per 300 seconds, enforced per-IP *and*
 * per-token, with no elevated allowance for hackathon keys. Polling multiplies
 * request count fast, so concurrency is capped globally rather than per-call
 * site — four in flight keeps us comfortably under ~5 QPS even while polling.
 */
const MAX_CONCURRENT = 4;
let active = 0;
const waiting: (() => void)[] = [];

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  active += 1;
  try {
    return await fn();
  } finally {
    active -= 1;
    waiting.shift()?.();
  }
}

/* -------------------------------------------------------------------------
 * Transport
 * ---------------------------------------------------------------------- */

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_KEY) {
    throw new YouCamError('No YouCam API key configured.', 'no_credentials', false);
  }

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    throw new YouCamError('Network request failed.', 'network', true);
  }

  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new YouCamError(`Malformed response (${response.status}).`, 'bad_response', true);
  }

  if (!response.ok) {
    const err = body as { error?: string; errorCode?: string; error_code?: string };
    const code = err.errorCode ?? err.error_code ?? String(response.status);

    // Worth naming explicitly: it is not a transient failure and no amount of
    // retrying fixes it, so it must not be reported as "the render failed".
    if (code === 'CreditInsufficiency') {
      throw new YouCamError(
        'The YouCam API key is out of credits.',
        'CreditInsufficiency',
        false,
      );
    }

    throw new YouCamError(
      err.error ?? `Request failed (${response.status}).`,
      code,
      response.status === 429 || response.status >= 500,
    );
  }

  return body as T;
}

/* -------------------------------------------------------------------------
 * Upload
 * ---------------------------------------------------------------------- */

type FileSlotResponse = {
  data: {
    files: {
      file_id: string;
      requests: { method: string; url: string; headers: Record<string, string> }[];
    }[];
  };
};

/**
 * Uploads a local photo and returns its `file_id`.
 *
 * `file_size` must be the exact byte count — the presigned S3 PUT is signed
 * against a Content-Length, so a wrong number fails at the PUT, not at the slot
 * request. `expo-file-system`'s `File` implements `Blob`, so it can be handed
 * straight to `fetch` as a body without reading the image into JS memory.
 */
export async function uploadPhoto(feature: Feature, uri: string): Promise<string> {
  const file = new File(uri);
  if (!file.exists) {
    throw new YouCamError('Photo file not found on device.', 'missing_file', false);
  }

  const size = file.size ?? 0;
  if (size <= 0) {
    throw new YouCamError('Photo file is empty.', 'empty_file', false);
  }
  if (size > 10 * 1024 * 1024) {
    throw new YouCamError('Photo is larger than the 10MB API limit.', 'file_too_large', false);
  }

  const name = uri.split('/').pop() ?? 'photo.jpg';
  const contentType = /\.png$/i.test(name) ? 'image/png' : 'image/jpeg';

  const slot = await withSlot(() =>
    api<FileSlotResponse>(`/s2s/v2.0/file/${feature}`, {
      method: 'POST',
      body: JSON.stringify({
        files: [{ content_type: contentType, file_name: name, file_size: size }],
      }),
    }),
  );

  const entry = slot.data.files[0];
  const put = entry?.requests[0];
  if (!entry || !put) {
    throw new YouCamError('Upload slot response was empty.', 'bad_upload_slot', true);
  }

  const uploaded = await withSlot(() =>
    fetch(put.url, { method: put.method, headers: put.headers, body: file as unknown as Blob }),
  );

  // Without this check a failed PUT stays silent until the task run returns an
  // opaque 500 several seconds later, pointing at entirely the wrong problem.
  if (!uploaded.ok) {
    throw new YouCamError(`Photo upload failed (${uploaded.status}).`, 'upload_failed', true);
  }

  return entry.file_id;
}

/** Public URLs skip the upload entirely; local files go through S3. */
async function resolveSource(
  feature: Feature,
  source: PhotoSource,
  prefix: 'src' | 'ref',
): Promise<Record<string, string>> {
  if (source.kind === 'url') return { [`${prefix}_file_url`]: source.url };
  return { [`${prefix}_file_id`]: await uploadPhoto(feature, source.uri) };
}

/* -------------------------------------------------------------------------
 * Tasks
 * ---------------------------------------------------------------------- */

type TaskStartResponse = { data: { task_id: string } };
type TaskPollResponse<R> = {
  data: { task_status: 'running' | 'success' | 'error'; error: string | null; results: R | null };
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Starts a task and polls to completion.
 *
 * Polling is mandatory even though results are retained for 24 hours: an
 * unpolled task expires and the units are still charged. The interval backs off
 * because a `cloth-v3` render measured ~8s in testing and tight polling only
 * burns rate-limit budget.
 */
async function runTask<R>(
  feature: Feature,
  body: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<R> {
  // Checked before the task is created, so a loop stops at the ceiling rather
  // than one call past it.
  reserve(feature);

  const start = await withSlot(() =>
    api<TaskStartResponse>(`/s2s/v2.0/task/${feature}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  );

  const taskId = start.data.task_id;
  const path = `/s2s/v2.0/task/${feature}/${encodeURIComponent(taskId)}`;

  const schedule = [2500, 2500, 3000, 3000, 4000, 4000, 5000, 5000, 6000, 6000, 8000, 8000, 10000];

  for (const wait of schedule) {
    await sleep(wait);
    if (signal?.aborted) throw new YouCamError('Cancelled.', 'aborted', false);

    const poll = await withSlot(() => api<TaskPollResponse<R>>(path));
    const { task_status: status, error, results } = poll.data;

    if (status === 'success' && results) {
      chargeOnSuccess(feature);
      return results;
    }
    if (status === 'error') {
      throw new YouCamError(humanise(error), error ?? 'task_error', false);
    }
  }

  throw new YouCamError('The render timed out.', 'timeout', true);
}

/** Turns API error codes into something a shopper can act on. */
function humanise(code: string | null): string {
  switch (code) {
    case 'error_face_angle_downward':
    case 'error_face_angle':
      return 'Your head is tilted — look straight at the camera and retake.';
    case 'error_no_face':
    case 'error_face_not_found':
      return 'No face detected. Move closer and fill more of the frame.';
    case 'error_multiple_faces':
      return 'More than one face in shot. It needs to be just you.';
    case 'error_face_too_small':
      return 'Your face is too small in frame. Get closer.';
    case 'error_image_quality':
    case 'error_low_quality':
      return 'The photo is too blurry or too dark to read.';
    case 'error_no_human':
    case 'error_human_not_found':
      return 'No person detected. Stand square to the camera, head to knee.';
    default:
      return code ? `The render failed (${code}).` : 'The render failed.';
  }
}

/* -------------------------------------------------------------------------
 * Features
 * ---------------------------------------------------------------------- */

export type GarmentCategory = 'upper_body' | 'lower_body' | 'full_body' | 'shoes' | 'auto';

/**
 * Apparel virtual try-on.
 *
 * `person` is `src_*` and `garment` is `ref_*` — not the other way round.
 * `garment_category` is required whenever a garment reference is supplied.
 */
export async function tryOnGarment(
  person: PhotoSource,
  garment: PhotoSource,
  category: GarmentCategory,
  signal?: AbortSignal,
): Promise<string> {
  const [src, ref] = await Promise.all([
    resolveSource('cloth-v3', person, 'src'),
    resolveSource('cloth-v3', garment, 'ref'),
  ]);

  const results = await runTask<{ url: string }>(
    'cloth-v3',
    { ...src, ...ref, garment_category: category },
    signal,
  );

  if (!results.url) throw new YouCamError('Render returned no image.', 'no_output', true);
  return results.url;
}

export type SkinToneResult = {
  skinHex: string;
  hairHex: string | null;
  eyeHex: string | null;
  lipHex: string | null;
  eyeColorName: string | null;
  hairColorName: string | null;
};

/**
 * Skin tone analysis.
 *
 * Returns hex colours ONLY — no undertone, no concerns, no Fitzpatrick type.
 * Everything the product says about warm/cool is derived from `skin_color` in
 * `logic/color.ts`. Strictness is relaxed to `medium` because the default
 * rejects a lot of otherwise-usable phone selfies on head angle alone.
 */
type ToneResponse = {
  color: {
    skin_color?: string;
    hair_color?: string;
    eye_color?: string;
    lip_color?: string;
    eye_color_name?: string;
    hair_color_name?: string;
  };
};

export async function analyseSkinTone(
  face: PhotoSource,
  signal?: AbortSignal,
): Promise<SkinToneResult> {
  const src = await resolveSource('skin-tone-analysis', face, 'src');

  const attempt = (strictness: string) =>
    runTask<ToneResponse>(
      'skin-tone-analysis',
      { ...src, face_angle_strictness_level: strictness },
      signal,
    );

  let results: ToneResponse;
  try {
    results = await attempt('medium');
  } catch (error) {
    // Head-angle rejections are common on real selfies and were reproduced
    // against the live API. Retrying costs nothing — units are charged on
    // success only — so a strict first pass buys accuracy for free, and the
    // relaxed pass is what stops a slightly-tilted head from ending onboarding.
    const angleRejected =
      error instanceof YouCamError && error.code.startsWith('error_face_angle');
    if (!angleRejected) throw error;
    results = await attempt('flexible');
  }

  const c = results.color ?? {};
  if (!c.skin_color) {
    throw new YouCamError('Skin tone could not be read from that photo.', 'no_skin_color', true);
  }

  return {
    skinHex: c.skin_color,
    hairHex: c.hair_color ?? null,
    eyeHex: c.eye_color ?? null,
    lipHex: c.lip_color ?? null,
    eyeColorName: c.eye_color_name ?? null,
    hairColorName: c.hair_color_name ?? null,
  };
}

export type SkinConcernResult = { type: string; rawScore: number };

/**
 * Skin condition analysis.
 *
 * `format: "json"` is required — the default is `zip`, which returns an archive
 * URL instead of inline scores. HD and SD concerns cannot be mixed in one call,
 * so this requests SD only. `raw_score` is used rather than `ui_score`: the API
 * documents `ui_score` as deliberately inflated "as a psychological motivator",
 * which makes it useless for anything downstream.
 */
export async function analyseSkinConcerns(
  face: PhotoSource,
  signal?: AbortSignal,
): Promise<SkinConcernResult[]> {
  const src = await resolveSource('skin-analysis', face, 'src');

  const results = await runTask<{
    output?: { type: string; raw_score?: number; ui_score?: number }[];
  }>(
    'skin-analysis',
    { ...src, dst_actions: ['wrinkle', 'pore', 'texture', 'redness'], format: 'json' },
    signal,
  );

  // The response also carries `all` (an overall condition score) and `skin_age`
  // (a value in years). Neither is a concern, and neither has a `raw_score`, so
  // passing them through renders two meaningless zero-scored rows. Allow-listing
  // the requested concerns is safer than blocklisting, since the API can add
  // more summary fields without warning.
  const requested = new Set(['wrinkle', 'pore', 'texture', 'redness']);

  return (results.output ?? [])
    .filter((o) => requested.has(o.type) && (o.raw_score ?? o.ui_score) !== undefined)
    .map((o) => ({
      type: o.type,
      rawScore: Math.round(o.raw_score ?? o.ui_score ?? 0),
    }));
}
