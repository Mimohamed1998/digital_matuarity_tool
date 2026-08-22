import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createFsStore } from '@/lib/storage/fs';
import type { SubmissionStore } from '@/lib/storage/types';
import type { AnswerValue, Submission } from '@/types/domain';

const FACTOR_IDS = [
  'leadership',
  'strategy_governance',
  'people_culture',
  'technology',
  'research',
  'design',
  'development',
];

const SEED_COUNT = 250;

function makeSubmission(index: number): Submission {
  // Spread the timestamps a minute apart so ordering is unambiguous.
  const submittedAt = new Date(Date.UTC(2026, 7, 22, 0, 0, 0) + index * 60_000).toISOString();
  const answer = ((index % 5) + 1) as AnswerValue;
  return {
    id: `sub_${submittedAt.replace(/[:.]/g, '-')}_${String(index).padStart(4, '0')}`,
    submittedAt,
    configVersion: '1.0.0',
    respondent: {
      name: `Respondent ${index}`,
      designation: `Designation ${index}`,
      experienceTechnicalYears: index % 30,
      experienceManagerialYears: index % 20,
      experienceDigitalisationYears: index % 10,
      highestQualification: 'masters',
    },
    answers: Object.fromEntries(FACTOR_IDS.map((id) => [id, answer])),
    result: {
      overallScore: answer,
      tierScores: { organisational_enablers: answer, core_operations: answer },
      level: { value: answer, name: `Level ${answer}` },
    },
    meta: { userAgent: 'vitest', durationMs: 1000 * index },
  };
}

describe('filesystem store', () => {
  let directory: string;
  let store: SubmissionStore;

  beforeAll(async () => {
    directory = await mkdtemp(path.join(tmpdir(), 'dm-store-'));
    store = createFsStore(directory);
    for (let index = 0; index < SEED_COUNT; index += 1) {
      await store.save(makeSubmission(index));
    }
  });

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('streams every seeded submission exactly once', async () => {
    const seen: string[] = [];
    for await (const submission of store.all()) {
      seen.push(submission.id);
    }
    expect(seen).toHaveLength(SEED_COUNT);
    expect(new Set(seen).size).toBe(SEED_COUNT);
  });

  it('streams newest first, with no gaps at the batch boundary', async () => {
    const timestamps: string[] = [];
    for await (const submission of store.all()) {
      timestamps.push(submission.submittedAt);
    }
    const sortedDescending = [...timestamps].sort().reverse();
    expect(timestamps).toEqual(sortedDescending);
  });

  it('exposes all() as an async generator, not a materialised array', () => {
    const iterable = store.all();
    expect(typeof (iterable as AsyncGenerator<Submission>)[Symbol.asyncIterator]).toBe('function');
    expect(Array.isArray(iterable)).toBe(false);
  });

  it('reports the full total alongside a single page', async () => {
    const page = await store.list({ limit: 20, offset: 0 });
    expect(page.total).toBe(SEED_COUNT);
    expect(page.items).toHaveLength(20);
  });

  it('paginates without repeating a row', async () => {
    const first = await store.list({ limit: 25, offset: 0 });
    const second = await store.list({ limit: 25, offset: 25 });
    const ids = new Set([...first.items, ...second.items].map((item) => item.id));
    expect(ids.size).toBe(50);
  });

  it('returns the newest submission first', async () => {
    const page = await store.list({ limit: 1, offset: 0 });
    expect(page.items[0].id).toBe(makeSubmission(SEED_COUNT - 1).id);
  });

  it('omits the respondent name from list rows', async () => {
    const page = await store.list({ limit: 5, offset: 0 });
    for (const item of page.items) {
      expect(Object.keys(item)).not.toContain('name');
      expect(JSON.stringify(item)).not.toContain('Respondent');
    }
  });

  it('resolves get() to null for an unknown id rather than throwing', async () => {
    await expect(store.get('does-not-exist')).resolves.toBeNull();
  });

  it('refuses a path-traversal id', async () => {
    await expect(store.get('../../conf')).resolves.toBeNull();
  });

  it('returns the stored document for a known id', async () => {
    const expected = makeSubmission(7);
    const found = await store.get(expected.id);
    expect(found?.id).toBe(expected.id);
    expect(found?.respondent.designation).toBe('Designation 7');
  });

  it('aggregates a summary over every submission', async () => {
    const summary = await store.summary();
    expect(summary.total).toBe(SEED_COUNT);

    // Seeded answers cycle 1..5, so each level gets an equal share of 250.
    expect(summary.levelDistribution).toEqual({ 1: 50, 2: 50, 3: 50, 4: 50, 5: 50 });
    expect(summary.meanOverallScore).toBeCloseTo(3, 6);

    for (const factorId of FACTOR_IDS) {
      expect(summary.meanByFactor[factorId]).toBeCloseTo(3, 6);
    }
  });
});

describe('filesystem store — empty directory', () => {
  it('treats a store that has never been written to as empty, not broken', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'dm-store-empty-'));
    await rm(directory, { recursive: true, force: true });
    const store = createFsStore(directory);

    await expect(store.list({ limit: 10, offset: 0 })).resolves.toEqual({ items: [], total: 0 });
    await expect(store.get('anything')).resolves.toBeNull();

    const summary = await store.summary();
    expect(summary.total).toBe(0);
    expect(summary.meanOverallScore).toBeNull();

    const seen: Submission[] = [];
    for await (const submission of store.all()) seen.push(submission);
    expect(seen).toEqual([]);
  });
});
