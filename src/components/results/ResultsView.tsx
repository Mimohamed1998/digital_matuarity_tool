'use client';

import { useMemo } from 'react';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ScoreHeadline } from '@/components/results/ScoreHeadline';
import type { AppConfig } from '@/lib/config/schema';
import { computeScore, isComplete } from '@/lib/scoring';
import { useSurveyHydrated, useSurveyStore } from '@/store/survey-store';
import type { Answers } from '@/types/domain';

interface ResultsViewProps {
  config: AppConfig;
}

/**
 * The results page body.
 *
 * The score is computed here, in the browser, from the answers already in the store —
 * it never depends on a network round-trip, so a storage outage cannot cost a
 * respondent their result.
 */
export function ResultsView({ config }: ResultsViewProps) {
  const hydrated = useSurveyHydrated();
  const answers = useSurveyStore((state) => state.answers);

  const complete = isComplete(config, answers);
  const result = useMemo(
    () => (complete ? computeScore(config, answers as Answers) : null),
    [complete, config, answers],
  );

  // Until sessionStorage has been read there is nothing to say. Showing the empty state
  // here would look like the answers had been lost.
  if (!hydrated) {
    return (
      <Card>
        <p className="text-muted">Working out your result…</p>
      </Card>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-ink">No results yet</h1>
          <p className="max-w-prose text-muted">
            There are no answers in this browser session to score. Results cannot be retrieved once
            a survey has been closed, so if you completed one earlier you will need to take it
            again.
          </p>
        </header>
        <div>
          <ButtonLink href="/survey">Start the survey</ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ScoreHeadline
        result={result}
        maxScore={config.scoring.max_answer}
        decimals={config.scoring.decimals}
      />
    </div>
  );
}
