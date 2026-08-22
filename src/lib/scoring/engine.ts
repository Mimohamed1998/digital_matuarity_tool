import type { AppConfig } from '@/lib/config/schema';
import type {
  Answers,
  AnswerValue,
  FactorScore,
  MaturityLevel,
  ScoreResult,
  TierScore,
} from '@/types/domain';

/**
 * The scoring engine — see docs/plan.md §3.
 *
 * Pure functions only. This module must not import React, Next, node:fs or anything
 * browser-specific: the same code runs in the browser (to show a result immediately)
 * and on the server (to compute the number that is actually stored).
 *
 * Nothing here rounds. Rounding is a formatting concern — see src/lib/format.ts.
 */

/** Floating-point slack for the range assertion. Weighted sums of 0.383-style weights drift. */
const RANGE_EPSILON = 1e-9;

function isAnswerValue(value: number, min: number, max: number): value is AnswerValue {
  return Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Compute the full score for a set of answers.
 *
 * @throws if an answer is missing, out of range, or if the configuration produces a
 *         score outside [min_answer, max_answer] — the sanity assertion from §3.2.
 */
export function computeScore(config: AppConfig, answers: Answers): ScoreResult {
  const { min_answer: minAnswer, max_answer: maxAnswer } = config.scoring;

  const factorScores: FactorScore[] = config.factors.map((factor) => {
    const tier = config.tiers.find((t) => t.id === factor.tier);
    if (!tier) {
      // Unreachable via loadConfig(), which rejects unknown tier references — but the
      // engine also accepts hand-built configs in tests, so this stays a real check.
      throw new Error(`Factor "${factor.id}" refers to unknown tier "${factor.tier}"`);
    }

    const answer = answers[factor.id];
    if (answer === undefined || answer === null) {
      throw new Error(`Missing answer for factor "${factor.id}"`);
    }
    if (!isAnswerValue(answer, minAnswer, maxAnswer)) {
      throw new Error(
        `Answer for factor "${factor.id}" must be an integer between ${minAnswer} and ${maxAnswer}, got ${String(answer)}`,
      );
    }

    return {
      factorId: factor.id,
      factorName: factor.name,
      tierId: tier.id,
      answer,
      factorWeight: factor.weight,
      tierWeight: tier.weight,
      contribution: tier.weight * factor.weight * answer,
      impact: tier.weight * factor.weight * (maxAnswer - answer),
    };
  });

  const tierScores: TierScore[] = config.tiers.map((tier) => ({
    tierId: tier.id,
    tierName: tier.name,
    weight: tier.weight,
    score: factorScores
      .filter((f) => f.tierId === tier.id)
      .reduce((total, f) => total + f.factorWeight * f.answer, 0),
  }));

  const overallScore = tierScores.reduce((total, tier) => total + tier.weight * tier.score, 0);

  if (overallScore < minAnswer - RANGE_EPSILON || overallScore > maxAnswer + RANGE_EPSILON) {
    throw new Error(
      `Overall score ${overallScore} falls outside the valid range [${minAnswer}, ${maxAnswer}]. ` +
        'This means conf.yaml is inconsistent: tier weights and each tier\'s factor weights must sum to 1.',
    );
  }

  return {
    overallScore,
    tierScores,
    factorScores,
    level: resolveLevel(config, overallScore),
  };
}

/**
 * Map a score onto its maturity band.
 *
 * Picks the LAST band whose `min_score` is at or below the score, so the lower bound of
 * every band is inclusive. Uses the unrounded score on purpose — rounding first causes
 * an off-by-one at every band edge (§3.3).
 */
export function resolveLevel(config: AppConfig, overallScore: number): MaturityLevel {
  const bands = config.maturity_levels;
  let selected = bands[0];
  for (const band of bands) {
    if (overallScore >= band.min_score) selected = band;
  }
  return {
    value: selected.value,
    name: selected.name,
    subtitle: selected.subtitle,
    headline: selected.headline,
    description: selected.description,
    characteristics: [...selected.characteristics],
    colour: selected.colour,
  };
}

/** True when every configured factor has a valid answer. */
export function isComplete(config: AppConfig, answers: Partial<Answers>): boolean {
  const { min_answer: minAnswer, max_answer: maxAnswer } = config.scoring;
  return config.factors.every((factor) => {
    const answer = answers[factor.id];
    return answer !== undefined && isAnswerValue(answer, minAnswer, maxAnswer);
  });
}

/** The factor ids that still need an answer, in configuration order. */
export function missingFactorIds(config: AppConfig, answers: Partial<Answers>): string[] {
  const { min_answer: minAnswer, max_answer: maxAnswer } = config.scoring;
  return config.factors
    .filter((factor) => {
      const answer = answers[factor.id];
      return answer === undefined || !isAnswerValue(answer, minAnswer, maxAnswer);
    })
    .map((factor) => factor.id);
}
