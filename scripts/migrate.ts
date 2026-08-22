/**
 * Creates the submissions table and its index. Idempotent — safe to run on every deploy.
 *
 * Usage: DATABASE_URL=… npm run db:migrate
 */
import { neon } from '@neondatabase/serverless';

async function migrate(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Point it at your Neon database and run again.');
  }

  const sql = neon(connectionString);

  await sql`
    create table if not exists submissions (
      id             text         primary key,
      submitted_at   timestamptz  not null default now(),
      config_version text         not null,
      overall_score  numeric(6,4) not null,
      level_value    smallint     not null,
      payload        jsonb        not null
    )
  `;

  await sql`
    create index if not exists submissions_submitted_at_idx
      on submissions (submitted_at desc, id desc)
  `;

  console.log('Migration complete: submissions table and index are in place.');
}

migrate().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
