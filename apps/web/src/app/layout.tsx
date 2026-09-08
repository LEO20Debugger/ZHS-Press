import type { Metadata } from 'next';
import { Fraunces, Inter, Newsreader } from 'next/font/google';
import './globals.css';

/**
 * Root layout.
 *
 * Deliberately carries no site chrome. The storefront header, footer and cart
 * live in the (site) route group; the admin area has its own shell. Putting
 * them here would render a shop header over the admin login page.
 *
 * Fonts are self-hosted at build time by next/font — no request to Google at
 * runtime, and no layout shift.
 *
 * Fraunces carries the SOFT and WONK axes deliberately: SOFT rounds the
 * terminals and WONK unlocks the more characterful italic forms. Without them
 * it is just another serif, and the warmth this brief asks for is gone.
 */
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'WONK', 'opsz'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-display-loaded',
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-ui-loaded',
});

const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-editorial-loaded',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.WEB_BASE_URL ?? 'https://zhspress.org'),
  title: {
    default: 'ZHS Press — books, Light magazine, and stationery',
    template: '%s · ZHS Press',
  },
  description:
    'An independent press publishing picture books, the literary magazine Light, and artist-designed stationery.',
  openGraph: {
    type: 'website',
    siteName: 'ZHS Press',
    locale: 'en_US',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} ${newsreader.variable}`}
      /*
       * The inline script below adds a `js` class to this element before React
       * hydrates, which React would otherwise report as a mismatch. Scoped to
       * this element's own attributes — children are still checked normally.
       */
      suppressHydrationWarning
    >
      <head>
        {/*
          Marks the document as JavaScript-capable before first paint.
          Every hidden-then-revealed animation state is scoped behind this
          class, so a reader without JS — or a crawler — gets the finished
          page immediately instead of a blank one. Inline and synchronous on
          purpose: a deferred script would let the unstyled state paint first.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: "document.documentElement.classList.add('js')",
          }}
        />
      </head>
      <body className="paper-grain min-h-screen">{children}</body>
    </html>
  );
}
