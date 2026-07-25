import { View, type StyleProp, type ViewStyle } from 'react-native';

import { border, color, radius, space } from '@/theme/tokens';
import { Type } from './Type';

type Props = {
  /** Small line above the value, e.g. "MATCH". Omit for a single-line sticker. */
  kicker?: string;
  value: string;
  tone?: string;
  labelColor?: string;
  /** DESIGN.md bounds sticker rotation to -8..8 degrees. */
  rotate?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * A rotated label slapped onto content. Stickers overlap what they annotate —
 * they are never given a tidy slot in a row, which is the thing that keeps this
 * world from collapsing into a normal card UI.
 */
export function Sticker({
  kicker,
  value,
  tone = color.acid,
  labelColor = color.ink,
  rotate = -6,
  style,
}: Props) {
  const clamped = Math.max(-8, Math.min(8, rotate));

  return (
    <View style={[{ transform: [{ rotate: `${clamped}deg` }] }, style]}>
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
          backgroundColor: color.ink,
          borderRadius: radius.sm,
          transform: [{ translateX: 3 }, { translateY: 4 }],
        }}
      />
      <View
        style={{
          paddingHorizontal: space.sm,
          paddingVertical: space.xs,
          backgroundColor: tone,
          borderColor: color.ink,
          borderWidth: border.bold,
          borderRadius: radius.sm,
          alignItems: 'center',
        }}
      >
        {kicker ? (
          <Type role="micro" color={labelColor} style={{ opacity: 0.75 }}>
            {kicker}
          </Type>
        ) : null}
        <Type role="title" color={labelColor} style={kicker ? { marginTop: 1 } : undefined}>
          {value}
        </Type>
      </View>
    </View>
  );
}
