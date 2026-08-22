'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import type { AppConfig } from '@/lib/config/schema';
import { missingFactorIds } from '@/lib/scoring';
import { RESPONDENT_STEP, useSurveyStore } from '@/store/survey-store';

interface ReviewPanelProps {
  config: AppConfig;
  /** Jump back to a step, marking it as a round trip so the user returns here. */
  onEdit: (step: number) => void;
}

/**
 * The review step (FR-5) — "users can go through the answers submitted".
 *
 * Reads answers straight from the store and resolves the statement text through config,
 * so what is shown here is exactly what will be scored and stored.
 */
export function ReviewPanel({ config, onEdit }: ReviewPanelProps) {
  const router = useRouter();
  const answers = useSurveyStore((state) => state.answers);
  const respondent = useSurveyStore((state) => state.respondent);
  const goTo = useSurveyStore((state) => state.goTo);

  const missing = missingFactorIds(config, answers);
  const missingNames = missing
    .map((id) => config.factors.find((factor) => factor.id === id)?.name ?? id)
    .join(', ');

  const stepForFactor = (factorId: string) =>
    config.factors.findIndex((factor) => factor.id === factorId) + 1;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted">Final step</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink">Review your answers</h1>
        <p className="max-w-prose text-muted">
          Check everything below before you see your results. You can change any answer, and
          you&rsquo;ll come straight back here.
        </p>
      </header>

      <Card
        heading="About you"
        headingLevel="h2"
        actions={
          <Button variant="secondary" size="sm" onClick={() => onEdit(RESPONDENT_STEP)}>
            Edit
          </Button>
        }
      >
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {config.respondent_fields.map((field) => {
            const raw = respondent[field.id];
            const display =
              field.type === 'select'
                ? (field.options ?? []).find((option) => option.value === raw)?.label
                : raw;
            return (
              <div key={field.id} className="flex flex-col">
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

      {config.tiers.map((tier) => (
        <Card key={tier.id} heading={tier.name} headingLevel="h2" description={tier.label}>
          <ul className="flex flex-col divide-y divide-[var(--border)]">
            {config.factors
              .filter((factor) => factor.tier === tier.id)
              .map((factor) => {
                const answer = answers[factor.id];
                const scaleLabel = answer ? config.scale_labels[String(answer)] : undefined;
                return (
                  <li key={factor.id} className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-ink">{factor.name}</h3>
                        <p className="text-sm text-muted">{factor.question}</p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onEdit(stepForFactor(factor.id))}
                      >
                        Edit
                        <span className="sr-only-focusable"> your answer for {factor.name}</span>
                      </Button>
                    </div>

                    {answer ? (
                      <div className="rounded-md border border-line bg-surface-2 p-3">
                        <p className="text-sm font-medium text-ink">
                          {answer} · {scaleLabel}
                        </p>
                        <p className="mt-1 text-sm text-ink">
                          {factor.statements[String(answer)]}
                        </p>
                      </div>
                    ) : (
                      <p className="rounded-md border border-danger bg-danger-soft p-3 text-sm font-medium text-danger">
                        Not answered yet.
                      </p>
                    )}
                  </li>
                );
              })}
          </ul>
        </Card>
      ))}

      <div className="flex flex-col gap-3 border-t border-line pt-6">
        {missing.length > 0 && (
          <p className="text-sm font-medium text-danger">
            Answer {missingNames} before you can see your results.
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* A plain step back, not an edit round trip — the last question keeps its
              normal Back/Review navigation. */}
          <Button variant="secondary" onClick={() => goTo(config.factors.length)}>
            <span aria-hidden="true">←</span> Back to the last question
          </Button>
          <Button
            onClick={() => router.push('/results')}
            disabled={missing.length > 0}
            aria-describedby={missing.length > 0 ? 'review-missing-hint' : undefined}
          >
            See my results
          </Button>
        </div>
        {missing.length > 0 && (
          <p id="review-missing-hint" className="sr-only-focusable">
            {missing.length} question{missing.length === 1 ? '' : 's'} still unanswered:{' '}
            {missingNames}
          </p>
        )}
      </div>
    </div>
  );
}
