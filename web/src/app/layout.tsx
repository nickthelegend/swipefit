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
  openGraph: {
    title: 'FITCHECK — the face decides what you wear',
    description:
      'Every card is the garment rendered on your own body, not a stock photo. One skin scan decides what you see.',
    type: 'website',
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
