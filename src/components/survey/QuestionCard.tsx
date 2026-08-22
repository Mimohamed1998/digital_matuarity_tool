'use client';

import { forwardRef } from 'react';
import { RadioStatement } from '@/components/ui/RadioStatement';
import type { FactorConfig, TierConfig } from '@/lib/config/schema';
import type { AnswerValue } from '@/types/domain';

interface QuestionCardProps {
  factor: FactorConfig;
  tier: TierConfig;
  /** Scale labels keyed "1".."5", from conf.yaml. */
  scaleLabels: Record<string, string>;
  /** Answer values in ascending order, e.g. [1, 2, 3, 4, 5]. */
  scaleValues: AnswerValue[];
  answer: AnswerValue | undefined;
  onAnswer: (answer: AnswerValue) => void;
}

/**
 * One factor question with its five statements.
 *
 * The statements are a real radiogroup: a `<fieldset>` with a `<legend>`, and five native
 * radios sharing a name. That is what gives arrow-key navigation and Space selection
 * without a line of keyboard-handling code.
 */
export const QuestionCard = forwardRef<HTMLHeadingElement, QuestionCardProps>(
  function QuestionCard({ factor, tier, scaleLabels, scaleValues, answer, onAnswer }, ref) {
    const questionId = `${factor.id}-question`;

    return (
      <section className="flex flex-col gap-5" aria-labelledby={`${factor.id}-heading`}>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-muted">
            {tier.label} · {tier.name}
          </p>
          {/* tabIndex -1 so the flow can move focus here on a step change. */}
          <h2
            id={`${factor.id}-heading`}
            ref={ref}
            tabIndex={-1}
            className="text-2xl font-semibold text-ink"
          >
            {factor.name}
          </h2>
          <p id={questionId} className="max-w-prose text-ink">
            {factor.question}
          </p>
        </div>

        <fieldset aria-describedby={questionId} className="flex flex-col gap-3">
          <legend className="mb-2 text-sm text-muted">
            Select the statement that best describes your organisation.
          </legend>
          {scaleValues.map((value) => (
            <RadioStatement
              key={value}
              name={`factor-${factor.id}`}
              value={value}
              scaleLabel={scaleLabels[String(value)] ?? `Level ${value}`}
              statement={factor.statements[String(value)] ?? ''}
              checked={answer === value}
              onSelect={(selected) => onAnswer(selected as AnswerValue)}
            />
          ))}
        </fieldset>
      </section>
    );
  },
);
