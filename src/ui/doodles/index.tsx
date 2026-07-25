import Svg, { Circle, Ellipse, G, Path, Polygon } from 'react-native-svg';

import { color } from '@/theme/tokens';

type DoodleProps = {
  size?: number;
  stroke?: string;
  fill?: string;
  rotate?: number;
  opacity?: number;
};

/**
 * Hand-drawn ink shapes, authored rather than borrowed from an icon set.
 *
 * Two rules keep them from degrading into an icon library: the point radii are
 * deliberately irregular (a mathematically perfect star reads as clip-art), and
 * every one is used rotated and overlapping content, never in a tidy slot.
 */

/** Irregular 11-point spark. Radii vary so it reads as drawn, not generated. */
export function Starburst({ size = 64, stroke = color.ink, fill = 'none', rotate = 0, opacity = 1 }: DoodleProps) {
  const pts = [
    [50, 2], [58, 30], [80, 12], [72, 40], [98, 38], [76, 54],
    [96, 74], [68, 68], [74, 96], [54, 74], [38, 98], [38, 70],
    [12, 80], [26, 56], [2, 46], [28, 38], [14, 14], [40, 26],
  ];
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: [{ rotate: `${rotate}deg` }], opacity }}>
      <Polygon
        points={pts.map((p) => p.join(',')).join(' ')}
        fill={fill}
        stroke={stroke}
        strokeWidth={4}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** The reference's signature: a rounded plate with two googly eyes. */
export function Eyes({ size = 72, stroke = color.ink, fill = color.bubblegum, rotate = 0, opacity = 1 }: DoodleProps) {
  return (
    <Svg width={size} height={size * 0.66} viewBox="0 0 100 66" style={{ transform: [{ rotate: `${rotate}deg` }], opacity }}>
      <Path d="M8 4 H92 A6 6 0 0 1 98 10 V56 A6 6 0 0 1 92 62 H8 A6 6 0 0 1 2 56 V10 A6 6 0 0 1 8 4 Z" fill={fill} stroke={stroke} strokeWidth={4} />
      <Circle cx={34} cy={33} r={14} fill={color.paper} stroke={stroke} strokeWidth={3.5} />
      <Circle cx={66} cy={33} r={14} fill={color.paper} stroke={stroke} strokeWidth={3.5} />
      <Circle cx={36} cy={37} r={6} fill={stroke} />
      <Circle cx={68} cy={37} r={6} fill={stroke} />
    </Svg>
  );
}

/** Three fat half-discs. Used as a directional marker beside display type. */
export function Chevrons({ size = 56, fill = color.forest, rotate = 0, opacity = 1 }: DoodleProps) {
  return (
    <Svg width={size} height={size * 0.58} viewBox="0 0 100 58" style={{ transform: [{ rotate: `${rotate}deg` }], opacity }}>
      <G fill={fill}>
        <Path d="M2 2 A29 29 0 0 1 2 56 Z" />
        <Path d="M34 2 A29 29 0 0 1 34 56 Z" />
        <Path d="M66 2 A29 29 0 0 1 66 56 Z" />
      </G>
    </Svg>
  );
}

/** Classic pointer, used to point at whatever the copy is talking about. */
export function Cursor({ size = 40, stroke = color.ink, fill = color.acid, rotate = 0, opacity = 1 }: DoodleProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: [{ rotate: `${rotate}deg` }], opacity }}>
      <Path d="M18 8 L84 46 L52 52 L44 88 Z" fill={fill} stroke={stroke} strokeWidth={5} strokeLinejoin="round" />
    </Svg>
  );
}

/** Loose underline. Sits beneath a word that the layout wants to insist on. */
export function Squiggle({ size = 120, stroke = color.tomato, rotate = 0, opacity = 1 }: DoodleProps) {
  return (
    <Svg width={size} height={size * 0.16} viewBox="0 0 200 32" style={{ transform: [{ rotate: `${rotate}deg` }], opacity }}>
      <Path
        d="M4 22 C 26 4, 44 30, 66 16 S 108 6, 128 22 S 172 26, 196 10"
        fill="none"
        stroke={stroke}
        strokeWidth={7}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Wobbly rosette seal. Reserved for a single emphatic stamp per screen. */
export function Blob({ size = 88, stroke = color.ink, fill = color.tomato, rotate = 0, opacity = 1 }: DoodleProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: [{ rotate: `${rotate}deg` }], opacity }}>
      <Path
        d="M50 2 L60 14 L76 8 L79 25 L96 27 L88 42 L98 55 L82 63 L86 80 L69 79 L62 95 L49 84 L35 95 L29 79 L12 81 L15 63 L2 54 L12 42 L4 27 L21 24 L23 8 L39 14 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** Meridian ball. Signals the multi-brand / anywhere-you-shop idea. */
export function Globe({ size = 56, stroke = color.ink, fill = color.tomato, rotate = 0, opacity = 1 }: DoodleProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: [{ rotate: `${rotate}deg` }], opacity }}>
      <Circle cx={50} cy={50} r={46} fill={fill} stroke={stroke} strokeWidth={4} />
      <Ellipse cx={50} cy={50} rx={20} ry={46} fill="none" stroke={stroke} strokeWidth={4} />
      <Path d="M6 34 H94 M6 66 H94" stroke={stroke} strokeWidth={4} />
    </Svg>
  );
}

/* ---------------------------------------------------------------------------
 * Functional icons.
 * Drawn at the same 4-unit ink weight as the doodles above so the two families
 * never look borrowed from different systems.
 * ------------------------------------------------------------------------- */

type IconProps = { size?: number; color?: string };

export function IconCards({ size = 24, color: c = color.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M22 26 H74 A6 6 0 0 1 80 32 V86 A6 6 0 0 1 74 92 H22 A6 6 0 0 1 16 86 V32 A6 6 0 0 1 22 26 Z" fill="none" stroke={c} strokeWidth={8} />
      <Path d="M34 12 H80 A10 10 0 0 1 90 22 V72" fill="none" stroke={c} strokeWidth={8} strokeLinecap="round" />
    </Svg>
  );
}

export function IconBag({ size = 24, color: c = color.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M18 30 H82 L76 90 H24 Z" fill="none" stroke={c} strokeWidth={8} strokeLinejoin="round" />
      <Path d="M34 40 V24 A16 16 0 0 1 66 24 V40" fill="none" stroke={c} strokeWidth={8} strokeLinecap="round" />
    </Svg>
  );
}

export function IconChart({ size = 24, color: c = color.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M14 88 V16" fill="none" stroke={c} strokeWidth={8} strokeLinecap="round" />
      <Path d="M14 88 H92" fill="none" stroke={c} strokeWidth={8} strokeLinecap="round" />
      <Path d="M34 74 V50 M56 74 V28 M78 74 V60" fill="none" stroke={c} strokeWidth={9} strokeLinecap="round" />
    </Svg>
  );
}

export function IconCheck({ size = 24, color: c = color.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M16 52 L40 76 L86 24" fill="none" stroke={c} strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconX({ size = 24, color: c = color.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M22 22 L78 78 M78 22 L22 78" fill="none" stroke={c} strokeWidth={12} strokeLinecap="round" />
    </Svg>
  );
}

export function IconUndo({ size = 24, color: c = color.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M20 44 H62 A22 22 0 0 1 62 88 H40" fill="none" stroke={c} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M36 26 L16 44 L36 62" fill="none" stroke={c} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconArrow({ size = 24, color: c = color.ink, rotate = 0 }: IconProps & { rotate?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: [{ rotate: `${rotate}deg` }] }}>
      <Path d="M14 50 H82" fill="none" stroke={c} strokeWidth={9} strokeLinecap="round" />
      <Path d="M58 26 L84 50 L58 74" fill="none" stroke={c} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export function IconCamera({ size = 24, color: c = color.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M12 30 H30 L38 18 H62 L70 30 H88 A4 4 0 0 1 92 34 V82 A4 4 0 0 1 88 86 H12 A4 4 0 0 1 8 82 V34 A4 4 0 0 1 12 30 Z" fill="none" stroke={c} strokeWidth={7} strokeLinejoin="round" />
      <Circle cx={50} cy={57} r={18} fill="none" stroke={c} strokeWidth={7} />
    </Svg>
  );
}

export function IconImage({ size = 24, color: c = color.ink }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Path d="M12 18 H88 A4 4 0 0 1 92 22 V78 A4 4 0 0 1 88 82 H12 A4 4 0 0 1 8 78 V22 A4 4 0 0 1 12 18 Z" fill="none" stroke={c} strokeWidth={7} />
      <Circle cx={34} cy={38} r={8} fill={c} />
      <Path d="M8 70 L36 46 L60 66 L74 56 L92 70" fill="none" stroke={c} strokeWidth={7} strokeLinejoin="round" />
    </Svg>
  );
}
