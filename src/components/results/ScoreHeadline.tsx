import { formatScore } from '@/lib/format';
import type { ScoreResult } from '@/types/domain';

interface ScoreHeadlineProps {
  result: ScoreResult;
  maxScore: number;
  decimals: number;
}

/**
 * The headline number and maturity level.
 *
 * The level colour is an accent — a left border and the heading colour — never the only
 * signal: the level number and name are always present as text (FR-12).
 */
export function ScoreHeadline({ result, maxScore, decimals }: ScoreHeadlineProps) {
  const { level, overallScore } = result;
  const levelVar = `var(--level-${level.value})`;
  const levelTextVar = `var(--level-${level.value}-text)`;

  return (
    <section
      aria-labelledby="score-heading"
      className="rounded-lg border border-line bg-surface p-6"
      style={{ borderLeft: `8px solid ${levelVar}` }}
    >
      <h1 id="score-heading" className="text-sm font-medium uppercase tracking-wide text-muted">
        Your digital maturity result
      </h1>

      <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <p className="text-5xl font-bold tabular-nums text-ink">
          {formatScore(overallScore, decimals)}
          <span className="ml-1 text-2xl font-medium text-muted">
            {' '}
            / {formatScore(maxScore, 0)}
          </span>
        </p>
        <p className="text-2xl font-semibold" style={{ color: levelTextVar }}>
          Level {level.value} · {level.name}
        </p>
      </div>

      <p className="mt-2 text-lg font-medium text-ink">{level.headline}</p>
      <p className="text-sm font-medium text-muted">{level.subtitle}</p>
      <p className="mt-4 max-w-prose text-ink">{level.description}</p>

      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">
        What this level looks like
      </h2>
      <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-ink">
        {level.characteristics.map((characteristic) => (
          <li key={characteristic}>{characteristic}</li>
        ))}
      </ul>
    </section>
  );
}
