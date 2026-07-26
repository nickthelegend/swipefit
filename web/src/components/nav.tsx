'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { PillLink } from '@/components/ui/kit';

const LINKS = [
  { href: '/', label: 'The app' },
  { href: '/brands', label: 'Brands' },
  { href: '/download', label: 'Download' },
];

/**
 * The bar sits on the ink line rather than floating on a blur, because this
 * world is printed: every container is outlined, and a translucent header would
 * be the one element that is not.
 */
export default function Nav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b-2 border-black bg-[#FA9DCD]">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="display text-[22px] tracking-[-0.02em]">
          Fitcheck
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(link.href) ? 'page' : undefined}
              className={`rounded-full border px-4 py-2 text-[13px] font-semibold uppercase tracking-[0.06em] transition-colors ${
                isActive(link.href)
                  ? 'border-black bg-black text-[#FA9DCD]'
                  : 'border-transparent text-black hover:border-black'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <PillLink href="/brands/login" accent="paper" size="md">
            Brand login
          </PillLink>
        </div>

        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Menu"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-black md:hidden"
        >
          <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
            <path
              d={open ? 'M2 2 L16 12 M16 2 L2 12' : 'M1 2 H17 M1 7 H17 M1 12 H17'}
              stroke="#000"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t-2 border-black bg-[#FA9DCD] px-5 py-4 md:hidden">
          <div className="flex flex-col gap-2">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-full border border-black px-4 py-3 text-[13px] font-semibold uppercase tracking-[0.06em]"
              >
                {link.label}
              </Link>
            ))}
            <PillLink href="/brands/login" accent="paper" size="md" onClick={() => setOpen(false)}>
              Brand login
            </PillLink>
          </div>
        </div>
      )}
    </header>
  );
}
