'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useSurveyStore } from '@/store/survey-store';

interface StartOverButtonProps {
  /** Shown in the confirmation, so the warning fits what is actually at stake. */
  warning: string;
  label?: string;
}

/**
 * Clears the survey and starts again.
 *
 * Always confirms first. `reset()` wipes sessionStorage, and because results cannot be
 * retrieved once cleared (FR-10), a mis-click here is unrecoverable — that is exactly
 * the case a confirmation exists for.
 */
export function StartOverButton({ warning, label = 'Start a new assessment' }: StartOverButtonProps) {
  const router = useRouter();
  const reset = useSurveyStore((state) => state.reset);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="secondary" onClick={() => setConfirming(true)}>
        {label}
      </Button>
    );
  }

  return (
    <div
      role="alertdialog"
      aria-label="Confirm starting again"
      className="rounded-lg border-2 border-danger bg-danger-soft p-4"
    >
      <p className="max-w-prose text-sm font-medium text-ink">{warning}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        <Button
          size="sm"
          onClick={() => {
            reset();
            router.push('/survey');
          }}
        >
          Yes, clear it and start again
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setConfirming(false)} autoFocus>
          Cancel
        </Button>
      </div>
    </div>
  );
}
