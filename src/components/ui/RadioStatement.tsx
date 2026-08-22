'use client';

interface RadioStatementProps {
  /** Shared across the group — this is what makes arrow keys move between statements. */
  name: string;
  value: number;
  /** The scale label for this value, e.g. "Developing". */
  scaleLabel: string;
  statement: string;
  checked: boolean;
  onSelect: (value: number) => void;
}

/**
 * One statement on the 1-5 scale.
 *
 * A native `<input type="radio">` does the work: grouping, arrow-key navigation and
 * Space selection are all free, and correct. The input is visually hidden but still
 * focusable and still the thing that receives the focus ring (via `peer-focus-visible`),
 * with the whole card acting as its label.
 */
export function RadioStatement({
  name,
  value,
  scaleLabel,
  statement,
  checked,
  onSelect,
}: RadioStatementProps) {
  return (
    <label
      className={[
        'group relative flex cursor-pointer gap-3 rounded-lg border p-4',
        'has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus',
        checked
          ? 'border-accent bg-accent-soft ring-2 ring-accent'
          : 'border-line-strong bg-surface hover:bg-surface-2',
      ].join(' ')}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onSelect(value)}
        className="absolute h-px w-px opacity-0"
      />

      <span
        aria-hidden="true"
        className={[
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold',
          checked
            ? 'border-accent bg-accent text-accent-contrast'
            : 'border-line-strong bg-surface text-muted',
        ].join(' ')}
      >
        {value}
      </span>

      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{scaleLabel}</span>
          {/* Selection is signalled by the tick and the ring, not by colour alone. */}
          {checked && (
            <span className="text-sm font-medium text-accent">
              <span aria-hidden="true">✓ </span>Selected
            </span>
          )}
        </span>
        <span className="text-sm text-ink">{statement}</span>
      </span>
    </label>
  );
}
