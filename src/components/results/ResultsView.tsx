'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { RecommendationList } from '@/components/results/RecommendationList';
import { ScoreHeadline } from '@/components/results/ScoreHeadline';
import { StrengthList } from '@/components/results/StrengthList';
import { DownloadPdfButton } from '@/components/pdf/DownloadPdfButton';
import { StartOverButton } from '@/components/survey/StartOverButton';
import type { AppConfig } from '@/lib/config/schema';
import { buildRecommendations, computeScore, isComplete } from '@/lib/scoring';
import { useSurveyHydrated, useSurveyStore } from '@/store/survey-store';
import type { Answers } from '@/types/domain';

/**
 * Charts are loaded browser-side only. recharts measures the DOM to size itself, so
 * there is nothing useful for it to render during SSR, and keeping it out of the server
 * render also keeps it out of the initial HTML payload. The numbers themselves are in
 * the tables inside each chart component, which do render everywhere.
 */
const TierBreakdown = dynamic(
  () => import('@/components/results/TierBreakdown').then((m) => m.TierBreakdown),
  { ssr: false, loading: () => <ChartSkeleton label="Loading the tier breakdown…" /> },
);

const FactorRadar = dynamic(
  () => import('@/components/results/FactorRadar').then((m) => m.FactorRadar),
  { ssr: false, loading: () => <ChartSkeleton label="Loading the factor chart…" /> },
);

function ChartSkeleton({ label }: { label: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-6">
      <p className="text-sm text-muted">{label}</p>
    </div>
  );
}

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
  const submissionState = useSurveyStore((state) => state.submissionState);
  const respondent = useSurveyStore((state) => state.respondent);

  const complete = isComplete(config, answers);
  const result = useMemo(
    () => (complete ? computeScore(config, answers as Answers) : null),
    [complete, config, answers],
  );
  const recommendations = useMemo(
    () => (result ? buildRecommendations(config, result) : null),
    [config, result],
  );

  // Until sessionStorage has been read there is nothing to say. Showing the empty state
  // here would look like the answers had been lost.
  if (!hydrated) {
    // See SurveyFlow: an h1 here keeps the page from being briefly heading-less, and
    // this branch is replaced entirely once the store rehydrates.
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Your results</h1>
        <Card>
          <p className="text-muted">Working out your result…</p>
        </Card>
      </div>
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

      {submissionState === 'error' && (
        // Quiet, and deliberately not an error dialog: nothing about the result below is
        // affected, only the research dataset.
        <p className="rounded-md border border-line bg-surface-2 p-4 text-sm text-muted">
          Your response could not be saved for the study. Your result below is complete and
          correct — you can still download it as a PDF.
        </p>
      )}

      <TierBreakdown
        result={result}
        minScore={config.scoring.min_answer}
        maxScore={config.scoring.max_answer}
        decimals={config.scoring.decimals}
      />

      <FactorRadar config={config} result={result} />

      {recommendations && (
        <>
          <RecommendationList recommendations={recommendations.improvements} config={config} />
          <StrengthList strengths={recommendations.strengths} config={config} />

          <section aria-labelledby="download-heading" className="border-t border-line pt-6">
            <h2 id="download-heading" className="text-xl font-semibold text-ink">
              Take this with you
            </h2>
            <p className="mt-1 mb-4 max-w-prose text-sm text-muted">
              Results cannot be retrieved once you close this page, so download them now if you
              want to keep them.
            </p>
            <DownloadPdfButton
              config={config}
              result={result}
              improvements={recommendations.improvements}
              strengths={recommendations.strengths}
              respondentName={
                typeof respondent.name === 'string' && respondent.name.trim().length > 0
                  ? respondent.name
                  : undefined
              }
              respondentDesignation={
                typeof respondent.designation === 'string' ? respondent.designation : undefined
              }
            />

            <div className="mt-6">
              <StartOverButton warning="This will clear these results and all of your answers. They cannot be recovered afterwards — download the PDF first if you want to keep them." />
            </div>
          </section>
        </>
      )}
    </div>
  );
}
