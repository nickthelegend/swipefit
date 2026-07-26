'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { Chevrons, Globe, IconArrow, Starburst } from '@/components/doodles';
import { BrandMark } from '@/components/brand-mark';
import { Panel, PillLink, Tag, type Accent } from '@/components/ui/kit';
import { createClient, supabaseConfigured, type Brand } from '@/lib/supabase';

/**
 * The public brand directory.
 *
 * Falls back to the three brands already in the app's catalogue when Supabase
 * is unreachable or the schema has not been applied. That is not a mock — those
 * three ARE the shipping catalogue, and the page stating so is more honest than
 * an empty state that implies nobody has signed up.
 */
const CATALOGUE_BRANDS: Pick<Brand, 'name' | 'slug' | 'accent' | 'blurb' | 'website'>[] = [
  {
    name: "COS",
    slug: 'cos',
    accent: 'violet',
    blurb: "Modern, functional, considered design. 8 pieces in the FITCHECK catalogue.",
    website: "https://www.cos.com",
  },
  {
    name: "Uniqlo",
    slug: 'uniqlo',
    accent: 'tomato',
    blurb: "LifeWear \u2014 everyday essentials engineered for fit. 8 pieces in the FITCHECK catalogue.",
    website: "https://www.uniqlo.com",
  },
  {
    name: "Levi's",
    slug: 'levis',
    accent: 'forest',
    blurb: "The original denim house. 8 pieces in the FITCHECK catalogue.",
    website: "https://www.levi.com",
  },
  {
    name: "H&M",
    slug: 'hm',
    accent: 'acid',
    blurb: "Wide colour range across every category. 6 pieces in the FITCHECK catalogue.",
    website: "https://www.hm.com",
  },
  {
    name: "Zara",
    slug: 'zara',
    accent: 'violet',
    blurb: "Fast-moving fashion, broad silhouette range. 7 pieces in the FITCHECK catalogue.",
    website: "https://www.zara.com",
  },
  {
    name: "Massimo Dutti",
    slug: 'massimodutti',
    accent: 'tomato',
    blurb: "Tailored, muted, quietly premium. 6 pieces in the FITCHECK catalogue.",
    website: "https://www.massimodutti.com",
  },
  {
    name: "A.P.C.",
    slug: 'apc',
    accent: 'forest',
    blurb: "French minimalism and raw denim, unchanged since 1987. 6 pieces in the FITCHECK catalogue.",
    website: "https://www.apc.fr",
  },
  {
    name: "Sunspel",
    slug: 'sunspel',
    accent: 'acid',
    blurb: "English cotton, made in Long Eaton since 1860. 6 pieces in the FITCHECK catalogue.",
    website: "https://www.sunspel.com",
  },
  {
    name: "Outerknown",
    slug: 'outerknown',
    accent: 'violet',
    blurb: "Organic and recycled fibre, built to last. 5 pieces in the FITCHECK catalogue.",
    website: "https://www.outerknown.com",
  },
];

type Row = Pick<Brand, 'name' | 'slug' | 'accent' | 'blurb' | 'website'>;

export default function Brands() {
  const [brands, setBrands] = useState<Row[]>(CATALOGUE_BRANDS);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured()) return;
    let cancelled = false;

    void (async () => {
      try {
        const { data, error } = await createClient()
          .from('brands')
          .select('name, slug, accent, blurb, website')
          .eq('approved', true)
          .order('name');

        if (cancelled || error || !data || data.length === 0) return;
        setBrands(data as Row[]);
        setLive(true);
      } catch {
        // Directory stays on the catalogue list. Nothing to surface.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <section className="grid-paper border-b-2 border-black">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="flex items-center gap-4">
            <Chevrons size={56} fill="#4D17F5" />
            <Tag accent="acid">{live ? 'Live directory' : 'In the catalogue'}</Tag>
          </div>
          <h1 className="display mt-6 max-w-3xl text-[clamp(42px,8vw,78px)]">
            Brands on the rail
          </h1>
          <p className="mt-6 max-w-xl text-[17px] leading-relaxed">
            Every piece here is a real product with a real page. FITCHECK takes no cut — a swipe
            right sends the shopper to the brand&apos;s own site.
          </p>
        </div>
      </section>

      <section className="border-b-2 border-black">
        <div className="mx-auto max-w-6xl px-5 py-16">
          <div className="grid gap-6 md:grid-cols-3">
            {brands.map((brand) => (
              <Panel key={brand.slug} className="overflow-hidden">
                <div className="border-b-2 border-black">
                  <BrandMark
                    name={brand.name}
                    slug={brand.slug}
                    accent={brand.accent as Accent}
                  />
                </div>
                <div className="p-6">
                  <p className="min-h-[72px] text-[15px] leading-relaxed">{brand.blurb}</p>
                  {brand.website && (
                    <a
                      href={brand.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.06em] underline-offset-4 hover:underline"
                    >
                      Visit site
                      <IconArrow size={16} />
                    </a>
                  )}
                </div>
              </Panel>
            ))}
          </div>
        </div>
      </section>

      {/* Want to be a brand ------------------------------------------- */}
      <section className="bg-black text-[#FA9DCD]">
        <div className="mx-auto max-w-6xl px-5 py-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
            <div>
              <div className="flex items-center gap-3">
                <Globe size={46} fill="#EBD22F" />
                <span className="label text-[12px] opacity-70">Want to be on it?</span>
              </div>
              <h2 className="display mt-5 text-[clamp(32px,5vw,54px)]">
                Put your catalogue on real bodies
              </h2>
              <p className="mt-5 max-w-xl text-[17px] leading-relaxed opacity-90">
                Send us a flat-lay feed and a product URL per SKU. You get a console showing what
                shoppers actually did in front of each piece — the dwell, the hesitation, the
                reversal — and the traffic lands on your own site.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <PillLink href="/brands/join" accent="acid">
                  Become a partner
                </PillLink>
                <PillLink href="/brands/login" accent="paper">
                  Console login
                </PillLink>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { t: 'Flat-lays only', d: 'Garment alone on a plain ground. A model-worn shot corrupts the render.' },
                { t: 'Real product URLs', d: 'Every right-swipe deep-links to your page. No marketplace in between.' },
                { t: 'Your colours, measured', d: 'We sample the dominant garment colour from the image itself, not the swatch name.' },
                { t: 'No revenue share', d: 'We sell the signal above the sale, not a cut of it.' },
              ].map((item) => (
                <div key={item.t} className="rounded-[13px] border border-[#FA9DCD]/40 p-5">
                  <h3 className="display text-[18px] text-[#EBD22F]">{item.t}</h3>
                  <p className="mt-2 text-[14px] leading-relaxed opacity-85">{item.d}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 flex items-center gap-4 border-t border-[#FA9DCD]/25 pt-8">
            <Starburst size={44} fill="#E9492D" rotate={12} />
            <p className="text-[14px] opacity-75">
              Already a partner?{' '}
              <Link href="/brands/console" className="underline underline-offset-4">
                Open your console
              </Link>
              .
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
