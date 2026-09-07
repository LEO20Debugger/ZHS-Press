'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'editor';
}

/** Routes an editor must not see. Mirrors the @Roles('admin') guards on the API. */
const NAV = [
  { href: '/admin', label: 'Overview', adminOnly: false },
  { href: '/admin/products', label: 'Catalogue', adminOnly: false },
  { href: '/admin/submissions', label: 'Submissions', adminOnly: false },
  { href: '/admin/parity', label: 'Amazon parity', adminOnly: false },
  { href: '/admin/orders', label: 'Orders', adminOnly: true },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [checked, setChecked] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

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

  return (
    <div className="min-h-screen bg-paper-deep">
      <div className="border-b border-rule bg-paper">
        <div className="shell flex flex-wrap items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-8">
            <Link href="/admin" className="font-display text-h3">
              ZHS&nbsp;Admin
            </Link>
            <nav aria-label="Admin">
              <ul className="flex flex-wrap gap-6">
                {visible.map((item) => {
                  const active =
                    item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        className={`text-small ${active ? 'text-ink underline' : 'text-ink-muted hover:text-ink'}`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          <div className="flex items-center gap-4 text-caption text-ink-muted">
            <span>
              {user.name} · <span className="uppercase tracking-wide">{user.role}</span>
            </span>
            <Link href="/" className="link-underline">
              View site
            </Link>
            <button type="button" onClick={signOut} className="link-underline">
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="shell py-12">{children}</div>
    </div>
  );
}
