'use client';

import { Button } from '@/components/ui/Button';

interface SurveyNavProps {
  onBack: () => void;
  onNext: () => void;
  /** Disabled until the current factor has an answer. */
  nextDisabled: boolean;
  nextLabel: string;
  backLabel?: string;
  /** Explains why Next is unavailable, for anyone who cannot see the disabled styling. */
  nextHint?: string;
}

export function SurveyNav({
  onBack,
  onNext,
  nextDisabled,
  nextLabel,
  backLabel = 'Back',
  nextHint,
}: SurveyNavProps) {
  const hintId = nextHint && nextDisabled ? 'survey-next-hint' : undefined;

  return (
    <div className="flex flex-col gap-3 border-t border-line pt-5">
      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" onClick={onBack}>
          <span aria-hidden="true">←</span> {backLabel}
        </Button>
        <Button onClick={onNext} disabled={nextDisabled} aria-describedby={hintId}>
          {nextLabel} <span aria-hidden="true">→</span>
        </Button>
      </div>
      {hintId && (
        <p id={hintId} className="text-right text-sm text-muted">
          {nextHint}
        </p>
      )}
    </div>
  );
}
