import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { HARD_SHADOW_OFFSET, color, radius as radiusToken } from '@/theme/tokens';

type Props = {
  children: ReactNode;
  /** Must match the child's own radius or the shadow will peek at the corners. */
  radius?: number;
  offset?: { x: number; y: number };
  shadowColor?: string;
  /** Pressed elements travel toward their shadow; pass 0 to collapse it flat. */
  scale?: number;
  style?: StyleProp<ViewStyle>;
};

/**
 * The product's single shadow, drawn as a real sibling View.
 *
 * React Native cannot express this with `shadow*` — Android ignores those props
 * entirely, and `elevation` always applies a blur, which DESIGN.md forbids. So
 * the shadow is a solid black layer offset behind the content, which also gives
 * us something to animate when a pressed element lands on the page.
 */
export function Shadowed({
  children,
  radius = radiusToken.lg,
  offset = HARD_SHADOW_OFFSET,
  shadowColor = color.ink,
  scale = 1,
  style,
}: Props) {
  return (
    <View style={style}>
      {scale > 0 && (
        <View
          pointerEvents="none"
          style={[
            { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
            {
              backgroundColor: shadowColor,
              borderRadius: radius,
              transform: [{ translateX: offset.x * scale }, { translateY: offset.y * scale }],
            },
          ]}
        />
      )}
      {children}
    </View>
  );
}
