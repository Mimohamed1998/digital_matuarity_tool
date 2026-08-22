import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ExportButtons } from '@/components/admin/ExportButtons';
import { LogoutButton } from '@/components/admin/LogoutButton';
import { SubmissionTable } from '@/components/admin/SubmissionTable';
import { SummaryStats } from '@/components/admin/SummaryStats';
import { hasAdminSession } from '@/lib/auth/guard';
import { loadConfig } from '@/lib/config/load';
import { getStore } from '@/lib/storage';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

// Never statically cached: this page renders live respondent data.
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PAGE_SIZE = 25;

export default async function AdminDashboardPage({
  searchParams,
}: PageProps<'/admin'>) {
  // The second gate (NFR-6). The middleware is a convenience, not the only check.
  if (!(await hasAdminSession())) redirect('/admin/login');

  const config = loadConfig();
  const store = getStore();

  const params = await searchParams;
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page;
  const requestedPage = Math.max(1, Number.parseInt(rawPage ?? '1', 10) || 1);

  // Aggregates come from the store's own summary query, not from fetching every row.
  const [summary, page] = await Promise.all([
    store.summary(),
    store.list({ limit: PAGE_SIZE, offset: (requestedPage - 1) * PAGE_SIZE }),
  ]);

  const pageCount = Math.max(1, Math.ceil(page.total / PAGE_SIZE));

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-ink">Submissions</h1>
          <p className="text-sm text-muted">
            Collected under configuration version {config.meta.version}.
          </p>
        </div>
        <LogoutButton />
      </header>

      <SummaryStats summary={summary} config={config} />

      <section aria-labelledby="export-heading" className="flex flex-col gap-3">
        <h2 id="export-heading" className="text-xl font-semibold text-ink">
          Export
        </h2>
        <p className="max-w-prose text-sm text-muted">
          One row per respondent and one column per factor, ready for SPSS, R or Excel. JSON gives
          the full stored document for each submission.
        </p>
        <ExportButtons disabled={summary.total === 0} />
      </section>

      <section aria-labelledby="submissions-heading" className="flex flex-col gap-4">
        <h2 id="submissions-heading" className="text-xl font-semibold text-ink">
          All submissions
        </h2>
        <SubmissionTable
          items={page.items}
          page={requestedPage}
          pageCount={pageCount}
          total={page.total}
        />
      </section>
    </div>
  );
}
