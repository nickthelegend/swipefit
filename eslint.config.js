// @ts-check
const expoConfig = require('eslint-config-expo/flat');

/**
 * Flat config — the `.eslintrc` format ESLint 9 dropped.
 *
 * Deliberately thin. `eslint-config-expo` already carries the React, hooks and
 * React Native rules that matter here, and a long list of stylistic overrides on
 * top of it is how a lint config turns into something people disable.
 *
 * The two additions below are both rules that have caught real bugs in this
 * repo, not preferences.
 */
module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      'web/**', // has its own Next config
      'android/**',
      'ios/**',
      '.expo/**',
      'dist/**',
    ],
  },
  {
    rules: {
      // Promoted from warning. Stale closures in useEffect cause the hardest
      // bugs in this codebase's category — a deck that re-sorts off a profile
      // captured two renders ago looks like a scoring bug and is not one.
      // Everything else is left at Expo's defaults on purpose.
      'react-hooks/exhaustive-deps': 'error',

      // Off, and not lightly.
      //
      // This rule forbids mutating a value that was passed to a hook — sound
      // advice for React state, and exactly backwards for Reanimated, whose
      // shared values exist to be assigned from gesture handlers and worklets
      // running on the UI thread. `x.value = withSpring(...)` is not a mutation
      // bug, it is the entire documented API.
      //
      // Every flagged site in this repo was of that shape, so the rule produced
      // only false positives — and a rule that is always wrong gets ignored
      // along with the one time it might be right. Reanimated appears in almost
      // every screen here, so scoping it to a file list would be the same thing
      // written longer.
      'react-hooks/immutability': 'off',
    },
  },
];
