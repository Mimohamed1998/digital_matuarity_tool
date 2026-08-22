import { Card } from '@/components/ui/Card';

/**
 * Shown when conf.yaml cannot be read or fails validation.
 *
 * The zod message names a field path and is useful to whoever maintains the survey, but
 * it describes server-side configuration, so it stays out of the page. The build already
 * fails loudly on a bad config — this only covers a file that changed after deploy.
 */
export function ConfigError() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold tracking-tight text-ink">The survey is unavailable</h1>
      <Card>
        <p className="max-w-prose text-ink">
          The questionnaire could not be loaded, so the survey cannot run right now. This is a
          problem with the site rather than with anything you did. Please try again later.
        </p>
      </Card>
    </div>
  );
}
