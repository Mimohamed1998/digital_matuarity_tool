'use client';

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { QuestionCard } from '@/components/survey/QuestionCard';
import { RespondentForm } from '@/components/survey/RespondentForm';
import { ReviewPanel } from '@/components/survey/ReviewPanel';
import { SurveyNav } from '@/components/survey/SurveyNav';
import type { AppConfig } from '@/lib/config/schema';
import { RESPONDENT_STEP, useSurveyHydrated, useSurveyStore } from '@/store/survey-store';
import type { AnswerValue } from '@/types/domain';

interface SurveyFlowProps {
  config: AppConfig;
}

/**
 * Orchestrates the survey: respondent form, then one factor question at a time, then
 * review (FR-4).
 *
 * The step model is an index only — step 0 is the respondent form, steps 1..N are the N
 * factors in config order, step N+1 is review. The factor for a step is looked up from
 * config on every render, so adding an eighth factor to conf.yaml adds an eighth step
 * with no code change here.
 */
export function SurveyFlow({ config }: SurveyFlowProps) {
  const hydrated = useSurveyHydrated();

  const currentStep = useSurveyStore((state) => state.currentStep);
  const answers = useSurveyStore((state) => state.answers);
  const returnToReview = useSurveyStore((state) => state.returnToReview);
  const setAnswer = useSurveyStore((state) => state.setAnswer);
  const setConfigVersion = useSurveyStore((state) => state.setConfigVersion);
  const goTo = useSurveyStore((state) => state.goTo);
  const next = useSurveyStore((state) => state.next);
  const prev = useSurveyStore((state) => state.prev);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const [announcement, setAnnouncement] = useState('');
  const previousStep = useRef<number | null>(null);

  const factors = config.factors;
  const reviewStep = factors.length + 1;
  const scaleValues = Array.from(
    { length: config.scoring.max_answer - config.scoring.min_answer + 1 },
    (_, index) => (config.scoring.min_answer + index) as AnswerValue,
  );

  // Discard progress captured under a different questionnaire version (NFR-5 / T-012).
  useEffect(() => {
    if (hydrated) setConfigVersion(config.meta.version);
  }, [hydrated, config.meta.version, setConfigVersion]);

  const factorIndex = currentStep - 1;
  const factor = factorIndex >= 0 && factorIndex < factors.length ? factors[factorIndex] : null;

  // Move focus to the new question and announce the change, but never on first paint —
  // stealing focus on load is disorienting, and there is nothing new to announce yet.
  useEffect(() => {
    if (!hydrated) return;
    const changed = previousStep.current !== null && previousStep.current !== currentStep;
    previousStep.current = currentStep;
    if (!changed || !factor) return;
    headingRef.current?.focus();
    setAnnouncement(`Question ${factorIndex + 1} of ${factors.length}: ${factor.name}`);
  }, [currentStep, factor, factorIndex, factors.length, hydrated]);

  if (!hydrated) {
    return (
      <Card>
        <p className="text-muted">Loading your progress…</p>
      </Card>
    );
  }

  if (currentStep === RESPONDENT_STEP) {
    return (
      <div className="flex flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted">Step 1 of {factors.length + 2}</p>
          <h1 className="text-3xl font-bold tracking-tight text-ink">General information</h1>
          <p className="max-w-prose text-muted">
            A few details about you, so responses can be analysed by role and experience. Only your
            name is optional.
          </p>
        </header>
        <RespondentForm
          fields={config.respondent_fields}
          onComplete={() => goTo(returnToReview ? reviewStep : 1)}
        />
      </div>
    );
  }

  if (currentStep >= reviewStep) {
    return <ReviewPanel config={config} onEdit={(step) => goTo(step, { returnToReview: true })} />;
  }

  if (!factor) {
    // The persisted step points past the end of the questionnaire — recover rather than
    // render nothing.
    goTo(RESPONDENT_STEP);
    return null;
  }

  const answer = answers[factor.id];
  const questionNumber = factorIndex + 1;

  return (
    <div className="flex flex-col gap-6">
      <ProgressBar
        value={questionNumber}
        max={factors.length}
        label={`Question ${questionNumber} of ${factors.length}`}
      />

      <p aria-live="polite" className="sr-only-focusable">
        {announcement}
      </p>

      <QuestionCard
        ref={headingRef}
        factor={factor}
        tier={config.tiers.find((tier) => tier.id === factor.tier) ?? config.tiers[0]}
        scaleLabels={config.scale_labels}
        scaleValues={scaleValues}
        answer={answer}
        onAnswer={(value) => setAnswer(factor.id, value)}
      />

      <SurveyNav
        onBack={() => (returnToReview ? goTo(reviewStep) : prev())}
        onNext={() => (returnToReview ? goTo(reviewStep) : next(reviewStep))}
        nextDisabled={answer === undefined}
        nextLabel={
          returnToReview
            ? 'Back to review'
            : questionNumber === factors.length
              ? 'Review answers'
              : 'Next'
        }
        backLabel={returnToReview ? 'Cancel' : 'Back'}
        nextHint="Select a statement to continue."
      />
    </div>
  );
}
