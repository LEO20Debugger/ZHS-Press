import Link from 'next/link';
import { CartCount } from './cart-count';
import { HandDrawnRule } from './primitives';
import { NewsletterForm } from './newsletter-form';

const NAV = [
  { href: '/books', label: 'Books' },
  { href: '/magazine', label: 'Magazine' },
  { href: '/shop', label: 'Shop' },
  { href: '/submissions', label: 'Submissions' },
  { href: '/about', label: 'About' },
] as const;

const SOCIAL = [
  { href: 'https://www.instagram.com/zhspress', label: 'Instagram' },
  { href: 'https://www.linkedin.com/company/zhspress', label: 'LinkedIn' },
] as const;

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-rule bg-paper/95 backdrop-blur">
      <div className="shell flex items-center justify-between gap-8 py-4">
        <Link href="/" className="font-display text-h3 tracking-tight">
          ZHS&nbsp;Press
        </Link>

        <nav aria-label="Primary" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {NAV.map((item) => (
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
          {/*
            Mobile navigation is a details/summary disclosure rather than a
            JS drawer: it works before hydration and is keyboard-operable for
            free.
          */}
          <details className="relative md:hidden">
            <summary className="cursor-pointer list-none text-small [&::-webkit-details-marker]:hidden">
              Menu
            </summary>
            <ul className="absolute right-0 top-8 w-44 border border-rule bg-paper-raised p-4">
              {NAV.map((item) => (
                <li key={item.href} className="py-1.5">
                  <Link href={item.href} className="text-small">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
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
            <h2 className="font-display text-h2">Stay in the light.</h2>
            <HandDrawnRule className="mt-3 max-w-[180px] text-terracotta" />
            <p className="mt-4 max-w-sm font-editorial text-small text-ink-muted">
              New titles, new issues, and the occasional look at what we are working on. No more
              than once a month.
            </p>
            <div className="mt-6 max-w-sm">
              <NewsletterForm source="footer" />
            </div>
          </div>

          <nav aria-label="Footer">
            <h3 className="eyebrow">Browse</h3>
            <ul className="mt-4 space-y-2">
              {NAV.map((item) => (
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

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-8 text-caption text-ink-muted">
          <p>© {new Date().getFullYear()} ZHS Press. All rights reserved.</p>
          <p>
            <em className="font-editorial">Light</em> is published by ZHS Press.
          </p>
        </div>
      </div>
    </footer>
  );
}
