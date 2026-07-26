import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { brandAccent, formatPrice } from '@/data/catalog';
import { border, color, motion, onAccent, radius, space } from '@/theme/tokens';
import type { DeckCard } from '@/types';
import { Starburst } from './doodles';
import { PillTag } from './PillButton';
import { Type } from './Type';

/**
 * The payoff for a blind pick.
 *
 * When the brand is hidden, committing to a garment is genuinely an opinion
 * about the garment. This is the moment that opinion gets scored — and the
 * whole reason to hide the label in the first place, because "I chose this
 * without knowing whose it was" is a fundamentally different feeling from
 * seeing the name first and deciding whether you approve of it.
 *
 * Deliberately brief and self-dismissing: it is a beat inside the swipe, not a
 * screen. Interrupting the deck with something that needs closing would undo
 * the rhythm the gesture-only design exists to protect.
 */
export function BrandReveal({ card, onDone }: { card: DeckCard; onDone: () => void }) {
  const accentName = brandAccent(card.product.brand);
  const accent = color[accentName];
  const accentText = onAccent(accentName);

  const pop = useSharedValue(0);
  const spin = useSharedValue(0);

  useEffect(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Overshoot then settle — the card is being stamped, not faded in.
    pop.value = withSequence(
      withTiming(1.06, { duration: 180 }),
      withSpring(1, motion.spring),
    );
    spin.value = withDelay(60, withTiming(1, { duration: 520 }));

    const timer = setTimeout(onDone, 1650);
    return () => clearTimeout(timer);
  }, [pop, spin, onDone]);

  const plate = useAnimatedStyle(() => ({
    transform: [{ scale: pop.value }, { rotate: `${(1 - pop.value) * 6}deg` }],
  }));

  const spark = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value * 120 - 120}deg` }, { scale: 0.5 + spin.value * 0.5 }],
    opacity: spin.value,
  }));

  return (
    <Animated.View
      entering={FadeIn.duration(120)}
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        // Flat ink wash, not a blur — this world is printed.
        backgroundColor: 'rgba(0,0,0,0.72)',
        paddingHorizontal: space.lg,
      }}
    >
      <Animated.View style={[{ position: 'absolute', top: '26%' }, spark]}>
        <Starburst size={92} stroke={color.ink} fill={color.acid} />
      </Animated.View>

      <Type role="label" color={color.ground} style={{ marginBottom: space.sm }}>
        You picked it blind
      </Type>

      <Animated.View style={plate}>
        <View
          style={{
            paddingHorizontal: space.lg,
            paddingVertical: space.md,
            backgroundColor: accent,
            borderWidth: border.bold,
            borderColor: color.ink,
            borderRadius: radius.lg,
            alignItems: 'center',
          }}
        >
          <Type role="mega" color={accentText} align="center">
            {card.product.brand}
          </Type>
        </View>
      </Animated.View>

      <View style={{ marginTop: space.md, alignItems: 'center', gap: space.xs }}>
        <Type role="heading" color={color.ground} align="center" numberOfLines={2}>
          {card.product.name}
        </Type>
        <PillTag label={formatPrice(card.product)} tone={color.acid} />
      </View>
    </Animated.View>
  );
}
