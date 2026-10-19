'use client';

import Link from 'next/link';
import { LogoMark } from '../logo-mark';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import {
  IconAudience,
  IconCatalogue,
  IconClose,
  IconExternal,
  IconMenu,
  IconOrders,
  IconOverview,
  IconParity,
  IconSettings,
  IconSidebar,
  IconSignOut,
  IconSubmissions,
} from './icons';

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'editor';
}

interface NavItem {
  href: string;
  label: string;
  /** Routes an editor must not see. Mirrors the @Roles('admin') guards on the API. */
  adminOnly: boolean;
  Icon: ComponentType<{ size?: number; className?: string }>;
}

/*
 * Grouped, so the list can grow without turning into one undifferentiated
 * column: the day-to-day running of the shop first, the editorial work second.
 * Settings is kept apart and pinned to the foot of the sidebar — visited
 * rarely, and better out of the way of the links used every day.
 */
const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Shop',
    items: [
      { href: '/admin', label: 'Overview', adminOnly: false, Icon: IconOverview },
      { href: '/admin/orders', label: 'Orders', adminOnly: true, Icon: IconOrders },
      { href: '/admin/products', label: 'Catalogue', adminOnly: false, Icon: IconCatalogue },
    ],
  },
  {
    label: 'Content',
    items: [
      { href: '/admin/submissions', label: 'Submissions', adminOnly: false, Icon: IconSubmissions },
      { href: '/admin/audience', label: 'Audience', adminOnly: true, Icon: IconAudience },
      { href: '/admin/parity', label: 'Amazon parity', adminOnly: false, Icon: IconParity },
    ],
  },
];

const SETTINGS: NavItem = {
  href: '/admin/settings',
  label: 'Settings',
  adminOnly: true,
  Icon: IconSettings,
};

/** Where the collapsed/expanded choice is remembered, per browser. */
const COLLAPSED_KEY = 'zhs-admin-sidebar-collapsed';

export function AdminShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  /*
   * Read the remembered sidebar width after mount, not during render: the
   * server has no localStorage, and reading it in render would make the first
   * client paint disagree with the server's HTML. Wrapped, because storage can
   * be unavailable (private windows, blocked site data) and the sidebar must
   * still work without it.
   */
  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === 'true');
    } catch {
      // Storage unavailable: start expanded.
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        // Not remembered this time; the toggle itself still works.
      }
      return next;
    });
  }

  /*
   * Close the mobile menu whenever the route changes.
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
  const allowed = (item: NavItem) => !item.adminOnly || user.role === 'admin';
  const groups = NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter(allowed) })).filter(
    (group) => group.items.length > 0,
  );
  const settings = allowed(SETTINGS) ? SETTINGS : null;

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  /*
   * One nav link, for both the sidebar and the phone menu.
   *
   * Collapsed, the label is kept in the DOM as screen-reader text rather than
   * removed, so the link keeps its name; `title` gives a sighted mouse user
   * the same name on hover. The active link is marked with a bar down its left
   * edge as well as colour — a bar reads at a glance where a muted/ink
   * difference does not.
   */
  function navLink(item: NavItem, compact: boolean) {
    const active = isActive(item.href);
    const { Icon } = item;
    return (
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        title={compact ? item.label : undefined}
        className={`relative flex min-h-[44px] items-center gap-3 font-ui text-small ${
          compact ? 'justify-center px-0' : 'px-4'
        } ${active ? 'bg-paper-deep text-ink' : 'text-ink-muted hover:bg-paper-deep hover:text-ink'}`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-2 left-0 w-0.5 ${active ? 'bg-accent' : 'bg-transparent'}`}
        />
        <Icon size={compact ? 20 : 18} />
        <span className={compact ? 'sr-only' : ''}>{item.label}</span>
      </Link>
    );
  }

  function navGroups(compact: boolean) {
    return (
      <>
        {groups.map((group) => (
          <div key={group.label} className="mt-6 first:mt-0">
            {/*
              Collapsed, the group heading becomes a short rule: the gap still
              separates the groups, and an icon rail has no room for words.
            */}
            {compact ? (
              <hr className="mx-4 mb-2 border-rule" />
            ) : (
              <p className="eyebrow mb-1 px-4">{group.label}</p>
            )}
            <ul>
              {group.items.map((item) => (
                <li key={item.href}>
                  {navLink(item, compact)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-paper-deep md:flex">
      {/*
        The sidebar, from tablet width up.

        Sticky at full height, so the navigation stays put while long tables
        scroll beside it — the reason an admin moves its nav to the side at
        all. It scrolls on its own if a short window cannot fit every link.

        The width change is instant rather than animated: animating width
        reflows the whole page on every frame, which this site's motion rules
        rule out, and a toggle the user asked for does not need easing in.
      */}
      <aside
        aria-label="Admin"
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-rule bg-paper md:flex ${
          collapsed ? 'w-16' : 'w-60'
        }`}
      >
        <div
          className={`flex items-center border-b border-rule py-4 ${
            collapsed ? 'flex-col gap-3 px-2' : 'justify-between gap-2 px-4'
          }`}
        >
          <Link
            href="/admin"
            className="flex items-center gap-2.5"
            aria-label="ZHS Admin — dashboard"
          >
            <LogoMark className="h-7 w-auto text-ink" />
            {!collapsed ? (
              <span className="font-display text-h3" aria-hidden="true">
                Admin
              </span>
            ) : null}
          </Link>
          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex min-h-[36px] min-w-[36px] items-center justify-center text-ink-muted hover:text-ink"
          >
            <IconSidebar size={18} />
          </button>
        </div>

        <nav aria-label="Admin sections" className="flex-1 overflow-y-auto py-4">
          {navGroups(collapsed)}
        </nav>

        <div className="border-t border-rule py-3">
          {settings ? navLink(settings, collapsed) : null}

          {/*
            The role, not the account name. Which permissions you are working
            under is what changes what this interface will let you do.
          */}
          {!collapsed ? (
            <p className="eyebrow mt-3 px-4">Signed in as {user.role}</p>
          ) : null}

          <div className={collapsed ? 'mt-2' : 'mt-1'}>
            <Link
              href="/"
              title={collapsed ? 'View site' : undefined}
              className={`flex min-h-[40px] items-center gap-3 font-ui text-caption text-ink-muted hover:text-ink ${
                collapsed ? 'justify-center' : 'px-4'
              }`}
            >
              <IconExternal size={16} />
              <span className={collapsed ? 'sr-only' : ''}>View site</span>
            </Link>
            <button
              type="button"
              onClick={signOut}
              title={collapsed ? 'Sign out' : undefined}
              className={`flex min-h-[40px] w-full items-center gap-3 font-ui text-caption text-ink-muted hover:text-ink ${
                collapsed ? 'justify-center' : 'px-4'
              }`}
            >
              <IconSignOut size={16} />
              <span className={collapsed ? 'sr-only' : ''}>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/*
          Phones keep a top bar with a menu button: a permanent sidebar would
          take a third of the screen. Sticky, because the admin's long pages
          are tables, and scrolling all the way back up to reach another
          section is the whole reason a phone user gives up on an admin.
        */}
        <header className="sticky top-0 z-30 border-b border-rule bg-paper md:hidden">
          <div className="shell flex items-center justify-between gap-4 py-3">
            <Link href="/admin" className="flex items-center gap-2.5" aria-label="ZHS Admin — dashboard">
              <LogoMark className="h-7 w-auto text-ink" />
              <span className="font-display text-h3" aria-hidden="true">
                Admin
              </span>
            </Link>

            {/*
              A real <button> with aria-expanded and aria-controls, so a screen
              reader announces the panel's state. 44px: below that a target is
              genuinely hard to hit on a phone.
            */}
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-expanded={menuOpen}
              aria-controls="admin-menu"
              aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              className="-mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center text-ink"
            >
              {menuOpen ? <IconClose size={22} /> : <IconMenu size={22} />}
            </button>
          </div>

          {/*
            Rendered only when open rather than hidden with CSS, so its links
            stay out of the tab order while it is closed.
          */}
          {menuOpen ? (
            <nav id="admin-menu" aria-label="Admin" className="border-t border-rule bg-paper py-4">
              {navGroups(false)}
              {settings ? (
                <div className="mt-6">
                  {navLink(settings, false)}
                </div>
              ) : null}

              <div className="mt-4 border-t border-rule px-4 pt-4">
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

        <main className="shell py-8 md:py-12">{children}</main>
      </div>
    </div>
  );
}
