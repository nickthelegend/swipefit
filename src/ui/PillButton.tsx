import * as Haptics from 'expo-haptics';
import { type ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { HARD_SHADOW_OFFSET, HIT, border, color, motion, radius, space } from '@/theme/tokens';
import { Shadowed } from './Shadowed';
import { Type } from './Type';

type Variant = 'fill' | 'outline';
type Size = 'md' | 'lg';

type Props = {
  label: string;
  onPress: () => void;
  variant?: Variant;
  /** Fill colour for `fill`; ignored by `outline`, which always sits on ground. */
  tone?: string;
  /** Label colour. Required when `tone` is not one of the fixed accent pairings. */
  labelColor?: string;
  size?: Size;
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
};

const AnimatedView = Animated.createAnimatedComponent(View);

/**
 * Pressing travels the button the full length of its own shadow and collapses
 * the shadow to zero, so the element physically lands on the page rather than
 * dimming. This world has no grey scale to dim into.
 */
export function PillButton({
  label,
  onPress,
  variant = 'fill',
  tone = color.violet,
  labelColor,
  size = 'lg',
  disabled = false,
  icon,
  style,
  fullWidth = false,
}: Props) {
  const pressed = useSharedValue(0);

  const surfaceStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: pressed.value * HARD_SHADOW_OFFSET.x },
      { translateY: pressed.value * HARD_SHADOW_OFFSET.y },
    ],
  }));

  const shadowStyle = useAnimatedStyle(() => ({ opacity: 1 - pressed.value }));

  const isFill = variant === 'fill';
  const bg = isFill ? tone : color.ground;
  const fg = labelColor ?? (isFill ? color.paper : color.ink);
  const height = size === 'lg' ? 60 : HIT.min;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPressIn={() => {
        pressed.value = withSpring(1, motion.spring);
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, motion.spring);
      }}
      onPress={() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[fullWidth && { alignSelf: 'stretch' }, { opacity: disabled ? 0.4 : 1 }, style]}
    >
      <View>
        <AnimatedView
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              left: 0,
              right: 0,
              top: 0,
              height,
              backgroundColor: color.ink,
              borderRadius: radius.pill,
              transform: [
                { translateX: HARD_SHADOW_OFFSET.x },
                { translateY: HARD_SHADOW_OFFSET.y },
              ],
            },
            shadowStyle,
          ]}
        />
        <AnimatedView
          style={[
            {
              height,
              minWidth: HIT.min,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.xs,
              paddingHorizontal: size === 'lg' ? space.xl : space.lg,
              backgroundColor: bg,
              borderColor: color.ink,
              borderWidth: border.hair,
              borderRadius: radius.pill,
            },
            surfaceStyle,
          ]}
        >
          {icon}
          <Type role={size === 'lg' ? 'heading' : 'label'} color={fg}>
            {label}
          </Type>
        </AnimatedView>
      </View>
    </Pressable>
  );
}

/** Static, non-interactive variant used inside cards and list rows. */
export function PillTag({
  label,
  tone = color.ground,
  labelColor = color.ink,
  shadowed = false,
  style,
}: {
  label: string;
  tone?: string;
  labelColor?: string;
  shadowed?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const body = (
    <View
      style={{
        paddingHorizontal: space.sm,
        paddingVertical: space.xxs + 2,
        backgroundColor: tone,
        borderColor: color.ink,
        borderWidth: border.hair,
        borderRadius: radius.pill,
      }}
    >
      <Type role="micro" color={labelColor}>
        {label}
      </Type>
    </View>
  );

  if (!shadowed) return <View style={style}>{body}</View>;
  return (
    <Shadowed radius={radius.pill} offset={{ x: 2, y: 3 }} style={style}>
      {body}
    </Shadowed>
  );
}
