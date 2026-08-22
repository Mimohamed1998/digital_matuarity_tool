import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadConfig } from '@/lib/config/load';
import { computeScore } from '@/lib/scoring';
import { getStore } from '@/lib/storage';
import type { Answers, AnswerValue, RespondentInfo, Submission } from '@/types/domain';

// The filesystem adapter needs a real Node runtime, not Edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Bodies larger than this are rejected unread — a completed survey is well under 4KB. */
const MAX_BODY_BYTES = 32 * 1024;

const respondentSchema = z.record(
  z.string(),
  z.union([z.string().max(500), z.number(), z.undefined()]),
);

const bodySchema = z.object({
  respondent: respondentSchema,
  answers: z.record(z.string(), z.number().int()),
  durationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).optional(),
  // A client may send `result`; it is deliberately not in this schema and is ignored.
});

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** e.g. sub_2026-08-22T09-31-04-123Z_a1b2c3 */
function generateId(submittedAt: string): string {
  return `sub_${submittedAt.replace(/[:.]/g, '-')}_${randomSuffix()}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  const config = loadConfig();

  const declaredLength = Number(request.headers.get('content-length') ?? '0');
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'body too large' }, { status: 413 });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'body too large' }, { status: 413 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  const body = bodySchema.safeParse(parsed);
  if (!body.success) {
    return NextResponse.json(
      {
        error: 'invalid submission',
        issues: body.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  // Reject answers for factors that do not exist, rather than silently dropping them:
  // a mismatch means the client is out of step with the config and the data would be
  // misleading in the dataset.
  const knownFactorIds = new Set(config.factors.map((factor) => factor.id));
  const unknown = Object.keys(body.data.answers).filter((id) => !knownFactorIds.has(id));
  if (unknown.length > 0) {
    return NextResponse.json(
      { error: 'invalid submission', issues: [{ path: 'answers', message: `unknown factor ids: ${unknown.join(', ')}` }] },
      { status: 400 },
    );
  }

  // Recompute the score server-side. A client-supplied score is never trusted or stored.
  let result;
  try {
    result = computeScore(config, body.data.answers as Answers);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'could not score the answers';
    return NextResponse.json(
      { error: 'invalid submission', issues: [{ path: 'answers', message: detail }] },
      { status: 400 },
    );
  }

  const submittedAt = new Date().toISOString();
  const submission: Submission = {
    id: generateId(submittedAt),
    submittedAt,
    configVersion: config.meta.version,
    respondent: body.data.respondent as RespondentInfo,
    answers: body.data.answers as Answers,
    result: {
      overallScore: result.overallScore,
      tierScores: Object.fromEntries(
        result.tierScores.map((tier) => [tier.tierId, tier.score]),
      ),
      level: { value: result.level.value as AnswerValue, name: result.level.name },
    },
    meta: {
      // Stored for analysis of device mix. The IP address is deliberately never read.
      userAgent: request.headers.get('user-agent') ?? '',
      durationMs: body.data.durationMs ?? 0,
    },
  };

  try {
    await getStore().save(submission);
  } catch (error) {
    // The respondent's result is computed in their browser and does not depend on this
    // write. Log the failure for the researcher and still return success (OD-5).
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[submissions] failed to store ${submission.id}: ${detail}`);
    return NextResponse.json({ id: submission.id, stored: false }, { status: 200 });
  }

  return NextResponse.json({ id: submission.id, stored: true }, { status: 200 });
}

/**
 * There is deliberately no public read endpoint (FR-10) — a completed survey cannot be
 * retrieved. Admin reads live under /api/admin/* and are separately authenticated.
 */
function methodNotAllowed(): NextResponse {
  return NextResponse.json({ error: 'method not allowed' }, { status: 405, headers: { Allow: 'POST' } });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
