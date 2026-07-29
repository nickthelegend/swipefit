import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useEffect } from 'react';

import { border, color, motion, radius, space } from '@/theme/tokens';
import { Type } from './Type';

/**
 * How much rail is left.
 *
 * A swipe deck hides its own length: without this the shopper cannot tell
 * whether they are three cards from the end or thirty, so they cannot decide
 * whether to keep going. It is the one piece of information the format removes
 * and has to be given back.
 *
 * Counting decided rather than remaining, because that is the number that goes
 * up — a bar that empties reads as time running out, which is the wrong feeling
 * for browsing.
 */
export function DeckProgress({ decided, total }: { decided: number; total: number }) {
  const fraction = total > 0 ? Math.min(1, decided / total) : 0;
  const width = useSharedValue(fraction);

  useEffect(() => {
    width.value = withSpring(fraction, motion.springLoose);
  }, [fraction, width]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View
      style={{ gap: space.xxs }}
      accessibilityRole="progressbar"
      // The bar is decorative; the label is what a screen reader should read,
      // and "18 of 41" is more use than a percentage when deciding to continue.
      accessibilityLabel={`${decided} of ${total} decided`}
      accessibilityValue={{ min: 0, max: total, now: decided }}
    >
      <View
        style={{
          height: 8,
          borderWidth: border.hair,
          borderColor: color.ink,
          borderRadius: radius.pill,
          backgroundColor: color.groundSunk,
          overflow: 'hidden',
        }}
      >
        <Animated.View
          style={[{ height: '100%', backgroundColor: color.violet }, fillStyle]}
        />
      </View>
      <Type role="micro" color={color.inkSoft}>
        {total - decided === 0
          ? 'Every card decided'
          : `${total - decided} left of ${total}`}
      </Type>
    </View>
  );
}
