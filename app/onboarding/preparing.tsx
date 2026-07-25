import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { useAppStore } from '@/store/useAppStore';
import { border, color, motion, radius, space } from '@/theme/tokens';
import { Starburst } from '@/ui/doodles';
import { PillButton, PillTag } from '@/ui/PillButton';
import { Screen } from '@/ui/Screen';
import { Type } from '@/ui/Type';

/**
 * Pre-render gate.
 *
 * The product's second principle is that a card must never make the shopper
 * wait, and a render takes ~8s. So the wait is paid once, here, where it can be
 * made into something worth looking at, rather than repeatedly on the deck
 * where it would read as a spinner behind every card.
 *
 * The progress figure is real — it counts completed renders, not elapsed time.
 */
export default function Preparing() {
  const router = useRouter();
  const prefetchDeck = useAppStore((s) => s.prefetchDeck);
  const progress = useAppStore((s) => s.prepareProgress);
  const deckSize = useAppStore((s) => s.deck.length);

  const started = useRef(false);
  const fill = useSharedValue(0);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void prefetchDeck().finally(() => {
      router.replace('/(app)/swipe');
    });
  }, [prefetchDeck, router]);

  const ratio = progress.total > 0 ? progress.done / progress.total : 0;
  useEffect(() => {
    fill.value = withSpring(ratio, motion.spring);
  }, [ratio, fill]);

  const barStyle = useAnimatedStyle(() => ({ width: `${Math.max(3, fill.value * 100)}%` }));

  return (
    <Screen grid>
      <View style={{ flex: 1, justifyContent: 'center', gap: space.lg }}>
        <View style={{ alignSelf: 'flex-start' }}>
          <Starburst size={72} fill={color.acid} rotate={-8} />
        </View>

        <Type role="mega">Putting{'\n'}clothes{'\n'}on you</Type>

        <Type role="body" style={{ maxWidth: 320 }}>
          Rendering the first {progress.total || '…'} pieces onto your photo now, so the
          deck never stops to think once you start swiping.
        </Type>

        <View
          style={{
            height: 26,
            borderWidth: border.bold,
            borderColor: color.ink,
            borderRadius: radius.pill,
            backgroundColor: color.paper,
            overflow: 'hidden',
          }}
        >
          <Animated.View style={[{ height: '100%', backgroundColor: color.violet }, barStyle]} />
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Type role="label">
            {progress.done} / {progress.total || '—'} rendered
          </Type>
          <PillTag label={`${deckSize} in the deck`} tone={color.groundSunk} />
        </View>

        {/* An escape hatch: cards render on demand anyway, so waiting is optional. */}
        <PillButton
          label="Skip ahead"
          onPress={() => router.replace('/(app)/swipe')}
          variant="outline"
          fullWidth
        />
      </View>
    </Screen>
  );
}
