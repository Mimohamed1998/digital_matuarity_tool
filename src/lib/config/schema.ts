import { z } from 'zod';

/**
 * Zod schema mirroring `conf.yaml`.
 *
 * The per-field types are the easy half. The value of this file is the cross-field
 * refinements below: a config whose weights do not sum to 1, or whose maturity bands
 * leave a gap, parses as perfectly good YAML but produces silently wrong scores.
 * Those failures must stop the build, not surface as a wrong number in a dissertation.
 */

const WEIGHT_TOLERANCE = 1e-9;

/** Answer scale keys 1..5, written as YAML integer keys but read back as strings by js-yaml. */
const scaleKeys = ['1', '2', '3', '4', '5'] as const;

const scaleRecord = z
  .record(z.coerce.string(), z.string().min(1))
  .refine(
    (r) => scaleKeys.every((k) => typeof r[k] === 'string' && r[k].length > 0),
    { message: 'must contain a non-empty entry for each of the keys 1, 2, 3, 4 and 5' },
  );

const metaSchema = z.object({
  version: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  intro: z.string().min(1),
  instructions: z.string().min(1),
  estimated_minutes: z.number().int().positive(),
});

const scoringSchema = z.object({
  formula: z.literal('weighted_sum'),
  min_answer: z.number().int(),
  max_answer: z.number().int(),
  decimals: z.number().int().min(0).max(6),
});

const respondentOptionSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
});

const respondentFieldSchema = z
  .object({
    id: z.string().min(1),
    label: z.string().min(1),
    type: z.enum(['text', 'number', 'select']),
    required: z.boolean(),
    help: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    options: z.array(respondentOptionSchema).min(1).optional(),
  })
  .refine((f) => f.type !== 'select' || (f.options?.length ?? 0) > 0, {
    message: 'a field of type "select" must define at least one option',
    path: ['options'],
  })
  .refine((f) => f.min === undefined || f.max === undefined || f.min <= f.max, {
    message: 'min must be less than or equal to max',
    path: ['min'],
  });

const tierSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  label: z.string().min(1),
  weight: z.number().min(0).max(1),
  description: z.string().min(1),
});

const factorSchema = z.object({
  id: z.string().min(1),
  tier: z.string().min(1),
  name: z.string().min(1),
  weight: z.number().min(0).max(1),
  question: z.string().min(1),
  statements: scaleRecord,
  recommendations: scaleRecord,
});

const maturityLevelSchema = z.object({
  value: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
  min_score: z.number(),
  name: z.string().min(1),
  subtitle: z.string().min(1),
  headline: z.string().min(1),
  colour: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a 6-digit hex colour, e.g. #2E7E8C'),
  description: z.string().min(1),
  characteristics: z.array(z.string().min(1)).min(1),
});

const baseConfigSchema = z.object({
  meta: metaSchema,
  scoring: scoringSchema,
  scale_labels: scaleRecord,
  respondent_fields: z.array(respondentFieldSchema).min(1),
  tiers: z.array(tierSchema).min(1),
  factors: z.array(factorSchema).min(1),
  maturity_levels: z.array(maturityLevelSchema).min(1),
});

type BaseConfig = z.infer<typeof baseConfigSchema>;

const sum = (values: number[]): number => values.reduce((total, v) => total + v, 0);

function checkWeights(config: BaseConfig, ctx: z.RefinementCtx): void {
  const tierWeightTotal = sum(config.tiers.map((t) => t.weight));
  if (Math.abs(tierWeightTotal - 1) > WEIGHT_TOLERANCE) {
    ctx.addIssue({
      code: 'custom',
      path: ['tiers'],
      message: `tier weights must sum to 1.0, got ${tierWeightTotal}`,
    });
  }

  config.tiers.forEach((tier, tierIndex) => {
    const factors = config.factors.filter((f) => f.tier === tier.id);
    if (factors.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['tiers', tierIndex],
        message: `tier "${tier.id}" has no factors`,
      });
      return;
    }
    const factorWeightTotal = sum(factors.map((f) => f.weight));
    if (Math.abs(factorWeightTotal - 1) > WEIGHT_TOLERANCE) {
      ctx.addIssue({
        code: 'custom',
        path: ['tiers', tierIndex],
        message: `factor weights within tier "${tier.id}" must sum to 1.0, got ${factorWeightTotal}`,
      });
    }
  });
}

function checkFactors(config: BaseConfig, ctx: z.RefinementCtx): void {
  const tierIds = new Set(config.tiers.map((t) => t.id));
  const seen = new Set<string>();

  config.factors.forEach((factor, index) => {
    if (!tierIds.has(factor.tier)) {
      ctx.addIssue({
        code: 'custom',
        path: ['factors', index, 'tier'],
        message: `factor "${factor.id}" refers to unknown tier "${factor.tier}"`,
      });
    }
    if (seen.has(factor.id)) {
      ctx.addIssue({
        code: 'custom',
        path: ['factors', index, 'id'],
        message: `duplicate factor id "${factor.id}"`,
      });
    }
    seen.add(factor.id);
  });
}

function checkMaturityLevels(config: BaseConfig, ctx: z.RefinementCtx): void {
  const levels = config.maturity_levels;

  if (levels[0].min_score !== config.scoring.min_answer) {
    ctx.addIssue({
      code: 'custom',
      path: ['maturity_levels', 0, 'min_score'],
      message: `the first maturity band must start at scoring.min_answer (${config.scoring.min_answer}), got ${levels[0].min_score}`,
    });
  }

  for (let i = 1; i < levels.length; i += 1) {
    if (levels[i].min_score <= levels[i - 1].min_score) {
      ctx.addIssue({
        code: 'custom',
        path: ['maturity_levels', i, 'min_score'],
        message: `maturity bands must ascend by min_score: ${levels[i].min_score} does not exceed the previous band's ${levels[i - 1].min_score}`,
      });
    }
    if (levels[i].value !== levels[i - 1].value + 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['maturity_levels', i, 'value'],
        message: `maturity band values must be consecutive: expected ${levels[i - 1].value + 1}, got ${levels[i].value}`,
      });
    }
  }

  const last = levels[levels.length - 1];
  if (last.min_score > config.scoring.max_answer) {
    ctx.addIssue({
      code: 'custom',
      path: ['maturity_levels', levels.length - 1, 'min_score'],
      message: `the last maturity band starts above scoring.max_answer (${config.scoring.max_answer}), so it can never be reached`,
    });
  }
}

function checkScoring(config: BaseConfig, ctx: z.RefinementCtx): void {
  if (config.scoring.min_answer >= config.scoring.max_answer) {
    ctx.addIssue({
      code: 'custom',
      path: ['scoring', 'max_answer'],
      message: `scoring.max_answer (${config.scoring.max_answer}) must exceed scoring.min_answer (${config.scoring.min_answer})`,
    });
  }
}

export const configSchema = baseConfigSchema.superRefine((config, ctx) => {
  checkScoring(config, ctx);
  checkWeights(config, ctx);
  checkFactors(config, ctx);
  checkMaturityLevels(config, ctx);
});

export type AppConfig = z.infer<typeof configSchema>;
export type TierConfig = AppConfig['tiers'][number];
export type FactorConfig = AppConfig['factors'][number];
export type MaturityLevelConfig = AppConfig['maturity_levels'][number];
export type RespondentFieldConfig = AppConfig['respondent_fields'][number];
