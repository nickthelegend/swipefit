import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { HARD_SHADOW_OFFSET, motion } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * How the element acknowledges the press.
 *
 *   travel — moves the full length of its own shadow, landing on the page. Only
 *            correct for elements that actually have a hard shadow behind them;
 *            on anything else it reads as a random nudge.
 *   scale  — a shrink small enough to feel rather than see. This is the default
 *            because most tappable things here are flat: icon buttons, toggles,
 *            tab items, list rows.
 */
type Feel = 'travel' | 'scale';

type Props = Omit<PressableProps, 'style'> & {
  children: ReactNode;
  feel?: Feel;
  /** Shadow travel distance for `feel="travel"`. Defaults to the system offset. */
  offset?: { x: number; y: number };
  haptic?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A Pressable that admits it was pressed.
 *
 * `PillButton` has had press physics since the first build; every hand-rolled
 * Pressable in the app had none, which meant the primary buttons felt alive and
 * everything else felt dead. That inconsistency is worse than either extreme, so
 * the physics live here once and get reused rather than copied.
 *
 * Two curves, deliberately:
 *
 *   travel uses `motion.spring` — the same spring PillButton uses, so a pressed
 *   card and a pressed button settle identically.
 *
 *   scale uses `motion.quick` (140ms) linear-out instead of a spring. A spring
 *   overshoots, and overshoot is a flourish; on the tab bar, which a user hits
 *   tens of times a day, a flourish becomes a stutter. Timing gets in and out
 *   without commentary.
 */
export function Tap({
  children,
  feel = 'scale',
  offset = HARD_SHADOW_OFFSET,
  haptic = true,
  disabled = false,
  onPress,
  style,
  ...rest
}: Props) {
  const pressed = useSharedValue(0);
  const reduced = useReducedMotion();

  // Reduced motion gets a smaller move, not a dead button. Removing the
  // feedback entirely would take away the confirmation that the tap landed,
  // which is the one thing this component exists to provide.
  const depth = reduced ? 0.35 : 1;

  const animatedStyle = useAnimatedStyle(() => {
    if (feel === 'travel') {
      return {
        transform: [
          { translateX: pressed.value * offset.x * depth },
          { translateY: pressed.value * offset.y * depth },
        ],
      };
    }
    return { transform: [{ scale: 1 - pressed.value * 0.03 * depth }] };
  });

  const drive = (to: number) => {
    pressed.value =
      feel === 'travel'
        ? withSpring(to, motion.spring)
        : withTiming(to, { duration: motion.quick });
  };

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) drive(1);
      }}
      onPressOut={() => drive(0)}
      onPress={(e) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={[style, animatedStyle]}
      {...rest}
    >
      {children}
    </AnimatedPressable>
  );
}
