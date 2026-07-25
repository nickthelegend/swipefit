import { type ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { color, space } from '@/theme/tokens';

/**
 * Faint printed grid behind hero sections.
 *
 * Drawn rather than tiled from a bitmap so it stays crisp at any density and
 * costs no asset. Kept at 6% ink — visible as paper texture, never as a UI grid.
 */
export function GridBackdrop({ cell = 44, opacity = 0.06 }: { cell?: number; opacity?: number }) {
  const lines = 40;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
      <Svg width="100%" height="100%">
        {Array.from({ length: lines }, (_, i) => (
          <Line
            key={`v${i}`}
            x1={i * cell}
            y1={0}
            x2={i * cell}
            y2="100%"
            stroke={color.ink}
            strokeWidth={1}
            opacity={opacity}
          />
        ))}
        {Array.from({ length: lines }, (_, i) => (
          <Line
            key={`h${i}`}
            x1={0}
            y1={i * cell}
            x2="100%"
            y2={i * cell}
            stroke={color.ink}
            strokeWidth={1}
            opacity={opacity}
          />
        ))}
      </Svg>
    </View>
  );
}

type ScreenProps = {
  children?: ReactNode;
  /** Edge-to-edge is on, so insets are applied here rather than by the system. */
  edges?: { top?: boolean; bottom?: boolean };
  grid?: boolean;
  background?: string;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
};

export function Screen({
  children,
  edges = { top: true, bottom: true },
  grid = false,
  background = color.ground,
  style,
  padded = true,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          flex: 1,
          backgroundColor: background,
          paddingTop: edges.top ? insets.top : 0,
          paddingBottom: edges.bottom ? insets.bottom : 0,
          paddingHorizontal: padded ? space.lg : 0,
        },
        style,
      ]}
    >
      {grid && <GridBackdrop />}
      {children}
    </View>
  );
}
