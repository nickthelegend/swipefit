'use client';

import Image from 'next/image';
import { useState } from 'react';

import { ACCENT_BG, ON_ACCENT, type Accent } from '@/components/ui/kit';

/**
 * A brand's mark inside the FITCHECK system.
 *
 * Deliberately NOT a wall of pasted brand logos. Every retailer arrives with its
 * own typographic identity, and a grid of them would be the one un-designed
 * thing on the page — nine competing visual systems, none of them this one.
 *
 * So the mark is the brand's name set in the product's own display face on its
 * assigned accent, exactly as the app renders it in a card footer. The real
 * logo rides alongside at its native size, where it stays crisp and does the
 * recognition work a wordmark alone cannot.
 *
 * Not every brand has a fetchable logo, so a missing one falls back to the
 * brand's initials rather than a broken image — which would be worse than
 * having no glyph at all.
 */
export function BrandMark({
  name,
  slug,
  accent,
  size = 'md',
}: {
  name: string;
  slug: string;
  accent: Accent;
  size?: 'sm' | 'md';
}) {
  const [failed, setFailed] = useState(false);

  const type = size === 'sm' ? 'text-[20px]' : 'text-[30px]';
  const pad = size === 'sm' ? 'px-4 py-3' : 'px-6 py-5';
  const glyph = size === 'sm' ? 22 : 30;

  const initials = name
    .replace(/[^A-Za-z0-9& ]/g, '')
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 3)
    .toUpperCase();

  return (
    <div
      className={`flex items-center justify-between gap-3 ${pad} ${ACCENT_BG[accent]} ${ON_ACCENT[accent]}`}
    >
      <span className={`display ${type} truncate`}>{name}</span>

      <span
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-[6px] border border-black bg-white"
        style={{ width: glyph + 10, height: glyph + 10 }}
      >
        {failed ? (
          <span className="text-[11px] font-black tracking-tight text-black">{initials}</span>
        ) : (
          <Image
            src={`/logos/${slug}.png`}
            alt=""
            width={glyph}
            height={glyph}
            className="h-auto w-auto"
            style={{ maxWidth: glyph, maxHeight: glyph }}
            onError={() => setFailed(true)}
            unoptimized
          />
        )}
      </span>
    </div>
  );
}
