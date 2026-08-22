'use client';

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from 'recharts';
import { formatScore } from '@/lib/format';
import type { AppConfig } from '@/lib/config/schema';
import type { ScoreResult } from '@/types/domain';

interface FactorRadarProps {
  config: AppConfig;
  result: ScoreResult;
}

/** One axis per factor, on a fixed [min, max] domain, plus the same numbers as a table. */
export function FactorRadar({ config, result }: FactorRadarProps) {
  const { min_answer: minScore, max_answer: maxScore } = config.scoring;

  const data = result.factorScores.map((factor) => ({
    factor: factor.factorName,
    answer: factor.answer,
  }));

  return (
    <section aria-labelledby="factor-radar-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="factor-radar-heading" className="text-xl font-semibold text-ink">
          Your answer for each factor
        </h2>
        <p className="text-sm text-muted">
          Each axis runs from {formatScore(minScore, 0)} to {formatScore(maxScore, 0)}. A larger
          shape means a more digitally mature answer.
        </p>
      </div>

      <div className="h-72 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="70%">
            <PolarGrid stroke="var(--border-strong)" />
            <PolarAngleAxis
              dataKey="factor"
              tick={{ fill: 'var(--text-muted)', fontSize: 11 }}
            />
            <PolarRadiusAxis
              domain={[minScore, maxScore]}
              tickCount={maxScore - minScore + 1}
              tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
              stroke="var(--border)"
            />
            <Radar
              dataKey="answer"
              stroke={`var(--level-${result.level.value}-fill)`}
              fill={`var(--level-${result.level.value}-fill)`}
              fillOpacity={0.35}
              isAnimationActive={false}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="scroll-x rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[30rem] border-collapse text-sm">
          <caption className="p-3 text-left text-muted">
            Your answer for each factor, with the effective weight it carries
          </caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="p-3 font-semibold text-ink">
                Factor
              </th>
              <th scope="col" className="p-3 font-semibold text-ink">
                Tier
              </th>
              <th scope="col" className="p-3 text-right font-semibold text-ink">
                Answer
              </th>
              <th scope="col" className="p-3 text-right font-semibold text-ink">
                Effective weight
              </th>
            </tr>
          </thead>
          <tbody>
            {result.factorScores.map((factor) => {
              const tier = result.tierScores.find((t) => t.tierId === factor.tierId);
              return (
                <tr key={factor.factorId} className="border-b border-line last:border-b-0">
                  <th scope="row" className="p-3 text-left font-normal text-ink">
                    {factor.factorName}
                  </th>
                  <td className="p-3 text-muted">{tier?.tierName}</td>
                  <td className="p-3 text-right tabular-nums font-medium text-ink">
                    {factor.answer} · {config.scale_labels[String(factor.answer)]}
                  </td>
                  <td className="p-3 text-right tabular-nums text-muted">
                    {formatScore(factor.tierWeight * factor.factorWeight, 4)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
