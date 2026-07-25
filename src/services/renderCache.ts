import { Directory, File, Paths } from 'expo-file-system';

/**
 * On-device cache of VTO renders.
 *
 * This is load-bearing, not an optimisation. The unit budget is 1,000 and a
 * single 24-card deck costs 48, so an uncached app that re-renders on every
 * reload burns the entire allowance in about thirteen launches. It also solves
 * a second problem: API result URLs are presigned and expire after two hours,
 * so a render that is merely remembered as a URL is dead by the next session.
 * Caching means downloading the bytes.
 */

const DIR_NAME = 'vto-renders';

function cacheDir(): Directory {
  const dir = new Directory(Paths.cache, DIR_NAME);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/**
 * FNV-1a. Not cryptographic and does not need to be — this only has to map a
 * (person, garment) pair onto a stable filename without collisions across a
 * catalogue of a few dozen items.
 */
function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

export const cacheKey = (personKey: string, productId: string) =>
  `${hash(personKey)}-${hash(productId)}`;

function fileFor(key: string): File {
  return new File(cacheDir(), `${key}.jpg`);
}

/** Local URI for a previously cached render, or null. */
export function readCachedRender(personKey: string, productId: string): string | null {
  try {
    const file = fileFor(cacheKey(personKey, productId));
    // A zero-byte file is the fingerprint of an interrupted download; treating
    // it as a hit would render a permanently broken card that never retries.
    if (file.exists && (file.size ?? 0) > 0) return file.uri;
  } catch {
    // A cache read must never be able to break the deck.
  }
  return null;
}

/** Downloads a render to disk and returns its local URI. */
export async function cacheRender(
  personKey: string,
  productId: string,
  remoteUrl: string,
): Promise<string> {
  const key = cacheKey(personKey, productId);
  const target = fileFor(key);

  try {
    if (target.exists) target.delete();
    const saved = await File.downloadFileAsync(remoteUrl, target, { idempotent: true });
    return saved.uri;
  } catch {
    // Falling back to the remote URL keeps the card alive for this session even
    // though it will expire; a failed cache write is not a failed render.
    return remoteUrl;
  }
}

export function clearRenderCache(): void {
  try {
    const dir = new Directory(Paths.cache, DIR_NAME);
    if (dir.exists) dir.delete();
  } catch {
    // Best effort — this only ever runs from a developer action.
  }
}

export function cacheStats(): { count: number; bytes: number } {
  try {
    const dir = cacheDir();
    const entries = dir.list();
    let bytes = 0;
    let count = 0;
    for (const entry of entries) {
      if (entry instanceof File) {
        bytes += entry.size ?? 0;
        count += 1;
      }
    }
    return { count, bytes };
  } catch {
    return { count: 0, bytes: 0 };
  }
}
