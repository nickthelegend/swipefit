import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import { typeRole, type TypeRole } from '@/theme/type';

// React Native's TextProps carries its own ARIA `role`, and intersecting with it
// narrows this one to the single overlapping value ("heading"). Omitting it is
// what keeps the type scale intact.
type Props = Omit<TextProps, 'role'> & {
  role?: TypeRole;
  color?: string;
  align?: TextStyle['textAlign'];
  /** Display type is allowed to shout; body copy never overrides its case. */
  transform?: TextStyle['textTransform'];
};

/**
 * `allowFontScaling` is off because `sp()` already applies the system font scale
 * with a clamp. Leaving RN's own scaling on would apply it twice and burst the
 * fixed-height stickers.
 */
export function Type({ role = 'body', color, align, transform, style, ...rest }: Props) {
  return (
    <RNText
      allowFontScaling={false}
      style={[
        typeRole[role],
        color ? { color } : null,
        align ? { textAlign: align } : null,
        transform ? { textTransform: transform } : null,
        style,
      ]}
      {...rest}
    />
  );
}
