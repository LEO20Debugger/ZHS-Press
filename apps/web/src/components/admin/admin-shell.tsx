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
  // Set by the first press of the toggle; see the sidebar's transition below.
  const [animate, setAnimate] = useState(false);
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
    setAnimate(true);
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

  /*
   * Hold the page still while the phone menu covers it. Without this, a swipe
   * on the menu scrolled the page underneath instead, and closing the menu
   * showed a different part of the page from the one it was opened over.
   */
  useEffect(() => {
    if (!menuOpen) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [menuOpen]);

  /*
   * The menu is phone-only. Turning a tablet to landscape, or widening a
   * window past the breakpoint with it open, would otherwise leave the page
   * locked behind a menu that CSS has hidden.
   */
  useEffect(() => {
    if (!menuOpen) return;
    const wide = window.matchMedia('(min-width: 768px)');
    const onChange = () => {
      if (wide.matches) setMenuOpen(false);
    };
    wide.addEventListener('change', onChange);
    return () => wide.removeEventListener('change', onChange);
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
   * The icon sits at a fixed distance from the left edge whatever the sidebar's
   * width, so collapsing slides the edge in past still icons rather than
   * shuffling them to the centre. The label fades instead of disappearing, and
   * never wraps, so mid-animation it is clipped cleanly by the narrowing panel.
   *
   * Collapsed, the label stays in the accessibility tree — the link keeps its
   * name — and `title` gives a mouse user the same name on hover. The active
   * link is marked with a bar down its left edge as well as colour.
   */
  function navLink(item: NavItem, compact: boolean) {
    const active = isActive(item.href);
    const { Icon } = item;
    return (
      <Link
        href={item.href}
        aria-current={active ? 'page' : undefined}
        title={compact ? item.label : undefined}
        className={`relative flex min-h-[44px] items-center gap-3 whitespace-nowrap pl-[22px] pr-4 font-ui text-small ${
          active ? 'bg-paper-deep text-ink' : 'text-ink-muted hover:bg-paper-deep hover:text-ink'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute inset-y-2 left-0 w-0.5 ${active ? 'bg-accent' : 'bg-transparent'}`}
        />
        <Icon size={20} />
        <span
          className={`transition-opacity duration-200 motion-reduce:transition-none ${
            compact ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {item.label}
        </span>
      </Link>
    );
  }

  function navGroups(compact: boolean) {
    return (
      <>
        {groups.map((group) => (
          <div key={group.label} className="mt-5 first:mt-0">
            {/*
              The heading keeps its height when collapsed — only its text
              fades — so the links below do not jump up as the panel closes.
            */}
            <p
              className={`eyebrow mb-1 whitespace-nowrap pl-[22px] transition-opacity duration-200 motion-reduce:transition-none ${
                compact ? 'opacity-0' : 'opacity-100'
              }`}
              aria-hidden={compact || undefined}
            >
              {group.label}
            </p>
            <ul>
              {group.items.map((item) => (
                <li key={item.href}>{navLink(item, compact)}</li>
              ))}
            </ul>
          </div>
        ))}
      </>
    );
  }

  return (
    /*
      --admin-footer-h is shared by the sidebar's Settings strip and any page's
      sticky action bar (the product form's save bar). Both sit on the bottom
      edge of the screen side by side, so equal heights put their top rules on
      one straight line instead of a step where they meet.
    */
    <div
      className={`min-h-screen ${menuOpen ? 'bg-paper md:bg-paper-deep' : 'bg-paper-deep'}`}
      style={{ '--admin-footer-h': '76px' } as React.CSSProperties}
    >
      {/*
        One top bar at every width. On desktop it carries the brand, the
        sidebar toggle and the account links, which leaves the sidebar beneath
        it for navigation alone — short enough to fit a laptop screen without a
        scrollbar of its own. On a phone it carries the brand and the menu
        button. Sticky either way: the admin's long pages are tables.
      */}
      <header className="sticky top-0 z-30 border-b border-rule bg-paper">
        {/* One pixel short of 3.5rem, so the bar *with* its bottom border is
            exactly the 3.5rem the sidebar below is positioned against. */}
        <div className="flex h-[calc(3.5rem-1px)] items-center justify-between gap-4 px-4 md:px-5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              aria-controls="admin-sidebar"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className="-ml-1.5 hidden min-h-[40px] min-w-[40px] items-center justify-center text-ink-muted hover:text-ink md:flex"
            >
              <IconSidebar size={20} />
            </button>
            <Link href="/admin" className="flex items-center gap-2.5" aria-label="ZHS Admin — dashboard">
              <LogoMark className="h-7 w-auto text-ink" />
              <span className="font-display text-h3" aria-hidden="true">
                Admin
              </span>
            </Link>
          </div>

          {/*
            The role, not the account name: which permissions you are working
            under is what changes what this interface will let you do.
          */}
          <div className="hidden items-center gap-5 text-caption text-ink-muted md:flex">
            <span className="uppercase tracking-wide">{user.role}</span>
            <Link href="/" className="link-underline flex items-center gap-1.5 hover:text-ink">
              <IconExternal size={14} />
              View site
            </Link>
            <button
              type="button"
              onClick={signOut}
              className="link-underline flex items-center gap-1.5 hover:text-ink"
            >
              <IconSignOut size={14} />
              Sign out
            </button>
          </div>

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
            className="-mr-2 flex min-h-[44px] min-w-[44px] items-center justify-center text-ink md:hidden"
          >
            {menuOpen ? <IconClose size={22} /> : <IconMenu size={22} />}
          </button>
        </div>

        {/*
          The phone menu, full screen under the top bar.

          It used to drop down only as far as its links reached, leaving the
          page visible — and scrollable — beneath it, which read as a menu that
          had not finished opening. Now it covers everything below the bar, and
          the page behind is held still while it is open (see the scroll-lock
          effect above), so closing it returns the reader exactly where they
          were. Links at the top, account actions pinned to the foot, as in the
          desktop sidebar. Scrolls within itself on a phone too short for it all.

          Safari on iOS 26 floats its toolbar over the page and ends every fixed
          element at the toolbar's top edge, however tall it is made; the strip
          behind the toolbar always shows the page itself. So while the menu is
          open the page turns menu-coloured and its content is hidden (see the
          wrapper and <main> below), and that strip reads as more menu.

          Rendered only when open rather than hidden with CSS, so its links
          stay out of the tab order while it is closed.
        */}
        {menuOpen ? (
          <nav
            id="admin-menu"
            aria-label="Admin"
            className="fixed inset-x-0 bottom-0 top-14 z-30 flex flex-col overflow-y-auto overscroll-contain bg-paper py-4 md:hidden"
          >
            {navGroups(false)}
            {settings ? <div className="mt-5">{navLink(settings, false)}</div> : null}

            <div className="mt-auto border-t border-rule px-[22px] pt-4">
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

      <div className="md:flex">
        {/*
          The sidebar, from tablet width up, filling the height under the top
          bar and staying put while long tables scroll beside it.

          Its width animates when the toggle is pressed — and only then. The
          transition class is added on the first press, so the remembered width
          applies at once on page load instead of visibly sliding into place
          every time the admin is opened. Reduced motion skips the animation.
        */}
        <aside
          id="admin-sidebar"
          aria-label="Admin"
          className={`sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 flex-col overflow-hidden border-r border-rule bg-paper md:flex ${
            collapsed ? 'w-16' : 'w-60'
          } ${animate ? 'transition-[width] duration-200 ease-out motion-reduce:transition-none' : ''}`}
        >
          <nav aria-label="Admin sections" className="flex-1 overflow-y-auto overflow-x-hidden py-5">
            {navGroups(collapsed)}
          </nav>

          {settings ? (
            <div className="flex h-[var(--admin-footer-h)] shrink-0 items-center border-t border-rule">
              <div className="w-full">{navLink(settings, collapsed)}</div>
            </div>
          ) : null}
        </aside>

        {/* invisible, not hidden: keeps its layout, so the scroll position survives the menu. */}
        <main className={`min-w-0 flex-1 ${menuOpen ? 'invisible md:visible' : ''}`}>
          <div className="shell py-8 md:py-12">{children}</div>
        </main>
      </div>
    </div>
  );
}
