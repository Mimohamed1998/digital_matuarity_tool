import { neon } from '@neondatabase/serverless';
import type { Submission } from '@/types/domain';
import type { SubmissionStore } from './types';

/**
 * Neon Postgres store — one row per submission, the whole §6.1 document in `payload`.
 *
 * The four scalar columns are denormalised copies of fields inside `payload`, present
 * only so the admin dashboard can sort, paginate and aggregate without deserialising
 * every row. `payload` stays the source of truth.
 */
export function createPostgresStore(connectionString: string): SubmissionStore {
  const sql = neon(connectionString);

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
  };
}
