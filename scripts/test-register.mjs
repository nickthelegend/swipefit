/**
 * Entry point for `node --import`. Installs the resolution hooks in-thread
 * before any test module loads.
 */

import { registerHooks } from 'node:module';

import { load, resolve } from './test-resolve.mjs';

registerHooks({ load, resolve });
