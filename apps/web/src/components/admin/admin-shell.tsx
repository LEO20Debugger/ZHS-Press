'use client';

import Link from 'next/link';
import { LogoMark } from '../logo-mark';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  IconCatalogue,
  IconClose,
  IconExternal,
  IconMenu,
  IconOrders,
  IconOverview,
  IconPages,
  IconParity,
  IconSignOut,
  IconSubmissions,
} from './icons';

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'editor';
}

/** Routes an editor must not see. Mirrors the @Roles('admin') guards on the API. */
const NAV = [
  { href: '/admin', label: 'Overview', adminOnly: false, Icon: IconOverview },
  { href: '/admin/products', label: 'Catalogue', adminOnly: false, Icon: IconCatalogue },
  {
    href: '/admin/submissions',
    label: 'Submissions',
    adminOnly: false,
    Icon: IconSubmissions,
  },
  { href: '/admin/pages', label: 'Pages', adminOnly: false, Icon: IconPages },
  { href: '/admin/parity', label: 'Amazon parity', adminOnly: false, Icon: IconParity },
  { href: '/admin/orders', label: 'Orders', adminOnly: true, Icon: IconOrders },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  /*
   * Close the menu whenever the route changes.
   *
   * Tapping a link navigates but does not unmount this shell, so without this
   * the panel stays open over the page you just asked for — on a phone that
   * covers the whole screen and reads as the tap having done nothing.
   */
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  /*
   * Escape closes it. An overlay you can open from the keyboard and not close
   * the same way is a trap, and this one covers the page it sits over.
   */
  useEffect(() => {
    if (!menuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch('/api/admin/auth/me', { cache: 'no-store' });
        if (cancelled) return;

        if (!response.ok) {
          router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
          return;
        }

        const data = (await response.json()) as { user: AdminUser };
        setUser(data.user);
      } catch {
        if (!cancelled) router.replace('/admin/login');
      } finally {
        if (!cancelled) setChecked(true);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  async function signOut() {
    await fetch('/api/admin/auth/logout', { method: 'POST' });
    router.replace('/admin/login');
  }

  if (!checked || !user) {
    return (
      <div className="shell py-24">
        <p className="text-small text-ink-muted">Checking your session…</p>
      </div>
    );
  }

  // Hiding admin-only links is presentation, not protection — the API refuses
  // those routes for an editor regardless of what the UI shows.
  const visible = NAV.filter((item) => !item.adminOnly || user.role === 'admin');

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <div className="min-h-screen bg-paper-deep">
      {/*
        Sticky, because the admin's long pages are tables. Scrolling to row 40
        of the catalogue and then having to scroll all the way back up to reach
        another section is the whole reason a phone user gives up on an admin.
      */}
      <header className="sticky top-0 z-30 border-b border-rule bg-paper">
        <div className="shell flex items-center justify-between gap-4 py-3 md:py-4">
          {/*
            Mark plus the word "Admin", so a glance at a browser tab or a shared
            screenshot never leaves any doubt which side of the site this is.
          */}
          <Link href="/admin" className="flex items-center gap-2.5" aria-label="ZHS Admin — dashboard">
            <LogoMark className="h-7 w-auto text-ink" />
            <span className="font-display text-h3" aria-hidden="true">
              Admin
            </span>
          </Link>

          {/* Desktop navigation. Hidden on phones, where the menu takes over. */}
          <nav aria-label="Admin" className="hidden md:block">
            <ul className="flex flex-wrap items-center gap-6">
              {visible.map(({ href, label, Icon }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-2 text-small ${
                        active ? 'text-ink underline' : 'text-ink-muted hover:text-ink'
                      }`}
                    >
                      <Icon />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="hidden items-center gap-4 text-caption text-ink-muted md:flex">
            {/*
              The role, not the account name. Which permissions you are working
              under is the thing that changes what this interface will let you
              do; the name only repeats what whoever is signed in already knows,
              and at desktop it was the widest thing in a crowded bar.
            */}
            <span className="uppercase tracking-wide">{user.role}</span>
            <Link href="/" className="link-underline flex items-center gap-1.5">
              <IconExternal size={14} />
              View site
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="link-underline flex items-center gap-1.5"
            >
              <IconSignOut size={14} />
              Sign out
            </button>
          </div>

          {/*
            The menu button. A real <button> with aria-expanded and aria-controls
            rather than a styled div, so a screen reader announces the panel's
            state instead of leaving it to be discovered.

            min-h/min-w of 44px: below that a target is genuinely hard to hit on
            a phone, and this is the one control the whole mobile admin depends
            on.
          */}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-controls="admin-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className="-mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center text-ink md:hidden"
          >
            {menuOpen ? <IconClose size={22} /> : <IconMenu size={22} />}
          </button>
        </div>

        {/*
          The mobile panel. Rendered only when open rather than hidden with CSS,
          so its links stay out of the tab order while it is closed.
        */}
        {menuOpen ? (
          <nav
            id="admin-menu"
            aria-label="Admin"
            className="border-t border-rule bg-paper md:hidden"
          >
            <ul className="shell py-2">
              {visible.map(({ href, label, Icon }) => {
                const active = isActive(href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex items-center gap-3 py-3 font-ui text-small ${
                        active ? 'text-ink' : 'text-ink-muted'
                      }`}
                    >
                      {/*
                        The active row is marked with a rule down its left edge,
                        not just a colour — a bar reads at a glance on a small
                        screen where a muted/ink distinction does not.
                      */}
                      <span
                        aria-hidden="true"
                        className={`h-5 w-0.5 ${active ? 'bg-accent' : 'bg-transparent'}`}
                      />
                      <Icon size={20} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>

            <div className="shell border-t border-rule py-3">
              <p className="text-caption text-ink-muted">
                {user.name} · <span className="uppercase tracking-wide">{user.role}</span>
              </p>
              <div className="mt-3 flex items-center gap-6">
                <Link href="/" className="flex items-center gap-2 py-2 font-ui text-small">
                  <IconExternal size={18} />
                  View site
                </Link>
                <button
                  type="button"
                  onClick={signOut}
                  className="flex items-center gap-2 py-2 font-ui text-small"
                >
                  <IconSignOut size={18} />
                  Sign out
                </button>
              </div>
            </div>
          </nav>
        ) : null}
      </header>

      <div className="shell py-8 md:py-12">{children}</div>
    </div>
  );
}
