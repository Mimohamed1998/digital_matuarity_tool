import { describe, expect, it } from 'vitest';
import { loadConfig, loadConfigFromString } from '@/lib/config/load';
import { buildRecommendations, computeScore } from '@/lib/scoring';
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

describe('buildRecommendations', () => {
  it('returns no improvements and seven strengths when everything is answered 5', () => {
    const result = computeScore(config, uniform(5));
    const { improvements, strengths } = buildRecommendations(config, result);
    expect(improvements).toEqual([]);
    expect(strengths).toHaveLength(7);
    expect(strengths.every((s) => s.currentAnswer === 5)).toBe(true);
  });

  it('ranks all-1s by impact, matching docs/plan.md §3.5 exactly', () => {
    const result = computeScore(config, uniform(1));
    const { improvements, strengths } = buildRecommendations(config, result);

    expect(strengths).toEqual([]);
    expect(improvements.map((r) => r.factorId)).toEqual([
      'leadership',
      'strategy_governance',
      'people_culture',
      'research',
      'development',
      'design',
      'technology',
    ]);

    const expectedImpacts = [1.0724, 1.0276, 0.532, 0.48, 0.444, 0.276, 0.168];
    improvements.forEach((recommendation, index) => {
      expect(recommendation.impact).toBeCloseTo(expectedImpacts[index], 9);
    });
  });

  it('takes its text verbatim from conf.yaml, never generating it', () => {
    const result = computeScore(config, uniform(2));
    const { improvements } = buildRecommendations(config, result);
    const leadership = improvements.find((r) => r.factorId === 'leadership');
    const fromConfig = config.factors.find((f) => f.id === 'leadership')?.recommendations['2'];
    expect(leadership?.text).toBe(fromConfig);
  });

  it('never lists a factor answered 5 among the improvements', () => {
    const answers: Answers = { ...uniform(2), leadership: 5, design: 5 };
    const result = computeScore(config, answers);
    const { improvements, strengths } = buildRecommendations(config, result);
    expect(improvements.map((r) => r.factorId)).not.toContain('leadership');
    expect(improvements.map((r) => r.factorId)).not.toContain('design');
    expect(strengths.map((r) => r.factorId)).toEqual(['leadership', 'design']);
  });

  it('carries the tier name and current answer through for display', () => {
    const result = computeScore(config, uniform(3));
    const { improvements } = buildRecommendations(config, result);
    const research = improvements.find((r) => r.factorId === 'research');
    expect(research?.tierName).toBe('Core Operations');
    expect(research?.currentAnswer).toBe(3);
    expect(research?.factorName).toBe('Research');
  });

  it('is deterministic — running the sort twice gives an identical order', () => {
    const result = computeScore(config, { ...uniform(3), technology: 1, design: 1 });
    const first = buildRecommendations(config, result).improvements.map((r) => r.factorId);
    const second = buildRecommendations(config, result).improvements.map((r) => r.factorId);
    expect(second).toEqual(first);
  });
});

describe('buildRecommendations — tie-breaking', () => {
  /** Four factors across two tiers whose effective weights are deliberately identical. */
  const TIED_CONFIG = `
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
  - { id: t1, name: "Tier One", label: "Tier 1", weight: 0.5, description: "d" }
  - { id: t2, name: "Tier Two", label: "Tier 2", weight: 0.5, description: "d" }
factors:
  - id: t1_first
    tier: t1
    name: "T1 First"
    weight: 0.5
    question: "q"
    statements: { 1: "s", 2: "s", 3: "s", 4: "s", 5: "s" }
    recommendations: { 1: "r1", 2: "r2", 3: "r3", 4: "r4", 5: "r5" }
  - id: t2_first
    tier: t2
    name: "T2 First"
    weight: 0.5
    question: "q"
    statements: { 1: "s", 2: "s", 3: "s", 4: "s", 5: "s" }
    recommendations: { 1: "r1", 2: "r2", 3: "r3", 4: "r4", 5: "r5" }
  - id: t1_second
    tier: t1
    name: "T1 Second"
    weight: 0.5
    question: "q"
    statements: { 1: "s", 2: "s", 3: "s", 4: "s", 5: "s" }
    recommendations: { 1: "r1", 2: "r2", 3: "r3", 4: "r4", 5: "r5" }
  - id: t2_second
    tier: t2
    name: "T2 Second"
    weight: 0.5
    question: "q"
    statements: { 1: "s", 2: "s", 3: "s", 4: "s", 5: "s" }
    recommendations: { 1: "r1", 2: "r2", 3: "r3", 4: "r4", 5: "r5" }
maturity_levels:
  - { value: 1, min_score: 1.0, name: "L1", subtitle: "s", headline: "h", colour: "#111111", description: "d", characteristics: ["c"] }
  - { value: 2, min_score: 2.0, name: "L2", subtitle: "s", headline: "h", colour: "#222222", description: "d", characteristics: ["c"] }
  - { value: 3, min_score: 3.0, name: "L3", subtitle: "s", headline: "h", colour: "#333333", description: "d", characteristics: ["c"] }
  - { value: 4, min_score: 4.0, name: "L4", subtitle: "s", headline: "h", colour: "#444444", description: "d", characteristics: ["c"] }
  - { value: 5, min_score: 4.5, name: "L5", subtitle: "s", headline: "h", colour: "#555555", description: "d", characteristics: ["c"] }
`;

  const fixture = loadConfigFromString(TIED_CONFIG, 'tied.yaml');

  it('breaks equal impacts by tier order, then by factor order in conf.yaml', () => {
    const answers: Answers = { t1_first: 2, t2_first: 2, t1_second: 2, t2_second: 2 };
    const result = computeScore(fixture, answers);
    const { improvements } = buildRecommendations(fixture, result);
    expect(improvements.map((r) => r.impact)).toEqual(improvements.map(() => 0.75));
    expect(improvements.map((r) => r.factorId)).toEqual([
      't1_first',
      't1_second',
      't2_first',
      't2_second',
    ]);
  });

  it('still sorts strictly by impact when impacts differ', () => {
    const answers: Answers = { t1_first: 4, t2_first: 1, t1_second: 3, t2_second: 2 };
    const result = computeScore(fixture, answers);
    const { improvements } = buildRecommendations(fixture, result);
    // effective weight is 0.25 for every factor here, so impact is 0.25 × (5 − answer)
    expect(improvements.map((r) => r.impact)).toEqual([1, 0.75, 0.5, 0.25]);
    expect(improvements.map((r) => r.factorId)).toEqual([
      't2_first',
      't2_second',
      't1_second',
      't1_first',
    ]);
  });
});
