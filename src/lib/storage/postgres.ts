import { neon } from '@neondatabase/serverless';
import type { AnswerValue, Submission } from '@/types/domain';
import {
  EMPTY_LEVEL_DISTRIBUTION,
  toListItem,
  type ListOptions,
  type ListResult,
  type StoreSummary,
  type SubmissionStore,
} from './types';

/**
 * Neon Postgres store — one row per submission, the whole §6.1 document in `payload`.
 *
 * The four scalar columns are denormalised copies of fields inside `payload`, present
 * only so the admin dashboard can sort, paginate and aggregate without deserialising
 * every row. `payload` stays the source of truth; if the two ever disagree, `payload`
 * wins, which is why every read here returns `payload` rather than the columns.
 */

/** Rows per keyset page in `all()`. Small enough to stay flat in memory, large enough to be few round trips. */
const EXPORT_BATCH_SIZE = 500;

interface PayloadRow {
  payload: Submission;
}

export function createPostgresStore(connectionString: string): SubmissionStore {
  const sql = neon(connectionString);

  async function* streamAll(): AsyncGenerator<Submission> {
    let cursor: { submittedAt: string; id: string } | null = null;

    for (;;) {
      // Keyset pagination, not OFFSET: an OFFSET walk would skip or duplicate rows if a
      // submission arrives partway through an export.
      const rows = (cursor
        ? await sql`
            select payload from submissions
            where (submitted_at, id) < (${cursor.submittedAt}::timestamptz, ${cursor.id})
            order by submitted_at desc, id desc
            limit ${EXPORT_BATCH_SIZE}
          `
        : await sql`
            select payload from submissions
            order by submitted_at desc, id desc
            limit ${EXPORT_BATCH_SIZE}
          `) as PayloadRow[];

      if (rows.length === 0) return;

      for (const row of rows) yield row.payload;

      const lastRow = rows[rows.length - 1];
      cursor = { submittedAt: lastRow.payload.submittedAt, id: lastRow.payload.id };

      if (rows.length < EXPORT_BATCH_SIZE) return;
    }
  }

  return {
    async save(submission: Submission) {
      await sql`
        insert into submissions (id, submitted_at, config_version, overall_score, level_value, payload)
        values (
          ${submission.id},
          ${submission.submittedAt},
          ${submission.configVersion},
          ${submission.result.overallScore},
          ${submission.result.level.value},
          ${JSON.stringify(submission)}::jsonb
        )
        on conflict (id) do nothing
      `;
      return { id: submission.id };
    },

    async list({ limit, offset }: ListOptions): Promise<ListResult> {
      const [rows, counts] = await Promise.all([
        sql`
          select payload from submissions
          order by submitted_at desc, id desc
          limit ${limit} offset ${offset}
        ` as unknown as Promise<PayloadRow[]>,
        sql`select count(*)::int as total from submissions` as unknown as Promise<{ total: number }[]>,
      ]);

      return {
        items: rows.map((row) => toListItem(row.payload)),
        total: counts[0]?.total ?? 0,
      };
    },

    async get(id: string) {
      const rows = (await sql`
        select payload from submissions where id = ${id} limit 1
      `) as PayloadRow[];
      return rows[0]?.payload ?? null;
    },

    all(): AsyncIterable<Submission> {
      return streamAll();
    },

    async summary(): Promise<StoreSummary> {
      // All three aggregates are computed in the database. Pulling rows into Node to
      // average them would defeat the point of having the scalar columns at all.
      const [totals, levels, factors] = await Promise.all([
        sql`
          select
            count(*)::int as total,
            count(*) filter (where submitted_at >= now() - interval '7 days')::int  as last_7_days,
            count(*) filter (where submitted_at >= now() - interval '30 days')::int as last_30_days,
            avg(overall_score)::float8 as mean_overall_score
          from submissions
        ` as unknown as Promise<
          {
            total: number;
            last_7_days: number;
            last_30_days: number;
            mean_overall_score: number | null;
          }[]
        >,
        sql`
          select level_value::int as level_value, count(*)::int as count
          from submissions
          group by level_value
        ` as unknown as Promise<{ level_value: number; count: number }[]>,
        // jsonb_each unpivots the answers object, so this works for any set of factor
        // ids without the query naming a single one of them.
        sql`
          select answer.key as factor_id, avg((answer.value #>> '{}')::numeric)::float8 as mean
          from submissions, jsonb_each(payload -> 'answers') as answer
          group by answer.key
        ` as unknown as Promise<{ factor_id: string; mean: number }[]>,
      ]);

      const levelDistribution: Record<AnswerValue, number> = { ...EMPTY_LEVEL_DISTRIBUTION };
      for (const row of levels) {
        if (row.level_value in levelDistribution) {
          levelDistribution[row.level_value as AnswerValue] = row.count;
        }
      }

      const row = totals[0];
      return {
        total: row?.total ?? 0,
        last7Days: row?.last_7_days ?? 0,
        last30Days: row?.last_30_days ?? 0,
        meanOverallScore: row?.mean_overall_score ?? null,
        levelDistribution,
        meanByFactor: Object.fromEntries(factors.map((f) => [f.factor_id, f.mean])),
      };
    },
  };
}
