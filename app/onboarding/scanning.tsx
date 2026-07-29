import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useAppStore } from '@/store/useAppStore';
import { hasCredentials } from '@/services/youcam';
import { border, color, radius, space } from '@/theme/tokens';
import { PillButton, PillTag } from '@/ui/PillButton';
import { Screen } from '@/ui/Screen';
import { Type } from '@/ui/Type';

const STAGES = ['Reading skin colour', 'Measuring undertone', 'Scoring condition', 'Building your palette'];

export default function Scanning() {
  const router = useRouter();
  const person = useAppStore((s) => s.person);
  const runScan = useAppStore((s) => s.runScan);

  const [stage, setStage] = useState(0);

  // Computed once at mount rather than set from an effect. hasCredentials() is a
  // synchronous read of a build-time constant, so there is nothing to wait for —
  // setting it from an effect meant rendering the scanning screen for a frame
  // before replacing it with an error that was knowable before the first paint.
  const [error, setError] = useState<string | null>(() =>
    hasCredentials() ? null : 'No YouCam API key is configured. Add one to .env and restart.',
  );

  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [sweep]);

  const sweepStyle = useAnimatedStyle(() => ({ top: `${sweep.value * 88 + 4}%` }));

  const start = useCallback(async () => {
    // The stage ticker is honest about being an estimate of pace, not a
    // progress bar tied to real API events — the API exposes no such events.
    const ticker = setInterval(() => setStage((s) => Math.min(s + 1, STAGES.length - 1)), 2600);

    try {
      await runScan();
      router.replace('/onboarding/result');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The scan failed.');
    } finally {
      clearInterval(ticker);
    }
  }, [runScan, router]);

  /**
   * Clears the previous failure, then runs again.
   *
   * The reset lives here rather than at the top of `start` because on first
   * mount there is nothing to reset — stage is already 0 and error is already
   * whatever the credentials check decided. Resetting from inside `start` meant
   * the mount effect synchronously set state that was already correct, which
   * costs a wasted render pass and is what `react-hooks/set-state-in-effect`
   * exists to catch. Only the retry path genuinely has stale state to clear.
   */
  const retry = useCallback(() => {
    setError(null);
    setStage(0);
    void start();
  }, [start]);

  useEffect(() => {
    if (!person) {
      router.replace('/onboarding/capture');
      return;
    }
    // Already surfaced as the initial error state above; just do not spend a
    // scan we know will fail.
    if (!hasCredentials()) return;

    // set-state-in-effect is a false positive here. `start` is async, and the
    // only synchronous statement before its first await is setInterval — every
    // setState it performs happens in a later tick or a timer callback, which is
    // exactly the "subscribe and call setState from a callback" shape the rule
    // documents as correct. The lint cannot see past the call boundary.
    //
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void start();

    // Suppressed on purpose and not for convenience: this must run exactly
    // once. Re-running on a changed dep spends another 20 API units.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen grid>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.xl }}>
        <View style={{ alignItems: 'center' }}>
          <View
            style={{
              width: 232,
              height: 300,
              backgroundColor: color.paper,
              borderWidth: border.bold,
              borderColor: color.ink,
              borderRadius: radius.lg,
              overflow: 'hidden',
            }}
          >
            {person && (
              <Image source={{ uri: person.faceDisplayUri }} style={{ flex: 1 }} contentFit="cover" />
            )}
            {!error && (
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    height: 3,
                    backgroundColor: color.acid,
                  },
                  sweepStyle,
                ]}
              />
            )}
          </View>
        </View>

        {error ? (
          <View style={{ gap: space.md }}>
            <Type role="display" color={color.tomato}>
              Scan failed
            </Type>
            <Type role="body">{error}</Type>
            {error.includes('out of credits') && (
              <Type role="body">
                Pick one of the bundled demo people instead — they ship with a
                real reading of that exact photo, so the deck still sorts.
              </Type>
            )}
            <PillButton label="Try again" onPress={retry} tone={color.violet} fullWidth />
            <PillButton label="Use a different photo" onPress={() => router.replace('/onboarding/capture')} variant="outline" fullWidth />
          </View>
        ) : (
          <View style={{ gap: space.md }}>
            <Type role="display">Scanning</Type>
            <View style={{ gap: space.xs }}>
              {STAGES.map((label, i) => (
                <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                  <View
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 7,
                      borderWidth: border.hair,
                      borderColor: color.ink,
                      backgroundColor: i < stage ? color.forest : i === stage ? color.acid : 'transparent',
                    }}
                  />
                  <Type role="body" color={i <= stage ? color.ink : color.inkSoft} style={{ opacity: i <= stage ? 1 : 0.45 }}>
                    {label}
                  </Type>
                </View>
              ))}
            </View>
            <PillTag label="YouCam Skin Tone + Skin Analysis" tone={color.groundSunk} />
          </View>
        )}
      </View>
    </Screen>
  );
}
