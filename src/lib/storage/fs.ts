import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Submission } from '@/types/domain';
import type { SubmissionStore } from './types';

/**
 * Local development store: one JSON file per submission under `data/submissions/`.
 *
 * Not for production — a serverless filesystem is ephemeral, so anything written here on
 * Vercel disappears with the instance. `getStore()` only reaches for this when there is
 * no DATABASE_URL.
 */
export const SUBMISSIONS_DIR = path.join(process.cwd(), 'data', 'submissions');

export function createFsStore(directory: string = SUBMISSIONS_DIR): SubmissionStore {
  return {
    async save(submission: Submission) {
      await mkdir(directory, { recursive: true });
      const file = path.join(directory, `${submission.id}.json`);
      await writeFile(file, `${JSON.stringify(submission, null, 2)}\n`, 'utf8');
      return { id: submission.id };
    },
  };
}
