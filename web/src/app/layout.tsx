import type { Metadata } from 'next';
import { Archivo } from 'next/font/google';

import Nav from '@/components/nav';
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
      <body className={`${archivo.className} min-h-screen antialiased`}>
        <Nav />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
