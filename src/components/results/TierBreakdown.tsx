'use client';

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { formatScore } from '@/lib/format';
import type { ScoreResult } from '@/types/domain';

interface TierBreakdownProps {
  result: ScoreResult;
  minScore: number;
  maxScore: number;
  decimals: number;
}

/**
 * Tier scores as horizontal bars.
 *
 * The axis domain is fixed to the answer scale, never inferred from the data: an
 * auto-scaled axis makes a 2.1 look like a strong result, which would be actively
 * misleading in a research instrument.
 */
export function TierBreakdown({ result, minScore, maxScore, decimals }: TierBreakdownProps) {
  const data = result.tierScores.map((tier) => ({
    name: tier.tierName,
    score: Number(tier.score.toFixed(6)),
    weight: tier.weight,
  }));

  return (
    <section aria-labelledby="tier-breakdown-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="tier-breakdown-heading" className="text-xl font-semibold text-ink">
          How each tier scored
        </h2>
        <p className="text-sm text-muted">
          Both axes run the full {formatScore(minScore, 0)}–{formatScore(maxScore, 0)} scale, so
          the bars are comparable.
        </p>
      </div>

      <div className="h-48 w-full" aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis
              type="number"
              domain={[minScore, maxScore]}
              ticks={[1, 2, 3, 4, 5]}
              allowDataOverflow={false}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              stroke="var(--border-strong)"
            />
            <YAxis
              type="category"
              dataKey="name"
              width={110}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              stroke="var(--border-strong)"
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((entry) => (
                <Cell key={entry.name} fill={`var(--level-${result.level.value}-fill)`} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="scroll-x rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[24rem] border-collapse text-sm">
          <caption className="p-3 text-left text-muted">
            Tier scores, with the weight each tier carries in the overall score
          </caption>
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="p-3 font-semibold text-ink">
                Tier
              </th>
              <th scope="col" className="p-3 text-right font-semibold text-ink">
                Weight
              </th>
              <th scope="col" className="p-3 text-right font-semibold text-ink">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {result.tierScores.map((tier) => (
              <tr key={tier.tierId} className="border-b border-line last:border-b-0">
                <th scope="row" className="p-3 text-left font-normal text-ink">
                  {tier.tierName}
                </th>
                <td className="p-3 text-right tabular-nums text-muted">
                  {formatScore(tier.weight, 2)}
                </td>
                <td className="p-3 text-right tabular-nums font-medium text-ink">
                  {formatScore(tier.score, decimals)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
