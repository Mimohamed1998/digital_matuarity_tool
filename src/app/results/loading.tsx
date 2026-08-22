import { Card } from '@/components/ui/Card';

/**
 * Shown while the results route segment loads.
 *
 * Mirrors the pre-hydration state inside ResultsView, so a refresh on /results never
 * flashes the "no results yet" empty state — which would read as data loss.
 */
export default function ResultsLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Your results</h1>
      <Card>
        <p className="text-muted">Working out your result…</p>
      </Card>
    </div>
  );
}
