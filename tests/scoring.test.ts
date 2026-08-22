import { describe, expect, it } from 'vitest';
import { loadConfig, loadConfigFromString } from '@/lib/config/load';
import { computeScore, isComplete, missingFactorIds, resolveLevel } from '@/lib/scoring';
import { formatScore } from '@/lib/format';
import type { Answers, AnswerValue } from '@/types/domain';

const config = loadConfig();

const FACTOR_IDS = [
  'leadership',
  'strategy_governance',
  'people_culture',
  'technology',
  'research',
  'design',
  'development',
] as const;

function uniform(answer: AnswerValue): Answers {
  return Object.fromEntries(FACTOR_IDS.map((id) => [id, answer])) as Answers;
}

/** The mixed worked example from docs/plan.md §3.6. */
const MIXED: Answers = {
  leadership: 5,
  strategy_governance: 4,
  people_culture: 3,
  technology: 2,
  research: 4,
  design: 2,
  development: 3,
};

describe('computeScore — worked examples (docs/plan.md §3.6)', () => {
  it('scores all-3s as exactly 3.00 at Level 3 "Developing"', () => {
    const result = computeScore(config, uniform(3));
    expect(result.overallScore).toBeCloseTo(3, 6);
    expect(result.tierScores.map((t) => t.score)).toEqual([
      expect.closeTo(3, 6),
      expect.closeTo(3, 6),
    ]);
    expect(result.level.value).toBe(3);
    expect(result.level.name).toBe('Developing');
  });

  it('scores the mixed example as tier1 4.073, tier2 3.17, overall 3.8021 at Level 4', () => {
    const result = computeScore(config, MIXED);
    const tier1 = result.tierScores.find((t) => t.tierId === 'organisational_enablers');
    const tier2 = result.tierScores.find((t) => t.tierId === 'core_operations');
    expect(tier1?.score).toBeCloseTo(4.073, 6);
    expect(tier2?.score).toBeCloseTo(3.17, 6);
    expect(result.overallScore).toBeCloseTo(3.8021, 6);
    expect(result.level.value).toBe(4);
    expect(result.level.name).toBe('Established');
  });

  it('scores all-1s as 1.00 at Level 1 and all-5s as 5.00 at Level 5', () => {
    const low = computeScore(config, uniform(1));
    expect(low.overallScore).toBeCloseTo(1, 6);
    expect(low.level.value).toBe(1);
    expect(low.level.name).toBe('Initial');

    const high = computeScore(config, uniform(5));
    expect(high.overallScore).toBeCloseTo(5, 6);
    expect(high.level.value).toBe(5);
    expect(high.level.name).toBe('Optimised');
  });
});

describe('computeScore — factor detail', () => {
  it('returns a contribution and an impact per factor, summing to the overall score', () => {
    const result = computeScore(config, MIXED);
    const summed = result.factorScores.reduce((total, f) => total + f.contribution, 0);
    expect(summed).toBeCloseTo(result.overallScore, 9);
  });

  it('computes impact as tierWeight × factorWeight × (5 − answer)', () => {
    const result = computeScore(config, MIXED);
    const leadership = result.factorScores.find((f) => f.factorId === 'leadership');
    const technology = result.factorScores.find((f) => f.factorId === 'technology');
    expect(leadership?.impact).toBeCloseTo(0, 9); // answered 5 — nothing left on the table
    expect(technology?.impact).toBeCloseTo(0.7 * 0.06 * 3, 9);
  });

  it('carries the tier id and weight through to every factor score', () => {
    const result = computeScore(config, MIXED);
    const design = result.factorScores.find((f) => f.factorId === 'design');
    expect(design?.tierId).toBe('core_operations');
    expect(design?.tierWeight).toBe(0.3);
    expect(design?.factorWeight).toBe(0.23);
  });
});

describe('resolveLevel — band boundaries (docs/plan.md §3.4)', () => {
  it('treats the lower bound of each band as inclusive', () => {
    expect(resolveLevel(config, 3.4).value).toBe(4);
    expect(resolveLevel(config, 2.6).value).toBe(3);
    expect(resolveLevel(config, 1.8).value).toBe(2);
    expect(resolveLevel(config, 4.2).value).toBe(5);
  });

  it('keeps the value just below a threshold in the lower band', () => {
    expect(resolveLevel(config, 4.19999).value).toBe(4);
    expect(resolveLevel(config, 3.39999).value).toBe(3);
    expect(resolveLevel(config, 1.79999).value).toBe(1);
  });

  it('bands the extremes', () => {
    expect(resolveLevel(config, 1).value).toBe(1);
    expect(resolveLevel(config, 5).value).toBe(5);
  });

  it('bands on the unrounded score, so 3.399 is Level 3 even though it displays as 3.40', () => {
    expect(formatScore(3.399)).toBe('3.40');
    expect(resolveLevel(config, 3.399).value).toBe(3);
  });
});

describe('computeScore — invalid input', () => {
  it('throws when an answer is missing', () => {
    const answers = { ...MIXED };
    delete (answers as Record<string, unknown>).design;
    expect(() => computeScore(config, answers)).toThrow(/Missing answer for factor "design"/);
  });

  it('throws when an answer is 0', () => {
    expect(() => computeScore(config, { ...MIXED, design: 0 as AnswerValue })).toThrow(
      /must be an integer between 1 and 5, got 0/,
    );
  });

  it('throws when an answer is 6', () => {
    expect(() => computeScore(config, { ...MIXED, design: 6 as AnswerValue })).toThrow(
      /must be an integer between 1 and 5, got 6/,
    );
  });

  it('throws when an answer is not an integer', () => {
    expect(() => computeScore(config, { ...MIXED, design: 3.5 as AnswerValue })).toThrow(
      /must be an integer between 1 and 5, got 3\.5/,
    );
  });
});

describe('isComplete / missingFactorIds', () => {
  it('is true only when every configured factor is answered', () => {
    expect(isComplete(config, MIXED)).toBe(true);
    const partial = { ...MIXED };
    delete (partial as Record<string, unknown>).research;
    expect(isComplete(config, partial)).toBe(false);
    expect(missingFactorIds(config, partial)).toEqual(['research']);
  });

  it('lists missing factors in configuration order', () => {
    expect(missingFactorIds(config, {})).toEqual([...FACTOR_IDS]);
  });
});

describe('config-agnostic behaviour (NFR-4)', () => {
  const THREE_TIER_CONFIG = `
meta:
  version: "9.9.9"
  title: "Fixture"
  subtitle: "Fixture"
  intro: "Fixture"
  instructions: "Fixture"
  estimated_minutes: 1
scoring:
  formula: weighted_sum
  min_answer: 1
  max_answer: 5
  decimals: 2
scale_labels: { 1: "One", 2: "Two", 3: "Three", 4: "Four", 5: "Five" }
respondent_fields:
  - { id: designation, label: "Designation", type: text, required: true }
tiers:
  - { id: a, name: "Alpha", label: "Tier 1", weight: 0.5, description: "d" }
  - { id: b, name: "Beta", label: "Tier 2", weight: 0.25, description: "d" }
  - { id: c, name: "Gamma", label: "Tier 3", weight: 0.25, description: "d" }
factors:
  - id: a1
    tier: a
    name: "A One"
    weight: 0.6
    question: "q"
    statements: { 1: "s", 2: "s", 3: "s", 4: "s", 5: "s" }
    recommendations: { 1: "r", 2: "r", 3: "r", 4: "r", 5: "r" }
  - id: a2
    tier: a
    name: "A Two"
    weight: 0.4
    question: "q"
    statements: { 1: "s", 2: "s", 3: "s", 4: "s", 5: "s" }
    recommendations: { 1: "r", 2: "r", 3: "r", 4: "r", 5: "r" }
  - id: b1
    tier: b
    name: "B One"
    weight: 1.0
    question: "q"
    statements: { 1: "s", 2: "s", 3: "s", 4: "s", 5: "s" }
    recommendations: { 1: "r", 2: "r", 3: "r", 4: "r", 5: "r" }
  - id: c1
    tier: c
    name: "C One"
    weight: 1.0
    question: "q"
    statements: { 1: "s", 2: "s", 3: "s", 4: "s", 5: "s" }
    recommendations: { 1: "r", 2: "r", 3: "r", 4: "r", 5: "r" }
maturity_levels:
  - { value: 1, min_score: 1.0, name: "L1", subtitle: "s", headline: "h", colour: "#111111", description: "d", characteristics: ["c"] }
  - { value: 2, min_score: 2.0, name: "L2", subtitle: "s", headline: "h", colour: "#222222", description: "d", characteristics: ["c"] }
  - { value: 3, min_score: 3.0, name: "L3", subtitle: "s", headline: "h", colour: "#333333", description: "d", characteristics: ["c"] }
  - { value: 4, min_score: 4.0, name: "L4", subtitle: "s", headline: "h", colour: "#444444", description: "d", characteristics: ["c"] }
  - { value: 5, min_score: 4.5, name: "L5", subtitle: "s", headline: "h", colour: "#555555", description: "d", characteristics: ["c"] }
`;

  const fixture = loadConfigFromString(THREE_TIER_CONFIG, 'fixture.yaml');

  it('scores a three-tier config the engine has never seen, still within [1, 5]', () => {
    const answers: Answers = { a1: 5, a2: 1, b1: 4, c1: 2 };
    const result = computeScore(fixture, answers);
    // tier a = 0.6(5) + 0.4(1) = 3.4 ; tier b = 4 ; tier c = 2
    // overall = 0.5(3.4) + 0.25(4) + 0.25(2) = 1.7 + 1.0 + 0.5 = 3.2
    expect(result.overallScore).toBeCloseTo(3.2, 9);
    expect(result.tierScores).toHaveLength(3);
    expect(result.factorScores).toHaveLength(4);
    expect(result.level.value).toBe(3);
  });

  it('stays in range for every uniform answer of an unfamiliar config', () => {
    for (const answer of [1, 2, 3, 4, 5] as AnswerValue[]) {
      const answers: Answers = { a1: answer, a2: answer, b1: answer, c1: answer };
      const result = computeScore(fixture, answers);
      expect(result.overallScore).toBeCloseTo(answer, 9);
      expect(result.overallScore).toBeGreaterThanOrEqual(1);
      expect(result.overallScore).toBeLessThanOrEqual(5);
    }
  });

  it('uses the fixture’s own band thresholds, not the real config’s', () => {
    expect(resolveLevel(fixture, 4.6).name).toBe('L5');
    expect(resolveLevel(fixture, 4.4).name).toBe('L4');
  });
});

describe('formatScore', () => {
  it('renders a fixed number of decimals', () => {
    expect(formatScore(3.8021)).toBe('3.80');
    expect(formatScore(3.8021, 4)).toBe('3.8021');
    expect(formatScore(3)).toBe('3.00');
  });
});
