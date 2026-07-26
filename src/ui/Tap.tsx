import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { HARD_SHADOW_OFFSET, motion } from '@/theme/tokens';

/**
 * How the element acknowledges the press.
 *
 *   travel — moves the full length of its own shadow, landing on the page. Only
 *            correct for elements that actually have a hard shadow behind them;
 *            on anything else it reads as a random nudge.
 *   scale  — a shrink small enough to feel rather than see. The default, because
 *            most tappable things here are flat: icon buttons, toggles, tab
 *            items, list rows.
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
 * Keys that position an element within its PARENT, as opposed to describing the
 * element itself.
 *
 * These have to stay on the outer Pressable: `flex: 1` on the inner view would
 * make it fill a wrapper that has already collapsed to its content width, so a
 * row of three equal-width options would come out ragged. Everything else —
 * padding, border, background, alignment of children — belongs on the moving
 * view, or the border would sit still while its own fill slid out from under it.
 */
const LAYOUT_KEYS = [
  'flex',
  'flexGrow',
  'flexShrink',
  'flexBasis',
  'alignSelf',
  'width',
  'minWidth',
  'maxWidth',
  'height',
  'minHeight',
  'maxHeight',
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'position',
  'top',
  'bottom',
  'left',
  'right',
  'zIndex',
] as const;

function splitStyle(style: StyleProp<ViewStyle>): [ViewStyle, ViewStyle] {
  // StyleSheet.flatten handles nested arrays and falsy entries, which callers
  // pass freely (`style={[base, active && extra]}`).
  const flat = StyleSheet.flatten(style) ?? {};

  const layout: ViewStyle = {};
  const surface: ViewStyle = {};
  for (const [key, value] of Object.entries(flat)) {
    const target = (LAYOUT_KEYS as readonly string[]).includes(key) ? layout : surface;
    (target as Record<string, unknown>)[key] = value;
  }
  return [layout, surface];
}

/**
 * A Pressable that admits it was pressed.
 *
 * `PillButton` has had press physics since the first build and the 36
 * hand-rolled Pressables had none, so primary buttons felt alive and everything
 * else felt dead. That inconsistency is worse than either extreme, so the
 * physics live here once and get reused rather than copied.
 *
 * The transform is on an inner Animated.View inside a PLAIN Pressable, rather
 * than on an Animated.createAnimatedComponent(Pressable). Both are supposed to
 * work, but the inner-view form is what PillButton already uses and is therefore
 * the one shape in this app known to handle touch correctly on device — and a
 * press primitive that animates beautifully while dropping taps is the worst
 * possible failure here. Not worth being clever about.
 *
 * Two curves, deliberately:
 *
 *   travel uses `motion.spring` — the same spring PillButton uses, so a pressed
 *   card and a pressed button settle identically.
 *
 *   scale uses `motion.quick` (140ms) timing rather than a spring. A spring
 *   overshoots, and overshoot is a flourish; on the tab bar, which a user hits
 *   tens of times a day, a flourish becomes a stutter.
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

  // Reduced motion gets a smaller move, not a dead button. Removing the feedback
  // entirely would take away the confirmation that the tap landed, which is the
  // one thing this component exists to provide.
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

  const [layout, surface] = splitStyle(style);

  return (
    <Pressable
      disabled={disabled}
      onPressIn={() => {
        if (!disabled) drive(1);
      }}
      onPressOut={() => drive(0)}
      onPress={(event) => {
        if (haptic) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(event);
      }}
      style={layout}
      {...rest}
    >
      {/* collapsable={false} keeps Android from flattening this view away as a
          pointless wrapper — it is not pointless, it is the thing that moves. */}
      <Animated.View collapsable={false} style={[surface, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
