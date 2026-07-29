'use client';

import { useEffect } from 'react';

import { Starburst } from '@/components/doodles';
import { PillButton, PillLink } from '@/components/ui/kit';

/**
 * Route-level error boundary.
 *
 * Without this file a thrown render error shows Next's stock overlay in
 * development and a blank white page in production — the one screen where a
 * visitor is already frustrated is the worst place to abandon the design.
 *
 * `reset` re-renders the segment rather than reloading the document, so a
 * transient failure (a Supabase call that timed out) recovers without losing
 * scroll position or re-downloading the bundle.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Next strips the message in production and leaves a digest that maps to the
    // real stack in the server logs. Logging it client-side is the only way to
    // correlate what a visitor saw with what actually threw.
    console.error('Route error', error.digest ?? '(no digest)', error);
  }, [error]);

  return (
    <section className="grid-paper border-b-2 border-black">
      <div className="mx-auto max-w-3xl px-5 py-28">
        <div className="flex items-center gap-4">
          <Starburst size={72} fill="#EBD22F" rotate={10} />
          <span className="label text-[12px] opacity-70">Something broke</span>
        </div>

        <h1 className="display mt-6 text-[clamp(38px,7vw,68px)] leading-[0.95]">
          That did not load
        </h1>

        <p className="mt-6 max-w-md text-[17px] leading-relaxed">
          Our end, not yours. Trying again usually works — the data it needed may
          simply have been slow.
        </p>

        {error.digest && (
          <p className="mt-4 text-[13px] opacity-60">
            Reference <code className="font-mono">{error.digest}</code>
          </p>
        )}

        <div className="mt-9 flex flex-wrap gap-3">
          <PillButton onClick={reset} accent="violet" size="lg">
            Try again
          </PillButton>
          <PillLink href="/" accent="paper" size="lg">
            Back to the app
          </PillLink>
        </div>
      </div>
    </section>
  );
}
