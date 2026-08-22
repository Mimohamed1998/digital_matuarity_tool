import type { ReactNode } from 'react';

interface FieldProps {
  /** Must match the `id` of the control rendered by `children`. */
  id: string;
  label: string;
  help?: string;
  error?: string;
  required?: boolean;
  /** Receives the aria wiring to spread onto the control. */
  children: (props: {
    id: string;
    'aria-describedby'?: string;
    'aria-invalid'?: true;
    'aria-required'?: true;
  }) => ReactNode;
}

/**
 * A labelled form control with its help text and error message wired up.
 *
 * The render-prop shape exists so the caller keeps full control of the input element
 * (type, value, handlers) while this component owns the accessibility plumbing —
 * `<label for>`, `aria-describedby`, `aria-invalid`.
 */
export function Field({ id, label, help, error, required, children }: FieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required ? (
          <span className="ml-1 text-danger" aria-hidden="true">
            *
          </span>
        ) : (
          <span className="ml-1 font-normal text-muted">(optional)</span>
        )}
      </label>

      {children({
        id,
        'aria-describedby': describedBy,
        'aria-invalid': error ? true : undefined,
        'aria-required': required ? true : undefined,
      })}

      {help && (
        <p id={helpId} className="text-sm text-muted">
          {help}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

/** Shared input styling, so every control in the app looks and focuses the same. */
export const inputClassName =
  'w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-ink ' +
  'placeholder:text-muted aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft';
