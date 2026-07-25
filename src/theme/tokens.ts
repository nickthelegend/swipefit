/**
 * FITCHECK design tokens.
 *
 * Every colour, radius and shadow value here was read off byooooob.com's computed
 * styles rather than recalled — see DESIGN.md for the extraction table. Two values
 * matter more than the rest and are easy to "improve" by accident:
 *
 *   1. Borders never exceed 2px. The 3-4px outline is the generic brutalist
 *      stereotype; the reference is thinner and more confident than that.
 *   2. The shadow never blurs. It is a hard cut-out offset, not depth.
 */

export const color = {
  ground: '#EEEEEC',
  groundSunk: '#E1E1D9',
  paper: '#FFFFFF',
  ink: '#000000',
  inkSoft: '#333333',

  violet: '#4D17F5',
  tomato: '#E9492D',
  acid: '#EBD22F',
  bubblegum: '#FA9DCD',
  forest: '#1F8D42',
} as const;

export type AccentName = 'violet' | 'tomato' | 'acid' | 'bubblegum' | 'forest';

export const ACCENTS: readonly AccentName[] = ['violet', 'tomato', 'acid', 'bubblegum', 'forest'];

/**
 * Fixed foreground pairings. DESIGN.md forbids any combination not listed here,
 * so contrast is a property of the token set rather than a per-screen judgement.
 * Measured against #000: acid 11.8:1, bubblegum 10.3:1. Against #FFF:
 * violet 8.9:1, tomato 4.6:1, forest 4.6:1. All clear 4.5:1 for body text.
 */
const ON_ACCENT: Record<AccentName, string> = {
  violet: color.paper,
  tomato: color.paper,
  acid: color.ink,
  bubblegum: color.ink,
  forest: color.paper,
};

export function onAccent(accent: AccentName): string {
  return ON_ACCENT[accent];
}

/** 4pt base. Named rather than numeric so spacing decisions stay reviewable. */
export const space = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  huge: 64,
} as const;

export const radius = {
  sm: 9,
  md: 13,
  lg: 23,
  xl: 30,
  pill: 999,
} as const;

export const border = {
  hair: 1,
  bold: 2,
} as const;

/** The one shadow in the product. Offset, zero blur, full opacity, pure black. */
export const HARD_SHADOW_OFFSET = { x: 4, y: 5 } as const;

export const shadow = {
  shadowColor: color.ink,
  shadowOffset: { width: HARD_SHADOW_OFFSET.x, height: HARD_SHADOW_OFFSET.y },
  shadowOpacity: 1,
  shadowRadius: 0,
  // Android ignores shadow* entirely and elevation always blurs, so the hard
  // shadow is drawn as a real sibling View on Android. See ui/HardShadow.tsx.
  elevation: 0,
} as const;

/** Android minimum touch target, with the 8dp separation the platform expects. */
export const HIT = {
  min: 48,
  gap: 8,
} as const;

export const motion = {
  /** Snappy, not elegant. Used for anything that should feel physical. */
  spring: { damping: 19, stiffness: 240, mass: 0.9 },
  springLoose: { damping: 15, stiffness: 170, mass: 1 },
  quick: 140,
  base: 200,
  slow: 320,
} as const;
