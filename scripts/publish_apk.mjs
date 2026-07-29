/**
 * Copies the signed release APK to the website and records what it is.
 *
 * A sideloaded APK is the one install path with no store in front of it: nobody
 * checks the signature, nobody scans it, and the user has to disable a safety
 * prompt to proceed. Publishing the SHA-256 alongside it is the least that owes
 * them — it is the only way a downloader can tell that the file they received is
 * the file that was built.
 *
 * Also verifies the APK is signed with the RELEASE key before publishing.
 * Expo's generated Gradle signs release with the debug keystore by default, and
 * that mistake is invisible: the APK installs fine, and is forgeable by anyone,
 * because the debug key ships with every React Native project at password
 * "android".
 *
 *   npm run apk:publish
 */

import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const apk = `${root}android/app/build/outputs/apk/release/app-release.apk`;
const outDir = `${root}web/public/builds`;
const out = `${outDir}/fitcheck-latest.apk`;

let stat;
try {
  stat = statSync(apk);
} catch {
  console.error(`No release APK at ${apk}\nBuild one first:  cd android && ./gradlew assembleRelease`);
  process.exit(1);
}

const bytes = readFileSync(apk);
const sha256 = createHash('sha256').update(bytes).digest('hex');

// --- signature check ------------------------------------------------------
// apksigner lives in a versioned build-tools directory, so it is located rather
// than assumed. A missing apksigner is reported, never silently skipped: an
// unchecked signature is exactly the thing this step exists to catch.
let signer = 'unverified';
try {
  const sdk = process.env.ANDROID_HOME ?? `${process.env.HOME}/Library/Android/sdk`;
  const buildTools = execFileSync('ls', [`${sdk}/build-tools`], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .sort()
    .pop();
  const output = execFileSync(`${sdk}/build-tools/${buildTools}/apksigner`, ['verify', '--print-certs', apk], {
    encoding: 'utf8',
  });

  const cn = output.match(/Signer #1 certificate DN:.*?CN=([^,\n]+)/)?.[1]?.trim();
  if (!cn) throw new Error('could not read certificate DN');

  if (/Android Debug/i.test(cn)) {
    console.error(
      `REFUSING TO PUBLISH: this APK is signed with the DEBUG key (CN=${cn}).\n` +
        'The debug keystore is public — anyone can forge an update for it.\n' +
        'Check that the withReleaseSigning config plugin ran: grep signingConfigs android/app/build.gradle',
    );
    process.exit(1);
  }
  signer = cn;
} catch (err) {
  console.error(`Could not verify the APK signature: ${err.message}`);
  console.error('Refusing to publish an APK whose signer is unknown.');
  process.exit(1);
}

// --- publish --------------------------------------------------------------
mkdirSync(outDir, { recursive: true });
copyFileSync(apk, out);

const info = {
  // The page renders a "build it yourself" path until this flips true, so an
  // unpublished build never shows a download button that 404s.
  published: true,
  version: JSON.parse(readFileSync(`${root}app.json`, 'utf8')).expo.version,
  sizeBytes: stat.size,
  sizeLabel: `${(stat.size / 1024 / 1024).toFixed(1)} MB`,
  sha256,
  signer,
  builtAt: stat.mtime.toISOString().slice(0, 10),
};

writeFileSync(`${root}web/src/data/build-info.json`, JSON.stringify(info, null, 2) + '\n');

console.log(`  published  web/public/builds/fitcheck-latest.apk`);
for (const [k, v] of Object.entries(info)) console.log(`  ${k.padEnd(10)} ${v}`);
