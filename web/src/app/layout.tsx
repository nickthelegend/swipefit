import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';

import Nav from '@/components/nav';
import { siteUrl } from '@/lib/site';
import Footer from '@/components/footer';
import './globals.css';

/**
 * Archivo only — one family, the full weight range.
 *
 * Space Grotesk was rejected on the app for the same reason it is rejected
 * here: its quirky forms fight byooooob's grotesque, and it is the most
 * over-shipped default in this category.
 */
const archivo = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '900'],
  variable: '--font-archivo',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'FITCHECK — the face decides what you wear',
  description:
    'A swipe-to-shop app where every card is the garment rendered on your own body. One skin scan decides what you see. Built on YouCam Skin AI and Apparel VTO.',
  // The SVG is listed first so browsers that support it get the vector; the
  // 32/16 PNGs are redrawn for those sizes rather than downscaled, because the
  // full mark turns to mush below ~32px.
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
  manifest: '/manifest.webmanifest',
  openGraph: {
    title: 'FITCHECK — the face decides what you wear',
    description:
      'Every card is the garment rendered on your own body, not a stock photo. One skin scan decides what you see.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'FITCHECK' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FITCHECK — the face decides what you wear',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={archivo.variable}>
      <head>
        {/* Reveal-on-scroll starts at opacity 0 and is un-hidden by JS. Without
            this the whole proof section and the brand grid would be invisible,
            not merely un-animated, to anyone with scripting off. */}
        <noscript>
          <style dangerouslySetInnerHTML={{ __html: '.reveal{opacity:1;transform:none}' }} />
        </noscript>
      </head>
      <body className={`${archivo.className} min-h-screen antialiased`}>
        {/*
          Keyboard users otherwise tab through the entire header — including the
          mobile menu button — on every page before reaching any content. Hidden
          until focused, then drawn in the world's own vocabulary rather than as
          a browser default.
        */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:border-2 focus:border-black focus:bg-[#EBD22F] focus:px-5 focus:py-3 focus:text-[13px] focus:font-semibold focus:uppercase focus:tracking-[0.06em]"
        >
          Skip to content
        </a>

        <Nav />
        <main id="main">{children}</main>
        <Footer />

        {/*
          Structured data. Two entities because they answer different questions:
          Organization is who publishes this, SoftwareApplication is what the
          page is actually offering. Declared free with an explicit price of 0 —
          omitting `offers` entirely makes search engines guess, and guessing
          wrong here means the listing implies a paid app.
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'FITCHECK',
                url: siteUrl,
                logo: `${siteUrl}/icon-512.png`,
              },
              {
                '@context': 'https://schema.org',
                '@type': 'SoftwareApplication',
                name: 'FITCHECK',
                applicationCategory: 'ShoppingApplication',
                operatingSystem: 'Android, iOS',
                url: siteUrl,
                description:
                  'A swipe-to-shop app where every card is the garment rendered on your own body. One skin scan decides what you see.',
                offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              },
            ]),
          }}
        />
      </body>
    </html>
  );
}
