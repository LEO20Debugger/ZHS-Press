import type { Metadata } from 'next';

/**
 * Applies to every admin route including /admin/login, so it carries only the
 * metadata. The authenticated chrome lives in the (dashboard) route group,
 * which keeps the login page outside it — otherwise the shell's session check
 * would redirect the login page to itself.
 */
export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · ZHS Admin' },
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
