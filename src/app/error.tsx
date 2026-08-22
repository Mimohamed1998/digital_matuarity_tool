'use client';

import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/Button';

/**
 * The client error boundary.
 *
 * The user is shown a plain explanation and a way forward — never a stack trace, and
 * never the error message, which in this app could name a configuration path or a
 * storage detail. The digest is a server-side correlation id and is safe to display.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side logging already captured this; this line is for the browser console
    // during development. It carries no respondent data.
    console.error('An unexpected error occurred', error.digest ?? '');
  }, [error]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-ink">Something went wrong</h1>
        <p className="max-w-prose text-muted">
          This page couldn&rsquo;t be displayed. Trying again usually works. If you were part-way
          through the survey, your answers are still in this browser session.
        </p>
        {error.digest && (
          <p className="text-sm text-muted">
            Reference: <code className="rounded bg-surface-2 px-1 py-0.5">{error.digest}</code>
          </p>
        )}
      </header>
      <div className="flex flex-wrap gap-3">
        <Button onClick={reset}>Try again</Button>
        <ButtonLink href="/" variant="secondary">
          Back to the start
        </ButtonLink>
      </div>
    </div>
  );
}
