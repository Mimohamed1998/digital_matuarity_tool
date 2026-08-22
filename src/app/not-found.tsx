import { ButtonLink } from '@/components/ui/Button';

export const metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium text-muted">404</p>
        <h1 className="text-3xl font-bold tracking-tight text-ink">
          That page doesn&rsquo;t exist
        </h1>
        <p className="max-w-prose text-muted">
          The link may be out of date, or the address mistyped. Nothing has been lost — if you were
          part-way through the survey, your answers are still in this browser session.
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/">Back to the start</ButtonLink>
        <ButtonLink href="/survey" variant="secondary">
          Continue the survey
        </ButtonLink>
      </div>
    </div>
  );
}
