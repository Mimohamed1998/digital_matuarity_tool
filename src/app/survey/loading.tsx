import { Card } from '@/components/ui/Card';

export default function SurveyLoading() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-bold tracking-tight text-ink">Survey</h1>
      <Card>
        <p className="text-muted">Loading your progress…</p>
      </Card>
    </div>
  );
}
