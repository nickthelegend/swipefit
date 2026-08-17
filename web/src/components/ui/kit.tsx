import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

/**
 * The web half of SWIPEFIT's component vocabulary.
 *
 * Deliberately the same three primitives the app has — a pill, a sticker and an
 * outlined panel on a hard shadow — so a visitor who downloads the app is not
 * handed a second, unrelated interface.
 */

export type Accent = 'violet' | 'tomato' | 'acid' | 'forest';

/** Fixed pairings. No other combination is permitted; see DESIGN.md. */
export const ON_ACCENT: Record<Accent, string> = {
  violet: 'text-white',
  tomato: 'text-white',
  acid: 'text-black',
  forest: 'text-white',
};

export const ACCENT_BG: Record<Accent, string> = {
  violet: 'bg-[#4D17F5]',
  tomato: 'bg-[#E9492D]',
  acid: 'bg-[#EBD22F]',
  forest: 'bg-[#1F8D42]',
};

/* -------------------------------------------------------------------------
 * Pill
 * ---------------------------------------------------------------------- */

type PillProps = {
  children: ReactNode;
  accent?: Accent | 'paper' | 'ground';
  size?: 'md' | 'lg';
  className?: string;
};

function pillClasses(accent: PillProps['accent'] = 'violet', size: PillProps['size'] = 'lg') {
  const fill =
    accent === 'paper'
      ? 'bg-white text-black'
      : accent === 'ground'
        ? 'bg-[#FA9DCD] text-black'
        : `${ACCENT_BG[accent]} ${ON_ACCENT[accent]}`;

  const scale = size === 'lg' ? 'h-14 px-8 text-[17px]' : 'h-11 px-5 text-[13px]';

  return [
    'inline-flex items-center justify-center gap-2 rounded-full border border-black',
    'font-semibold uppercase tracking-[0.04em] shadow-hard press select-none',
    fill,
    scale,
  ].join(' ');
}

export function PillLink({
  href,
  children,
  accent = 'violet',
  size = 'lg',
  className = '',
  ...rest
}: PillProps & { href: string } & Omit<ComponentProps<typeof Link>, 'href' | 'className'>) {
  return (
    <Link href={href} className={`${pillClasses(accent, size)} ${className}`} {...rest}>
      {children}
    </Link>
  );
}

export function PillAnchor({
  href,
  children,
  accent = 'violet',
  size = 'lg',
  className = '',
  ...rest
}: PillProps & ComponentProps<'a'>) {
  return (
    <a href={href} className={`${pillClasses(accent, size)} ${className}`} {...rest}>
      {children}
    </a>
  );
}

export function PillButton({
  children,
  accent = 'violet',
  size = 'lg',
  className = '',
  ...rest
}: PillProps & ComponentProps<'button'>) {
  return (
    <button
      className={`${pillClasses(accent, size)} ${className} disabled:opacity-40`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------
 * Panel — the only card shape in the product
 * ---------------------------------------------------------------------- */

export function Panel({
  children,
  className = '',
  tone = 'paper',
}: {
  children: ReactNode;
  className?: string;
  tone?: 'paper' | 'ground' | Accent;
}) {
  const fill =
    tone === 'paper'
      ? 'bg-white'
      : tone === 'ground'
        ? 'bg-[#FA9DCD]'
        : `${ACCENT_BG[tone]} ${ON_ACCENT[tone]}`;

  return (
    <div
      className={`rounded-[23px] border-2 border-black shadow-hard ${fill} ${className}`}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Sticker — rotated, overlapping, never in a tidy slot
 * ---------------------------------------------------------------------- */

export function Sticker({
  kicker,
  value,
  accent = 'acid',
  rotate = -6,
  className = '',
}: {
  kicker?: string;
  value: string;
  accent?: Accent;
  rotate?: number;
  className?: string;
}) {
  const clamped = Math.max(-8, Math.min(8, rotate));
  return (
    <div
      className={`inline-block rounded-[9px] border-2 border-black px-3 py-2 text-center shadow-hard-sm ${ACCENT_BG[accent]} ${ON_ACCENT[accent]} ${className}`}
      style={{ transform: `rotate(${clamped}deg)` }}
    >
      {kicker ? (
        <div className="text-[10px] font-semibold uppercase tracking-[0.08em] opacity-75">
          {kicker}
        </div>
      ) : null}
      <div className="display text-[22px] leading-none">{value}</div>
    </div>
  );
}

export function Tag({
  children,
  accent = 'ground',
  className = '',
}: {
  children: ReactNode;
  accent?: Accent | 'ground' | 'paper';
  className?: string;
}) {
  const fill =
    accent === 'ground'
      ? 'bg-[#FA9DCD] text-black'
      : accent === 'paper'
        ? 'bg-white text-black'
        : `${ACCENT_BG[accent]} ${ON_ACCENT[accent]}`;
  return (
    <span
      className={`inline-flex items-center rounded-full border border-black px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${fill} ${className}`}
    >
      {children}
    </span>
  );
}
