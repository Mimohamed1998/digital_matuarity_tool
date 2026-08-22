import type { AppConfig } from '@/lib/config/schema';
import type { Recommendation } from '@/types/domain';

interface StrengthListProps {
  strengths: Recommendation[];
  config: AppConfig;
}

/** Factors already answered at the top of the scale. Deliberately de-emphasised. */
export function StrengthList({ strengths, config }: StrengthListProps) {
  if (strengths.length === 0) return null;

  const topLabel = config.scale_labels[String(config.scoring.max_answer)];

  return (
    <section aria-labelledby="strengths-heading" className="flex flex-col gap-3">
      <div>
        <h2 id="strengths-heading" className="text-lg font-semibold text-muted">
          Strengths to sustain
        </h2>
        <p className="text-sm text-muted">
          Already at {config.scoring.max_answer} · {topLabel}.
        </p>
      </div>

      <ul className="flex flex-col gap-3">
        {strengths.map((strength) => (
          <li key={strength.factorId} className="rounded-lg border border-line bg-surface-2 p-4">
            <h3 className="text-sm font-semibold text-ink">
              {strength.factorName}
              <span className="ml-2 font-normal text-muted">{strength.tierName}</span>
            </h3>
            <p className="mt-1 max-w-prose text-sm text-muted">{strength.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
