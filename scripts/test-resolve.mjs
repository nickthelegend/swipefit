/**
 * Module resolution hooks so `node --test` can load the app's source directly.
 *
 * The source is written for Metro, which resolves `./color` and `@/types`
 * without help. Node's ESM resolver does neither. The alternative was to rewrite
 * every import in src/ with explicit `.ts` extensions purely to satisfy the test
 * runner — changing shipping code to suit its tests, and diverging from every
 * other Expo project's conventions. Two short hooks are the cheaper trade.
 *
 * Type stripping itself is native in Node 22+, so there is no transform here and
 * no build step: the tests import the same files the app ships.
 *
 * Hooks are synchronous because they run in-thread via module.registerHooks;
 * module.register, which takes async hooks on a separate loader thread, is
 * deprecated.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SRC = pathToFileURL(fileURLToPath(new URL('../src/', import.meta.url))).href;

/** Mirrors the `@/*` -> `src/*` alias in tsconfig.json. */
function expandAlias(specifier) {
  return specifier.startsWith('@/') ? new URL(specifier.slice(2), SRC).href : specifier;
}

export function resolve(specifier, context, next) {
  const mapped = expandAlias(specifier);

  try {
    return next(mapped, context);
  } catch (error) {
    // Extensionless relative import. Try the TypeScript extensions Metro would,
    // in the same order, and only then give up with the original error so the
    // message still names what was actually asked for.
    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || /\.[cm]?[jt]sx?$/.test(mapped)) throw error;

    for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
      try {
        return next(mapped + ext, context);
      } catch {
        // Try the next candidate.
      }
    }
    throw error;
  }
}

/**
 * JSON imports without an import attribute.
 *
 * catalog.json is imported as `import rawCatalog from './catalog.json'`, which
 * Metro allows and Node rejects without `with { type: 'json' }`. Adding the
 * attribute to the source would be Node-specific syntax in a React Native file,
 * so it is handled here instead.
 */
export function load(url, context, next) {
  if (url.endsWith('.json')) {
    return {
      format: 'json',
      shortCircuit: true,
      source: readFileSync(fileURLToPath(url), 'utf8'),
    };
  }
  return next(url, context);
}
