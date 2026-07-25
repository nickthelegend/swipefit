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
  const [error, setError] = useState<string | null>(null);

  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withRepeat(withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [sweep]);

  const sweepStyle = useAnimatedStyle(() => ({ top: `${sweep.value * 88 + 4}%` }));

  const start = useCallback(async () => {
    setError(null);
    setStage(0);

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

  useEffect(() => {
    if (!person) {
      router.replace('/onboarding/capture');
      return;
    }
    if (!hasCredentials()) {
      setError('No YouCam API key is configured. Add one to .env and restart.');
      return;
    }
    void start();
    // Intentionally runs once: re-running would spend another 20 units.
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
            <PillButton label="Try again" onPress={() => void start()} tone={color.violet} fullWidth />
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
