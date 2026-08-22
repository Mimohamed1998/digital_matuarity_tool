/**
 * Domain types for the digital maturity assessment.
 *
 * Structural only — no runtime code, no React, no Next. See docs/plan.md §6.
 */

/** A single answer on the 1-5 scale. Deliberately a literal union, not `number`. */
export type AnswerValue = 1 | 2 | 3 | 4 | 5;

/** Answers keyed by factor id, as declared in conf.yaml. */
export type Answers = Record<string, AnswerValue>;

export interface FactorScore {
  factorId: string;
  factorName: string;
  tierId: string;
  answer: AnswerValue;
  factorWeight: number;
  tierWeight: number;
  /** tierWeight × factorWeight × answer — this factor's share of the overall score. */
  contribution: number;
  /** tierWeight × factorWeight × (5 − answer) — how much is left on the table here. */
  impact: number;
}

export interface TierScore {
  tierId: string;
  tierName: string;
  weight: number;
  score: number;
}

export interface MaturityLevel {
  value: AnswerValue;
  name: string;
  subtitle: string;
  headline: string;
  description: string;
  characteristics: string[];
  colour: string;
}

export interface ScoreResult {
  overallScore: number;
  tierScores: TierScore[];
  factorScores: FactorScore[];
  level: MaturityLevel;
}

export interface Recommendation {
  factorId: string;
  factorName: string;
  tierName: string;
  currentAnswer: AnswerValue;
  impact: number;
  text: string;
}

/**
 * The respondent's background information (FR-11).
 *
 * Field ids are driven by `respondent_fields` in conf.yaml, so the shape is an index
 * signature; the named members below are the ones the current config declares and the
 * ones the storage and export layers rely on.
 */
export interface RespondentInfo {
  name?: string;
  designation: string;
  experienceTechnicalYears: number;
  experienceManagerialYears: number;
  experienceDigitalisationYears: number;
  highestQualification: string;
  [field: string]: string | number | undefined;
}

/** The score fields persisted with a submission — see docs/plan.md §6.1. */
export interface StoredResult {
  overallScore: number;
  /** Keyed by tier id. */
  tierScores: Record<string, number>;
  level: { value: AnswerValue; name: string };
}

export interface SubmissionMeta {
  userAgent: string;
  durationMs: number;
}

/** The document written to storage. Never contains an IP address. */
export interface Submission {
  id: string;
  submittedAt: string;
  configVersion: string;
  respondent: RespondentInfo;
  answers: Answers;
  result: StoredResult;
  meta: SubmissionMeta;
}
