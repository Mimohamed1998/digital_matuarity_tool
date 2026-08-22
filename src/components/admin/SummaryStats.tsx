import { formatScore } from '@/lib/format';
import type { AppConfig } from '@/lib/config/schema';
import type { StoreSummary } from '@/lib/storage';
import type { AnswerValue } from '@/types/domain';

interface SummaryStatsProps {
  summary: StoreSummary;
  config: AppConfig;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}

export function SummaryStats({ summary, config }: SummaryStatsProps) {
  const maxLevelCount = Math.max(1, ...Object.values(summary.levelDistribution));

  return (
    <section aria-labelledby="summary-heading" className="flex flex-col gap-5">
      <h2 id="summary-heading" className="text-xl font-semibold text-ink">
        Summary
      </h2>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total submissions" value={String(summary.total)} />
        <Stat label="Last 7 days" value={String(summary.last7Days)} />
        <Stat label="Last 30 days" value={String(summary.last30Days)} />
        <Stat
          label="Mean overall score"
          value={
            summary.meanOverallScore === null
              ? '—'
              : formatScore(summary.meanOverallScore, config.scoring.decimals)
          }
        />
      </dl>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Maturity level distribution
          </h3>
          <ul className="mt-3 flex flex-col gap-2">
            {config.maturity_levels.map((level) => {
              const count = summary.levelDistribution[level.value as AnswerValue] ?? 0;
              const share = (count / maxLevelCount) * 100;
              return (
                <li key={level.value} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-sm text-ink">
                    {level.value} · {level.name}
                  </span>
                  <span
                    className="h-3 min-w-[2px] rounded-full"
                    style={{
                      width: `${Math.max(share, count > 0 ? 3 : 0)}%`,
                      backgroundColor: `var(--level-${level.value})`,
                    }}
                    aria-hidden="true"
                  />
                  <span className="text-sm tabular-nums text-muted">{count}</span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-lg border border-line bg-surface p-5">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
            Mean answer per factor
          </h3>
          <ul className="mt-3 flex flex-col gap-2">
            {config.factors.map((factor) => {
              const mean = summary.meanByFactor[factor.id];
              return (
                <li key={factor.id} className="flex items-center justify-between gap-3">
                  <span className="text-sm text-ink">{factor.name}</span>
                  <span className="text-sm tabular-nums text-muted">
                    {mean === undefined ? '—' : formatScore(mean, 2)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
