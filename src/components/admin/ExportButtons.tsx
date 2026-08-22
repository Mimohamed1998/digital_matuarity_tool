import { ButtonLink } from '@/components/ui/Button';

interface ExportButtonsProps {
  disabled?: boolean;
}

/**
 * Plain links, not fetch-and-blob. The export streams, and a link lets the browser
 * handle a large download natively instead of buffering it in a tab's memory.
 */
export function ExportButtons({ disabled }: ExportButtonsProps) {
  if (disabled) {
    return <p className="text-sm text-muted">Export becomes available once there is data.</p>;
  }

  return (
    <div className="flex flex-wrap gap-3">
      <ButtonLink href="/api/admin/export?format=csv" variant="secondary" size="sm">
        Export CSV
      </ButtonLink>
      <ButtonLink href="/api/admin/export?format=json" variant="secondary" size="sm">
        Export JSON
      </ButtonLink>
    </div>
  );
}
