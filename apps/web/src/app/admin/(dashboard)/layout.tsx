import { AdminShell } from '@/components/admin/admin-shell';

/** Everything in this group requires a session. */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
