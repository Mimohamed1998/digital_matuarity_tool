import { NextResponse } from 'next/server';
import { hasAdminSession } from '@/lib/auth/guard';
import { loadConfig } from '@/lib/config/load';
import { buildHeader, submissionToFlatRow, toCsvRow } from '@/lib/export/csv';
import { getStore } from '@/lib/storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Excel needs a BOM to read UTF-8 correctly; without it accented names come out mangled. */
const UTF8_BOM = '﻿';

function filename(extension: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `dm-submissions-${date}.${extension}`;
}

export async function GET(request: Request): Promise<Response> {
  // The middleware already gates this route. Checking again here is the second gate
  // (NFR-6) — this handler must refuse on its own even if the matcher is wrong.
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const format = new URL(request.url).searchParams.get('format');
  if (format !== 'csv' && format !== 'json') {
    return NextResponse.json(
      { error: 'unknown format', detail: 'use format=csv or format=json' },
      { status: 400 },
    );
  }

  const config = loadConfig();
  const store = getStore();
  const encoder = new TextEncoder();

  // Streamed, not assembled. The whole file is never held in memory at once, so the
  // export stays flat whether there are 10 submissions or 10,000 (NFR-7).
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (format === 'csv') {
          controller.enqueue(encoder.encode(UTF8_BOM + toCsvRow(buildHeader(config))));
          for await (const submission of store.all()) {
            controller.enqueue(encoder.encode(toCsvRow(submissionToFlatRow(config, submission))));
          }
        } else {
          controller.enqueue(encoder.encode('['));
          let first = true;
          for await (const submission of store.all()) {
            controller.enqueue(encoder.encode((first ? '' : ',') + JSON.stringify(submission)));
            first = false;
          }
          controller.enqueue(encoder.encode(']'));
        }
        controller.close();
      } catch (error) {
        // The download will be truncated, which the researcher will notice. Log the
        // reason for them; never put respondent data in the error.
        console.error(
          `[admin-export] failed mid-stream: ${error instanceof Error ? error.message : String(error)}`,
        );
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type':
        format === 'csv' ? 'text/csv; charset=utf-8' : 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename(format)}"`,
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
