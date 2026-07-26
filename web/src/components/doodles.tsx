/**
 * Hand-drawn ink shapes, ported from the app so both surfaces share one hand.
 *
 * Two rules keep them from degrading into an icon library: the point radii are
 * deliberately irregular (a mathematically perfect star reads as clip-art), and
 * every one is used rotated and overlapping content, never in a tidy slot.
 */

type Props = {
  size?: number;
  stroke?: string;
  fill?: string;
  rotate?: number;
  className?: string;
};

const STAR_POINTS = [
  [50, 2], [58, 30], [80, 12], [72, 40], [98, 38], [76, 54],
  [96, 74], [68, 68], [74, 96], [54, 74], [38, 98], [38, 70],
  [12, 80], [26, 56], [2, 46], [28, 38], [14, 14], [40, 26],
];

export function Starburst({ size = 64, stroke = '#000', fill = 'none', rotate = 0, className = '' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: `rotate(${rotate}deg)` }} className={className} aria-hidden>
      <polygon
        points={STAR_POINTS.map((p) => p.join(',')).join(' ')}
        fill={fill}
        stroke={stroke}
        strokeWidth={4}
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The reference's signature: a rounded plate with two googly eyes. */
export function Eyes({ size = 96, stroke = '#000', fill = '#EBD22F', rotate = 0, className = '' }: Props) {
  return (
    <svg width={size} height={size * 0.66} viewBox="0 0 100 66" style={{ transform: `rotate(${rotate}deg)` }} className={className} aria-hidden>
      <path d="M8 4 H92 A6 6 0 0 1 98 10 V56 A6 6 0 0 1 92 62 H8 A6 6 0 0 1 2 56 V10 A6 6 0 0 1 8 4 Z" fill={fill} stroke={stroke} strokeWidth={4} />
      <circle cx={34} cy={33} r={14} fill="#fff" stroke={stroke} strokeWidth={3.5} />
      <circle cx={66} cy={33} r={14} fill="#fff" stroke={stroke} strokeWidth={3.5} />
      <circle cx={36} cy={37} r={6} fill={stroke} />
      <circle cx={68} cy={37} r={6} fill={stroke} />
    </svg>
  );
}

export function Chevrons({ size = 56, fill = '#1F8D42', rotate = 0, className = '' }: Props) {
  return (
    <svg width={size} height={size * 0.58} viewBox="0 0 100 58" style={{ transform: `rotate(${rotate}deg)` }} className={className} aria-hidden>
      <g fill={fill}>
        <path d="M2 2 A29 29 0 0 1 2 56 Z" />
        <path d="M34 2 A29 29 0 0 1 34 56 Z" />
        <path d="M66 2 A29 29 0 0 1 66 56 Z" />
      </g>
    </svg>
  );
}

export function Cursor({ size = 40, stroke = '#000', fill = '#EBD22F', rotate = 0, className = '' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: `rotate(${rotate}deg)` }} className={className} aria-hidden>
      <path d="M18 8 L84 46 L52 52 L44 88 Z" fill={fill} stroke={stroke} strokeWidth={5} strokeLinejoin="round" />
    </svg>
  );
}

export function Squiggle({ size = 200, stroke = '#E9492D', rotate = 0, className = '' }: Props) {
  return (
    <svg width={size} height={size * 0.16} viewBox="0 0 200 32" style={{ transform: `rotate(${rotate}deg)` }} className={className} aria-hidden>
      <path
        d="M4 22 C 26 4, 44 30, 66 16 S 108 6, 128 22 S 172 26, 196 10"
        fill="none"
        stroke={stroke}
        strokeWidth={7}
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Wobbly rosette seal. Reserved for a single emphatic stamp per screen. */
export function Blob({ size = 88, stroke = '#000', fill = '#E9492D', rotate = 0, className = '' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: `rotate(${rotate}deg)` }} className={className} aria-hidden>
      <path
        d="M50 2 L60 14 L76 8 L79 25 L96 27 L88 42 L98 55 L82 63 L86 80 L69 79 L62 95 L49 84 L35 95 L29 79 L12 81 L15 63 L2 54 L12 42 L4 27 L21 24 L23 8 L39 14 Z"
        fill={fill}
        stroke={stroke}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Globe({ size = 56, stroke = '#000', fill = '#4D17F5', rotate = 0, className = '' }: Props) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: `rotate(${rotate}deg)` }} className={className} aria-hidden>
      <circle cx={50} cy={50} r={46} fill={fill} stroke={stroke} strokeWidth={4} />
      <ellipse cx={50} cy={50} rx={20} ry={46} fill="none" stroke={stroke} strokeWidth={4} />
      <path d="M6 34 H94 M6 66 H94" stroke={stroke} strokeWidth={4} />
    </svg>
  );
}

/* Functional icons, drawn at the same ink weight so the two families never look
   borrowed from different systems. */

export function IconAndroid({ size = 22, color = '#000' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d="M22 44 H78 V78 A6 6 0 0 1 72 84 H28 A6 6 0 0 1 22 78 Z" fill="none" stroke={color} strokeWidth={7} strokeLinejoin="round" />
      <path d="M30 44 A20 20 0 0 1 70 44" fill="none" stroke={color} strokeWidth={7} />
      <path d="M32 22 L38 32 M68 22 L62 32" stroke={color} strokeWidth={7} strokeLinecap="round" />
      <circle cx={40} cy={38} r={3.5} fill={color} />
      <circle cx={60} cy={38} r={3.5} fill={color} />
    </svg>
  );
}

export function IconApple({ size = 22, color = '#000' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d="M68 54c0-10 8-14 8-14-4-6-11-7-14-7-6-1-12 3-15 3s-8-3-13-3c-7 0-13 4-16 10-7 12-2 30 5 40 3 5 7 10 12 10s7-3 13-3 8 3 13 3 8-5 11-10c2-3 3-6 4-8-7-3-8-11-8-21Z" fill="none" stroke={color} strokeWidth={6} strokeLinejoin="round" />
      <path d="M58 22c3-4 5-9 4-14-4 0-9 3-12 7s-5 9-4 13c4 0 9-2 12-6Z" fill={color} />
    </svg>
  );
}

export function IconDownload({ size = 22, color = '#000' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden>
      <path d="M50 14 V62" stroke={color} strokeWidth={8} strokeLinecap="round" />
      <path d="M28 44 L50 66 L72 44" fill="none" stroke={color} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M18 78 H82" stroke={color} strokeWidth={8} strokeLinecap="round" />
    </svg>
  );
}

export function IconArrow({ size = 22, color = '#000', rotate = 0 }: { size?: number; color?: string; rotate?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" style={{ transform: `rotate(${rotate}deg)` }} aria-hidden>
      <path d="M14 50 H82" stroke={color} strokeWidth={9} strokeLinecap="round" />
      <path d="M58 26 L84 50 L58 74" fill="none" stroke={color} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
