import type { Submission } from '@/types/domain';

/**
 * The write path. T-029 extends this interface with the admin read methods.
 *
 * Everything the app does with storage goes through this interface, so swapping the
 * backing store is a one-line change in `index.ts`.
 */
export interface SubmissionStore {
  save(submission: Submission): Promise<{ id: string }>;
}
