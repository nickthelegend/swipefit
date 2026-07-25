import { useEffect } from 'react';
import { Dimensions, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { border, color, radius, space } from '@/theme/tokens';
import { Cursor, Squiggle } from './doodles';
import { PillButton } from './PillButton';
import { Type } from './Type';

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * First-run gesture coach.
 *
 * The deck has no buttons, so the gesture has to be taught rather than
 * discovered. It is demonstrated instead of described: a cursor traces the
 * actual arc a thumb would make, right then left, on a loop. The overlay is
 * dismissed explicitly rather than on a timer, so a shopper who looked away
 * does not come back to a deck they were never shown how to use.
 */
export function CoachOverlay({ onDismiss }: { onDismiss: () => void }) {
  const travel = useSharedValue(0);

  useEffect(() => {
    const distance = SCREEN_W * 0.22;
    travel.value = withRepeat(
      withSequence(
        withTiming(distance, { duration: 760, easing: Easing.out(Easing.cubic) }),
        withTiming(0, { duration: 340, easing: Easing.in(Easing.cubic) }),
        withDelay(160, withTiming(-distance, { duration: 760, easing: Easing.out(Easing.cubic) })),
        withTiming(0, { duration: 340, easing: Easing.in(Easing.cubic) }),
        withDelay(420, withTiming(0, { duration: 1 })),
      ),
      -1,
      false,
    );
  }, [travel]);

  const handStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: travel.value },
      { rotate: `${(travel.value / (SCREEN_W * 0.22)) * 10}deg` },
    ],
  }));

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        // Deliberately not a blur or a scrim gradient — this world is printed,
        // so the veil is a flat ink wash.
        backgroundColor: 'rgba(0,0,0,0.72)',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: space.lg,
        gap: space.lg,
      }}
    >
      <View style={{ alignItems: 'center' }}>
        <Type role="display" color={color.ground} align="center">
          Swipe it
        </Type>
        <Squiggle size={150} stroke={color.acid} rotate={-2} />
      </View>

      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
        <Flag label="← Nope" tone={color.tomato} />
        <Flag label="Want →" tone={color.violet} />
      </View>

      <Animated.View style={handStyle}>
        <Cursor size={64} fill={color.acid} rotate={-18} />
      </Animated.View>

      <Type role="body" color={color.ground} align="center" style={{ maxWidth: 300, opacity: 0.85 }}>
        Drag the card left or right. Tap it to see why it scored what it scored.
      </Type>

      <PillButton label="Got it" onPress={onDismiss} tone={color.acid} labelColor={color.ink} />
    </View>
  );
}

function Flag({ label, tone }: { label: string; tone: string }) {
  return (
    <View
      style={{
        paddingHorizontal: space.md,
        paddingVertical: space.xs,
        backgroundColor: tone,
        borderWidth: border.hair,
        borderColor: color.ground,
        borderRadius: radius.pill,
      }}
    >
      <Type role="label" color={color.paper}>
        {label}
      </Type>
    </View>
  );
}
