import { formatScore } from '@/lib/format';
import type { AppConfig } from '@/lib/config/schema';
import type { Recommendation } from '@/types/domain';

interface RecommendationListProps {
  recommendations: Recommendation[];
  config: AppConfig;
}

/**
 * Improvement actions, in the order the engine produced them.
 *
 * The component does no sorting and writes no text: order comes from
 * `buildRecommendations`, text comes from conf.yaml.
 */
export function RecommendationList({ recommendations, config }: RecommendationListProps) {
  if (recommendations.length === 0) {
    return (
      <section aria-labelledby="recommendations-heading" className="flex flex-col gap-3">
        <h2 id="recommendations-heading" className="text-xl font-semibold text-ink">
          Where to improve next
        </h2>
        <div className="rounded-lg border border-line bg-surface p-6">
          <p className="text-ink">
            Every factor is already at the highest level on this scale, so there is nothing to
            prioritise. The strengths below are what to protect.
          </p>
        </div>
      </section>
    );
  }

  const largestImpact = recommendations[0].impact;

  return (
    <section aria-labelledby="recommendations-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="recommendations-heading" className="text-xl font-semibold text-ink">
          Where to improve next
        </h2>
        <p className="max-w-prose text-sm text-muted">
          Highest-impact actions first. The ranking combines how much weight a factor carries in
          the model with how far your current answer is from the top of its scale — so a small gap
          on a heavily weighted factor can outrank a large gap on a light one.
        </p>
      </div>

      <ol className="flex flex-col gap-4">
        {recommendations.map((recommendation, index) => {
          const share = largestImpact > 0 ? (recommendation.impact / largestImpact) * 100 : 0;
          const scaleLabel = config.scale_labels[String(recommendation.currentAnswer)];

          return (
            <li
              key={recommendation.factorId}
              className="rounded-lg border border-line bg-surface p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-lg font-semibold text-ink">
                  <span className="text-muted">{index + 1}.</span> {recommendation.factorName}
                </h3>
                <p className="text-sm text-muted">
                  {recommendation.tierName} · currently {recommendation.currentAnswer} ·{' '}
                  {scaleLabel}
                </p>
              </div>

              <p className="mt-3 max-w-prose text-ink">{recommendation.text}</p>

              <div className="mt-4 flex items-center gap-3">
                <div
                  className="h-1.5 w-32 overflow-hidden rounded-full bg-surface-2"
                  aria-hidden="true"
                >
                  <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
                </div>
                <p className="text-xs text-muted">
                  Closing this gap would add up to {formatScore(recommendation.impact, 2)} to your
                  overall score
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
