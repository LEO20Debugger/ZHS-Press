'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DESKTOP_NAV, isCurrentSection } from './nav-items';

/**
 * The desktop header row.
 *
 * A client component only because it needs the current path; the header
 * around it stays a server component.
 *
 * The current section is marked three ways: aria-current for screen readers,
 * full ink against the others' muted tone, and the hover underline held in
 * place. Weight does not change — a bolder word is a wider word, and the whole
 * row would shuffle sideways on every navigation.
 */
export function DesktopNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="hidden md:block">
      <ul className="flex items-center gap-8">
        {DESKTOP_NAV.map((item) => {
          const current = isCurrentSection(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={`link-underline text-small transition-colors duration-fast ${
                  current ? 'link-underline-active text-ink' : 'text-ink-muted hover:text-ink'
                }`}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
