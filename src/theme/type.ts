import { PixelRatio, type TextStyle } from 'react-native';

import { color } from './tokens';

/**
 * Archivo only — one family, four weights. DESIGN.md rejects Space Grotesk
 * explicitly: it is the most over-shipped face in this category and its quirky
 * forms fight the reference's grotesque.
 */
export const font = {
  black: 'Archivo_900Black',
  bold: 'Archivo_700Bold',
  semi: 'Archivo_600SemiBold',
  regular: 'Archivo_400Regular',
} as const;

export type TypeRole =
  | 'mega'
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'micro';

/**
 * Sizes are authored in sp. React Native's `fontSize` is dp, which ignores the
 * user's system font-size setting, so `sp()` re-applies it and clamps the scale
 * so a 200% system setting cannot burst a fixed-height sticker.
 */
export function sp(size: number, maxScale = 1.3): number {
  const scale = Math.min(PixelRatio.getFontScale(), maxScale);
  return Math.round(size * scale);
}

/** Tracking is expressed in em in DESIGN.md; RN wants absolute units. */
const em = (size: number, value: number) => size * value;

export const typeRole: Record<TypeRole, TextStyle> = {
  mega: {
    fontFamily: font.black,
    fontSize: sp(66, 1.1),
    lineHeight: sp(63, 1.1),
    letterSpacing: em(66, -0.035),
    textTransform: 'uppercase',
    color: color.ink,
  },
  display: {
    fontFamily: font.black,
    fontSize: sp(36, 1.15),
    lineHeight: sp(36, 1.15),
    letterSpacing: em(36, -0.03),
    textTransform: 'uppercase',
    color: color.ink,
  },
  title: {
    fontFamily: font.black,
    fontSize: sp(26, 1.2),
    lineHeight: sp(27, 1.2),
    letterSpacing: em(26, -0.02),
    textTransform: 'uppercase',
    color: color.ink,
  },
  heading: {
    fontFamily: font.semi,
    fontSize: sp(19),
    lineHeight: sp(23),
    letterSpacing: em(19, -0.01),
    textTransform: 'uppercase',
    color: color.ink,
  },
  body: {
    fontFamily: font.regular,
    fontSize: sp(16),
    lineHeight: sp(23),
    color: color.inkSoft,
  },
  bodyStrong: {
    fontFamily: font.semi,
    fontSize: sp(16),
    lineHeight: sp(23),
    color: color.ink,
  },
  label: {
    fontFamily: font.semi,
    fontSize: sp(13),
    lineHeight: sp(16),
    letterSpacing: em(13, 0.06),
    textTransform: 'uppercase',
    color: color.ink,
  },
  micro: {
    fontFamily: font.semi,
    fontSize: sp(11),
    lineHeight: sp(13),
    letterSpacing: em(11, 0.08),
    textTransform: 'uppercase',
    color: color.ink,
  },
};
