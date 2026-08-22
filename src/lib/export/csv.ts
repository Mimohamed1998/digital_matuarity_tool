import type { AppConfig } from '@/lib/config/schema';
import type { Submission } from '@/types/domain';

/**
 * CSV generation for the researcher's export (FR-16).
 *
 * Two separate concerns are handled here, and they are not the same thing:
 *
 *  1. RFC 4180 quoting, so the file parses correctly.
 *  2. Formula-injection neutralisation, so the file is safe to OPEN. Respondents type
 *     free text into `name` and `designation`, and the researcher will open this in
 *     Excel. `=HYPERLINK("http://evil","click")` in a designation field is the one
 *     genuinely exploitable hole in an otherwise read-only feature.
 */

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_PREFIXES = new Set(['=', '+', '-', '@', '\t', '\r']);

/** Prefix a leading formula character with a single quote so the cell stays inert. */
export function neutraliseFormula(value: string): string {
  if (value.length === 0) return value;
  return FORMULA_PREFIXES.has(value[0]) ? `'${value}` : value;
}

/** Quote one field per RFC 4180, doubling any embedded quotes. */
export function escapeCsvValue(value: string): string {
  const safe = neutraliseFormula(value);
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

/** Join pre-escaped values into one CRLF-terminated row. */
export function toCsvRow(values: string[]): string {
  return `${values.map(escapeCsvValue).join(',')}\r\n`;
}

/**
 * Column order is derived from conf.yaml, so adding a factor adds exactly one column,
 * in the position the factor occupies in the configuration.
 */
export function buildHeader(config: AppConfig): string[] {
  return [
    'id',
    'submittedAt',
    'configVersion',
    ...config.respondent_fields.map((field) => field.id),
    ...config.factors.map((factor) => `answer_${factor.id}`),
    ...config.tiers.map((tier) => `tier_${tier.id}`),
    'overallScore',
    'levelValue',
    'levelName',
  ];
}

function cell(value: unknown): string {
  // A missing optional field is an empty cell, never the string "undefined".
  if (value === undefined || value === null) return '';
  return String(value);
}

export function submissionToFlatRow(config: AppConfig, submission: Submission): string[] {
  return [
    cell(submission.id),
    cell(submission.submittedAt),
    cell(submission.configVersion),
    ...config.respondent_fields.map((field) => cell(submission.respondent?.[field.id])),
    ...config.factors.map((factor) => cell(submission.answers?.[factor.id])),
    ...config.tiers.map((tier) => cell(submission.result?.tierScores?.[tier.id])),
    cell(submission.result?.overallScore),
    cell(submission.result?.level?.value),
    cell(submission.result?.level?.name),
  ];
}
