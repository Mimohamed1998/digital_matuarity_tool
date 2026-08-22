import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AnswerValue, Submission } from '@/types/domain';
import {
  EMPTY_LEVEL_DISTRIBUTION,
  compareNewestFirst,
  toListItem,
  type ListOptions,
  type ListResult,
  type StoreSummary,
  type SubmissionStore,
} from './types';

/**
 * Local development store: one JSON file per submission under `data/submissions/`.
 *
 * Not for production — a serverless filesystem is ephemeral, so anything written here on
 * Vercel disappears with the instance. `getStore()` only reaches for this when there is
 * no DATABASE_URL.
 */
export const SUBMISSIONS_DIR = path.join(process.cwd(), 'data', 'submissions');

/** How many files `all()` reads at once. Mirrors the Postgres batch size. */
const BATCH_SIZE = 500;

export function createFsStore(directory: string = SUBMISSIONS_DIR): SubmissionStore {
  async function listIds(): Promise<string[]> {
    let entries: string[];
    try {
      entries = await readdir(directory);
    } catch (error) {
      // A store that has never been written to is empty, not broken.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
    return entries
      .filter((entry) => entry.endsWith('.json'))
      .map((entry) => entry.slice(0, -'.json'.length))
      // Ids embed an ISO timestamp, so a descending id sort is already newest-first.
      // Documents are re-sorted properly once read; this only fixes the read order.
      .sort((a, b) => (a === b ? 0 : a < b ? 1 : -1));
  }

  async function readOne(id: string): Promise<Submission | null> {
    try {
      const raw = await readFile(path.join(directory, `${id}.json`), 'utf8');
      return JSON.parse(raw) as Submission;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
  }

  async function readBatch(ids: string[]): Promise<Submission[]> {
    const documents = await Promise.all(ids.map(readOne));
    return documents.filter((doc): doc is Submission => doc !== null).sort(compareNewestFirst);
  }

  async function* streamAll(): AsyncGenerator<Submission> {
    const ids = await listIds();
    // Reads BATCH_SIZE documents at a time and yields them, so memory stays flat
    // whether there are 10 submissions or 10,000.
    for (let offset = 0; offset < ids.length; offset += BATCH_SIZE) {
      const batch = await readBatch(ids.slice(offset, offset + BATCH_SIZE));
      for (const submission of batch) yield submission;
    }
  }

  return {
    async save(submission: Submission) {
      await mkdir(directory, { recursive: true });
      const file = path.join(directory, `${submission.id}.json`);
      await writeFile(file, `${JSON.stringify(submission, null, 2)}\n`, 'utf8');
      return { id: submission.id };
    },

    async list({ limit, offset }: ListOptions): Promise<ListResult> {
      const ids = await listIds();
      const page = await readBatch(ids.slice(offset, offset + limit));
      return { items: page.map(toListItem), total: ids.length };
    },

    async get(id: string) {
      // Guard against a crafted id escaping the directory, e.g. "../../conf".
      if (id.includes('/') || id.includes('\\') || id.includes('..')) return null;
      return readOne(id);
    },

    all(): AsyncIterable<Submission> {
      return streamAll();
    },

    async summary(): Promise<StoreSummary> {
      const now = Date.now();
      const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
      const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

      let total = 0;
      let last7Days = 0;
      let last30Days = 0;
      let scoreTotal = 0;
      const levelDistribution: Record<AnswerValue, number> = { ...EMPTY_LEVEL_DISTRIBUTION };
      const factorTotals = new Map<string, { sum: number; count: number }>();

      // Consumes the same stream as the export path, so this stays O(1) in memory too.
      for await (const submission of streamAll()) {
        total += 1;
        scoreTotal += submission.result.overallScore;

        const submittedAt = new Date(submission.submittedAt).getTime();
        if (submittedAt >= sevenDaysAgo) last7Days += 1;
        if (submittedAt >= thirtyDaysAgo) last30Days += 1;

        const level = submission.result.level.value;
        if (level in levelDistribution) levelDistribution[level] += 1;

        for (const [factorId, answer] of Object.entries(submission.answers)) {
          const running = factorTotals.get(factorId) ?? { sum: 0, count: 0 };
          running.sum += answer;
          running.count += 1;
          factorTotals.set(factorId, running);
        }
      }

      return {
        total,
        last7Days,
        last30Days,
        meanOverallScore: total > 0 ? scoreTotal / total : null,
        levelDistribution,
        meanByFactor: Object.fromEntries(
          [...factorTotals].map(([factorId, { sum, count }]) => [factorId, sum / count]),
        ),
      };
    },
  };
}
