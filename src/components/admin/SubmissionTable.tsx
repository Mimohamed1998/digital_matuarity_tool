import Link from 'next/link';
import { formatDateTime, formatScore } from '@/lib/format';
import type { SubmissionListItem } from '@/lib/storage';

interface SubmissionTableProps {
  items: SubmissionListItem[];
  page: number;
  pageCount: number;
  total: number;
}

/**
 * The submissions list.
 *
 * Respondent names are deliberately absent — designation only. A dashboard left open on
 * a screen should not expose every participant by name; the detail page is where a name
 * appears, one respondent at a time.
 */
export function SubmissionTable({ items, page, pageCount, total }: SubmissionTableProps) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-8 text-center">
        <p className="font-medium text-ink">No submissions yet</p>
        <p className="mt-1 text-sm text-muted">
          Responses will appear here as participants complete the survey.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="scroll-x rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <caption className="p-3 text-left text-muted">
            {total} submission{total === 1 ? '' : 's'}, newest first. Names are shown on the detail
            page only.
          </caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="p-3 font-semibold text-ink">
                Submitted
              </th>
              <th scope="col" className="p-3 font-semibold text-ink">
                Designation
              </th>
              <th scope="col" className="p-3 text-right font-semibold text-ink">
                Years in digitalisation
              </th>
              <th scope="col" className="p-3 text-right font-semibold text-ink">
                Score
              </th>
              <th scope="col" className="p-3 font-semibold text-ink">
                Level
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-line last:border-b-0">
                <td className="p-3">
                  <Link
                    href={`/admin/submissions/${item.id}`}
                    className="rounded-sm font-medium text-accent underline"
                  >
                    {formatDateTime(item.submittedAt)}
                    <span className="sr-only-focusable"> — open this submission</span>
                  </Link>
                </td>
                <td className="p-3 text-ink">{item.designation || '—'}</td>
                <td className="p-3 text-right tabular-nums text-muted">
                  {item.experienceDigitalisationYears ?? '—'}
                </td>
                <td className="p-3 text-right tabular-nums font-medium text-ink">
                  {formatScore(item.overallScore, 2)}
                </td>
                <td className="p-3">
                  <span className="inline-flex items-center gap-2 text-ink">
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: `var(--level-${item.levelValue}-fill)` }}
                    />
                    {item.levelValue} · {item.levelName}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <nav aria-label="Submissions pagination" className="flex items-center justify-between">
          {page > 1 ? (
            <Link href={`/admin?page=${page - 1}`} className="rounded-sm text-accent underline">
              <span aria-hidden="true">←</span> Newer
            </Link>
          ) : (
            <span className="text-muted">
              <span aria-hidden="true">←</span> Newer
            </span>
          )}
          <p className="text-sm text-muted">
            Page {page} of {pageCount}
          </p>
          {page < pageCount ? (
            <Link href={`/admin?page=${page + 1}`} className="rounded-sm text-accent underline">
              Older <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <span className="text-muted">
              Older <span aria-hidden="true">→</span>
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
