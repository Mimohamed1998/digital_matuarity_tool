import type { Submission } from '@/types/domain';
import { createFsStore } from './fs';
import { createPostgresStore } from './postgres';
import { EMPTY_LEVEL_DISTRIBUTION, type StoreSummary, type SubmissionStore } from './types';

export type {
  ListOptions,
  ListResult,
  StoreSummary,
  SubmissionListItem,
  SubmissionStore,
} from './types';

/**
 * Last-resort store used when nothing else is configured.
 *
 * It logs and resolves rather than throwing, because a storage outage must never cost a
 * respondent their result (OD-5). The id is still returned so the caller's contract holds.
 */
function createNoopStore(reason: string): SubmissionStore {
  const emptySummary: StoreSummary = {
    total: 0,
    last7Days: 0,
    last30Days: 0,
    meanOverallScore: null,
    levelDistribution: { ...EMPTY_LEVEL_DISTRIBUTION },
    meanByFactor: {},
  };

  return {
    async save(submission: Submission) {
      // Deliberately logs the id only. The submission body is personal data and never
      // belongs in a log line.
      console.warn(`[storage] not persisting submission ${submission.id}: ${reason}`);
      return { id: submission.id };
    },
    async list() {
      return { items: [], total: 0 };
    },
    async get() {
      return null;
    },
    /** An async generator is the interface contract; this one simply yields nothing. */
    async *all() {},
    async summary() {
      return emptySummary;
    },
  };
}

let store: SubmissionStore | null = null;

/**
 * Pick a store: Postgres when DATABASE_URL is set, the local filesystem otherwise, and a
 * logging no-op if neither can be constructed.
 */
export function getStore(): SubmissionStore {
  if (store) return store;

  const connectionString = process.env.DATABASE_URL;
  if (connectionString) {
    try {
      store = createPostgresStore(connectionString);
      return store;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      store = createNoopStore(`Postgres store unavailable (${detail})`);
      return store;
    }
  }

  if (process.env.NODE_ENV === 'production') {
    // A production deployment with no database is a misconfiguration. Say so loudly in
    // the logs, but still accept the submission rather than failing the respondent.
    store = createNoopStore('DATABASE_URL is not set in production');
    return store;
  }

  store = createFsStore();
  return store;
}

/** Test seam: forget the selected store so the next getStore() re-reads the environment. */
export function resetStoreForTesting(): void {
  store = null;
}
