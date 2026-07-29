import type { Metadata } from 'next';

import { Blob, Squiggle } from '@/components/doodles';
import { PillLink } from '@/components/ui/kit';

export const metadata: Metadata = {
  title: 'Not found — FITCHECK',
  // A 404 that gets indexed is worse than one that does not exist.
  robots: { index: false, follow: true },
};

/**
 * The 404.
 *
 * Written in the world's own voice rather than the framework's default, because
 * a stock Next.js error page is the one screen that would announce the site was
 * assembled rather than designed. Every route out of here is a real one.
 */
export default function NotFound() {
  return (
    <section className="grid-paper border-b-2 border-black">
      <div className="mx-auto max-w-3xl px-5 py-28">
        <div className="flex items-center gap-4">
          <Blob size={72} fill="#E9492D" rotate={-8} />
          <span className="label text-[12px] opacity-70">404</span>
        </div>

        <h1 className="display mt-6 text-[clamp(42px,9vw,86px)] leading-[0.92]">
          This page
          <br />
          does not fit
        </h1>
        <div className="-mt-2">
          <Squiggle size={240} stroke="#4D17F5" rotate={-1} />
        </div>

        <p className="mt-6 max-w-md text-[17px] leading-relaxed">
          The link is wrong, or the page moved. Nothing you did.
        </p>

        <div className="mt-9 flex flex-wrap gap-3">
          <PillLink href="/" accent="violet" size="lg">
            Back to the app
          </PillLink>
          <PillLink href="/brands" accent="paper" size="lg">
            Browse brands
          </PillLink>
          <PillLink href="/download" accent="paper" size="lg">
            Download
          </PillLink>
        </div>
      </div>
    </section>
  );
}
