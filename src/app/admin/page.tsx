import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { hasAdminSession } from '@/lib/auth/guard';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** Placeholder — the dashboard is built in T-032. */
export default async function AdminDashboardPage() {
  if (!(await hasAdminSession())) redirect('/admin/login');

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight text-ink">Submissions</h1>
    </div>
  );
}
