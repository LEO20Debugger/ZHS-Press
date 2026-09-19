import Link from 'next/link';
import { LogoMark } from './logo-mark';
import { LogoTagline } from './logo-tagline';
import { CartCount } from './cart-count';
import { Eyebrow, HandDrawnRule } from './primitives';
import { NewsletterForm } from './newsletter-form';
import { MobileMenu } from './mobile-menu';
import { DESKTOP_NAV, FOOTER_NAV } from './nav-items';

const SOCIAL = [
  { href: 'https://www.instagram.com/zhspress', label: 'Instagram' },
  { href: 'https://www.linkedin.com/company/zhspress', label: 'LinkedIn' },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/95 backdrop-blur">
      <div className="shell flex items-center justify-between gap-8 py-4">
        {/*
          The lockup set horizontally — mark, then tagline beside it — rather
          than stacked as the artwork supplies it.

          Stacked, the tagline is a third of the total height and splits across
          two lines, so fitting the whole thing into a 40px header row sets each
          line about 5px tall. Placed alongside, the same words get the full row
          height to share and stay readable.

          Both are inlined rather than loaded, so they paint with the first HTML
          response instead of after a second request — the logo is never briefly
          missing at the top of the page — and both take their colour from
          `text-ink` through currentColor.

          The tagline is hidden below `sm`, where the row also carries Cart and
          Menu and there is no room for it; the mark alone stands in, and the
          full name is still on the page in the footer.
        */}
        <Link href="/" className="flex items-center gap-3" aria-label="ZHS Press — home">
          <LogoMark className="h-9 w-auto shrink-0 text-ink md:h-10" />
          <LogoTagline className="hidden h-6 w-auto text-ink sm:block md:h-7" />
        </Link>

        {/*
          Flat, and in the order the press thinks of its own work: what it
          makes, then where to buy it, then how to reach it. The phone menu
          groups the catalogue under Shop because a thumb reads a panel one row
          at a time; a header at this width says everything at once, and hiding
          three of them behind a hover would only make the fast case slower.
        */}
        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {DESKTOP_NAV.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="link-underline text-small">
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-6">
          <CartCount />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-paper-deep">
      <div className="shell py-16">
        <div className="grid gap-12 md:grid-cols-[1.2fr_1fr_1fr]">
          <div>
            <Eyebrow>The ZHS Press letter</Eyebrow>
            <h2 className="mt-3 font-display text-h2">Stay close to what we&rsquo;re publishing.</h2>
            <HandDrawnRule className="mt-3 max-w-[180px] text-terracotta" />
            <p className="mt-4 max-w-sm font-editorial text-small text-ink-muted">
              New books, new issues of <em>LIGHT</em>, stationery, and occasional notes from the
              world of ZHS Press. Just the things worth knowing about.
            </p>
            <div className="mt-6 max-w-sm">
              <NewsletterForm source="footer" />
            </div>
          </div>

          <nav aria-label="Footer">
            <h3 className="eyebrow">Browse</h3>
            <ul className="mt-4 space-y-2">
              {FOOTER_NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="link-underline text-small">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div>
            <h3 className="eyebrow">Elsewhere</h3>
            <ul className="mt-4 space-y-2">
              {SOCIAL.map((item) => (
                <li key={item.href}>
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="link-underline text-small"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
              <li>
                <a href="mailto:info@zhspress.org" className="link-underline text-small">
                  info@zhspress.org
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/*
          The full lockup goes here and nowhere else.

          The footer is the one place with room to set the tagline at a legible
          size, so "Zenith Highest Story-Telling Press" — which is the press's
          actual name — appears once per page without crowding the header.
        */}
        <div className="mt-16 border-t border-rule pt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/logo-lockup.svg"
            alt="Zenith Highest Story-Telling Press"
            width={180}
            height={127}
            className="h-auto w-[150px] md:w-[180px]"
          />
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-caption text-ink-muted">
          <p>© {new Date().getFullYear()} ZHS Press. All rights reserved.</p>
          <p>
            <em className="font-editorial">LIGHT</em> is published by ZHS Press.
          </p>
        </div>
      </div>
    </footer>
  );
}
