const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Points release builds at a real signing key.
 *
 * Expo's generated build.gradle signs release with the DEBUG keystore and leaves
 * a comment telling you not to. That keystore ships in every React Native
 * project on earth with the password "android", so a release APK signed with it
 * is one anybody can forge an update for — and Play Store will not accept it at
 * all.
 *
 * This is a config plugin rather than a hand edit because `expo prebuild`
 * regenerates android/ from scratch. Editing build.gradle directly works right
 * up until the next prebuild silently reverts it, which is the kind of thing
 * that is discovered at the worst moment.
 *
 * Credentials come from the environment so nothing secret lives in the repo.
 * The defaults are the local development key described in README.md; they are
 * deliberately not a fallback that would let a real release build succeed with
 * a placeholder key, because the keystore file itself is gitignored — if it is
 * absent, Gradle fails loudly rather than quietly producing an unsignable APK.
 */
const KEYSTORE = process.env.SWIPEFIT_KEYSTORE ?? '../../credentials/swipefit-release.keystore';
const STORE_PASSWORD = process.env.SWIPEFIT_KEYSTORE_PASSWORD ?? 'swipefit-hackathon';
const KEY_ALIAS = process.env.SWIPEFIT_KEY_ALIAS ?? 'swipefit';
const KEY_PASSWORD = process.env.SWIPEFIT_KEY_PASSWORD ?? 'swipefit-hackathon';

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;

    // Idempotent: prebuild can run repeatedly, and a second insertion would
    // produce a duplicate signingConfig block that fails to evaluate.
    if (gradle.includes('signingConfigs.release')) return mod;

    gradle = gradle.replace(
      /signingConfigs \{\s*\n(\s*)debug \{/,
      (match, indent) =>
        `signingConfigs {\n${indent}release {\n` +
        `${indent}    storeFile file('${KEYSTORE}')\n` +
        `${indent}    storePassword '${STORE_PASSWORD}'\n` +
        `${indent}    keyAlias '${KEY_ALIAS}'\n` +
        `${indent}    keyPassword '${KEY_PASSWORD}'\n` +
        `${indent}}\n${indent}debug {`,
    );

    // Only the release build type — debug must keep the debug key so `expo
    // run:android` still installs over an existing debug build.
    gradle = gradle.replace(
      /release \{\n(\s*)\/\/ Caution![\s\S]*?signingConfig signingConfigs\.debug/,
      (match, indent) => `release {\n${indent}signingConfig signingConfigs.release`,
    );

    mod.modResults.contents = gradle;
    return mod;
  });
};
