import type { AppConfig } from '@/lib/config/schema';
import type { Recommendation, ScoreResult } from '@/types/domain';

/**
 * Recommendation ranking — see docs/plan.md §3.5.
 *
 * Pure. Text is never generated here: every string comes from
 * `factors[].recommendations[answer]` in conf.yaml.
 */

/**
 * Two impacts within this distance count as tied. Impacts are products of weights like
 * 0.383, so two factors that are equal in principle can differ in the 17th decimal;
 * without this, the tie-break below would never fire and the order would look arbitrary.
 */
const TIE_EPSILON = 1e-12;

export interface RecommendationSet {
  /** Factors answered below the maximum, ranked by impact descending. */
  improvements: Recommendation[];
  /** Factors answered at the maximum, shown separately and de-emphasised. */
  strengths: Recommendation[];
}

export function buildRecommendations(config: AppConfig, result: ScoreResult): RecommendationSet {
  const maxAnswer = config.scoring.max_answer;
  const tierOrder = new Map(config.tiers.map((tier, index) => [tier.id, index]));
  const factorOrder = new Map(config.factors.map((factor, index) => [factor.id, index]));

  const improvements: Recommendation[] = [];
  const strengths: Recommendation[] = [];

  for (const factorScore of result.factorScores) {
    const factor = config.factors.find((f) => f.id === factorScore.factorId);
    const tier = config.tiers.find((t) => t.id === factorScore.tierId);
    if (!factor || !tier) {
      throw new Error(`No configuration found for factor "${factorScore.factorId}"`);
    }

    const text = factor.recommendations[String(factorScore.answer)];
    if (!text) {
      throw new Error(
        `conf.yaml has no recommendation for factor "${factor.id}" at answer ${factorScore.answer}`,
      );
    }

    const recommendation: Recommendation = {
      factorId: factor.id,
      factorName: factor.name,
      tierName: tier.name,
      currentAnswer: factorScore.answer,
      // Reuse the engine's number rather than recomputing the formula in a second place.
      impact: factorScore.impact,
      text,
    };

    if (factorScore.answer >= maxAnswer) {
      strengths.push(recommendation);
    } else {
      improvements.push(recommendation);
    }
  }

  improvements.sort((a, b) => {
    const byImpact = b.impact - a.impact;
    if (Math.abs(byImpact) > TIE_EPSILON) return byImpact;

    const tierA = tierOrder.get(findTierId(result, a.factorId)) ?? 0;
    const tierB = tierOrder.get(findTierId(result, b.factorId)) ?? 0;
    if (tierA !== tierB) return tierA - tierB;

    return (factorOrder.get(a.factorId) ?? 0) - (factorOrder.get(b.factorId) ?? 0);
  });

  return { improvements, strengths };
}

function findTierId(result: ScoreResult, factorId: string): string {
  return result.factorScores.find((f) => f.factorId === factorId)?.tierId ?? '';
}
