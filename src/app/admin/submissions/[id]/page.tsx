import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { hasAdminSession } from '@/lib/auth/guard';
import { loadConfig } from '@/lib/config/load';
import { formatDateTime, formatDuration, formatScore } from '@/lib/format';
import { computeScore } from '@/lib/scoring';
import { getStore } from '@/lib/storage';
import type { Answers, ScoreResult, Submission } from '@/types/domain';

export const metadata: Metadata = {
  title: 'Submission',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** How far the recomputed score may drift from the stored one before it is worth flagging. */
const DRIFT_TOLERANCE = 1e-6;

function recompute(submission: Submission): ScoreResult | null {
  try {
    return computeScore(loadConfig(), submission.answers as Answers);
  } catch {
    // The stored answers no longer fit the current config at all — e.g. a factor was
    // removed. That is itself drift, and the caller reports it as such.
    return null;
  }
}

export default async function SubmissionDetailPage({
  params,
}: PageProps<'/admin/submissions/[id]'>) {
  if (!(await hasAdminSession())) redirect('/admin/login');

  const { id } = await params;
  const submission = await getStore().get(id);
  if (!submission) notFound();

  const config = loadConfig();
  const recomputed = recompute(submission);
  const drift =
    recomputed === null ||
    Math.abs(recomputed.overallScore - submission.result.overallScore) > DRIFT_TOLERANCE ||
    recomputed.level.value !== submission.result.level.value;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/admin" className="rounded-sm text-sm text-accent underline">
          <span aria-hidden="true">←</span> Back to dashboard
        </Link>
      </div>

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          Submission {formatDateTime(submission.submittedAt)}
        </h1>
        <p className="font-mono text-sm text-muted">{submission.id}</p>
      </header>

      {drift && (
        <div className="rounded-lg border-2 border-danger bg-danger-soft p-5">
          <h2 className="font-semibold text-danger">Configuration has changed since this response</h2>
          <p className="mt-2 max-w-prose text-sm text-ink">
            This response was collected under configuration version{' '}
            <strong className="font-semibold">{submission.configVersion}</strong>; the current
            version is <strong className="font-semibold">{config.meta.version}</strong>. Recomputing
            the score from the stored answers with today&rsquo;s weights gives{' '}
            <strong className="font-semibold">
              {recomputed === null
                ? 'a result that cannot be computed at all'
                : `${formatScore(recomputed.overallScore, 4)} (Level ${recomputed.level.value})`}
            </strong>
            , where the stored result was{' '}
            <strong className="font-semibold">
              {formatScore(submission.result.overallScore, 4)} (Level{' '}
              {submission.result.level.value})
            </strong>
            . The stored figure is the one this respondent saw. Treat the two as belonging to
            different instruments when analysing them together.
          </p>
        </div>
      )}

      <Card heading="Result" headingLevel="h2">
        <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted">Overall score</dt>
            <dd className="text-2xl font-semibold tabular-nums text-ink">
              {formatScore(submission.result.overallScore, 4)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Maturity level</dt>
            <dd className="text-2xl font-semibold" style={{ color: `var(--level-${submission.result.level.value}-text)` }}>
              {submission.result.level.value} · {submission.result.level.name}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Configuration version</dt>
            <dd className="text-2xl font-semibold tabular-nums text-ink">
              {submission.configVersion}
            </dd>
          </div>
        </dl>

        <h3 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">
          Tier scores
        </h3>
        <ul className="mt-2 flex flex-col gap-1">
          {Object.entries(submission.result.tierScores).map(([tierId, score]) => {
            const tier = config.tiers.find((t) => t.id === tierId);
            return (
              <li key={tierId} className="flex justify-between gap-3 text-sm">
                <span className="text-ink">{tier?.name ?? tierId}</span>
                <span className="tabular-nums text-muted">
                  {formatScore(score, 4)}
                  {tier ? ` · weight ${formatScore(tier.weight, 2)}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card heading="Respondent" headingLevel="h2">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {config.respondent_fields.map((field) => {
            const raw = submission.respondent[field.id];
            const display =
              field.type === 'select'
                ? (field.options ?? []).find((option) => option.value === raw)?.label
                : raw;
            return (
              <div key={field.id}>
                <dt className="text-sm text-muted">{field.label}</dt>
                <dd className="text-ink">
                  {display === undefined || display === '' ? (
                    <span className="text-muted">Not given</span>
                  ) : (
                    String(display)
                  )}
                </dd>
              </div>
            );
          })}
        </dl>
      </Card>

      <Card heading="Answers" headingLevel="h2">
        <div className="scroll-x">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="p-3 font-semibold text-ink">
                  Factor
                </th>
                <th scope="col" className="p-3 font-semibold text-ink">
                  Tier
                </th>
                <th scope="col" className="p-3 font-semibold text-ink">
                  Answer
                </th>
                <th scope="col" className="p-3 font-semibold text-ink">
                  Statement chosen
                </th>
              </tr>
            </thead>
            <tbody>
              {config.factors.map((factor) => {
                const answer = submission.answers[factor.id];
                const tier = config.tiers.find((t) => t.id === factor.tier);
                return (
                  <tr key={factor.id} className="border-b border-line last:border-b-0 align-top">
                    <th scope="row" className="p-3 text-left font-normal text-ink">
                      {factor.name}
                    </th>
                    <td className="p-3 text-muted">{tier?.name}</td>
                    <td className="p-3 whitespace-nowrap text-ink">
                      {answer === undefined
                        ? '—'
                        : `${answer} · ${config.scale_labels[String(answer)] ?? ''}`}
                    </td>
                    <td className="p-3 text-ink">
                      {answer === undefined ? (
                        <span className="text-muted">Not answered</span>
                      ) : (
                        // Resolved through the config, not stored per submission.
                        (factor.statements[String(answer)] ?? (
                          <span className="text-danger">
                            No statement for this value in the current configuration
                          </span>
                        ))
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card heading="Metadata" headingLevel="h2">
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">Submitted at</dt>
            <dd className="text-ink">{formatDateTime(submission.submittedAt)} UTC</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Time taken</dt>
            <dd className="text-ink">{formatDuration(submission.meta.durationMs)}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-sm text-muted">User agent</dt>
            <dd className="break-words font-mono text-sm text-ink">
              {submission.meta.userAgent || '—'}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}
