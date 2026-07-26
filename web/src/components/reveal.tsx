'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  children: React.ReactNode;
  /** Stagger offset in ms. 60 per index is the tuned step for a 3-4 item row. */
  delay?: number;
  className?: string;
};

/**
 * Reveals its child once, when it first scrolls into view.
 *
 * Written by hand rather than pulled from framer-motion, which the scaffold left
 * in package.json: three fades and a grid stagger do not justify an animation
 * runtime, and the dependency has now been removed since nothing imported it.
 *
 * Two details that matter more than the animation:
 *
 *   The observer disconnects after firing. Content that re-animates every time
 *   it scrolls past is the most common way this pattern turns annoying.
 *
 *   If IntersectionObserver is missing the child is shown immediately. Motion is
 *   the enhancement; the content is not conditional on it. For the no-JS case,
 *   layout.tsx carries a <noscript> block that neutralises `.reveal` — without
 *   it, this component would leave the page permanently blank at opacity 0.
 */
export function Reveal({ children, delay = 0, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }

    // Already on screen at mount — above the fold, a restored scroll position,
    // or a short page with no scroll available. Show it immediately and never
    // attach an observer.
    //
    // This is not just an optimisation. IntersectionObserver does not deliver
    // callbacks while document.visibilityState is 'hidden', so a page opened in
    // a background tab leaves everything at opacity 0 until it is focused. It
    // recovers when the tab is fronted, but "recovers" is the wrong bar for
    // whether the content of a page exists. getBoundingClientRect answers
    // regardless of visibility, so the common case never depends on the
    // observer at all. Elements on screen at load also should not animate in —
    // that reads as a flash, not an entrance.
    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -8% 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${shown ? 'reveal-in' : ''} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
