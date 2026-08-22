import type { AnswerValue, Submission } from '@/types/domain';

/** One row in the admin submissions table. Deliberately carries no respondent name. */
export interface SubmissionListItem {
  id: string;
  submittedAt: string;
  configVersion: string;
  designation: string;
  overallScore: number;
  levelValue: number;
  levelName: string;
  /** Shown as a column on the dashboard; comes from the respondent record. */
  experienceDigitalisationYears: number | null;
}

export interface ListOptions {
  limit: number;
  offset: number;
}

export interface ListResult {
  items: SubmissionListItem[];
  total: number;
}

export interface StoreSummary {
  total: number;
  last7Days: number;
  last30Days: number;
  meanOverallScore: number | null;
  levelDistribution: Record<AnswerValue, number>;
  /** Mean answer per factor id. */
  meanByFactor: Record<string, number>;
}

/**
 * Everything the app does with stored submissions.
 *
 * The read methods are called only from `src/app/api/admin/*` and `src/app/admin/*`.
 * No public route and no client component may import them — see
 * tests/access-control.test.ts, which enforces that.
 */
export interface SubmissionStore {
  save(submission: Submission): Promise<{ id: string }>;
  list(options: ListOptions): Promise<ListResult>;
  /** Resolves to null for an unknown id. "Not found" is a normal 404 path, not an error. */
  get(id: string): Promise<Submission | null>;
  /** The export path. Must stream — memory stays flat regardless of row count (NFR-7). */
  all(): AsyncIterable<Submission>;
  summary(): Promise<StoreSummary>;
}

export const EMPTY_LEVEL_DISTRIBUTION: Record<AnswerValue, number> = {
  1: 0,
  2: 0,
  3: 0,
  4: 0,
  5: 0,
};

/** Shared projection so both adapters produce identical list rows from a document. */
export function toListItem(submission: Submission): SubmissionListItem {
  const years = submission.respondent?.experienceDigitalisationYears;
  return {
    id: submission.id,
    submittedAt: submission.submittedAt,
    configVersion: submission.configVersion,
    designation: String(submission.respondent?.designation ?? ''),
    overallScore: submission.result.overallScore,
    levelValue: submission.result.level.value,
    levelName: submission.result.level.name,
    experienceDigitalisationYears: typeof years === 'number' ? years : null,
  };
}

/**
 * Newest first, breaking ties on id descending.
 *
 * The same ordering as the Postgres index on (submitted_at desc, id desc), so both
 * adapters paginate identically.
 */
export function compareNewestFirst(a: Submission, b: Submission): number {
  if (a.submittedAt !== b.submittedAt) return a.submittedAt < b.submittedAt ? 1 : -1;
  if (a.id === b.id) return 0;
  return a.id < b.id ? 1 : -1;
}
