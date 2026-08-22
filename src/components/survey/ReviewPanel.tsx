'use client';

import type { AppConfig } from '@/lib/config/schema';

interface ReviewPanelProps {
  config: AppConfig;
  onEdit: (step: number) => void;
}

/** Placeholder — the review step is built in T-016. */
export function ReviewPanel({ config, onEdit }: ReviewPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Review your answers</h1>
      <p className="text-muted">
        {config.factors.length} questions answered.{' '}
        <button type="button" className="text-accent underline" onClick={() => onEdit(1)}>
          Edit the first answer
        </button>
      </p>
    </div>
  );
}
