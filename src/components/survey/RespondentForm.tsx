'use client';

import { useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, inputClassName } from '@/components/ui/Field';
import type { RespondentFieldConfig } from '@/lib/config/schema';
import { useSurveyStore } from '@/store/survey-store';

interface RespondentFormProps {
  fields: RespondentFieldConfig[];
  onComplete: () => void;
}

type Errors = Record<string, string>;

const CONSENT_ID = 'respondent-consent';
const CONSENT_LABEL = 'I understand my responses will be stored for research purposes';

/** Validate one field. Returns an error message, or undefined when the value is fine. */
function validateField(
  field: RespondentFieldConfig,
  rawValue: string | number | undefined,
): string | undefined {
  const isBlank = rawValue === undefined || rawValue === '' || rawValue === null;

  if (field.required && isBlank) return `${field.label} is required.`;
  if (isBlank) return undefined;

  if (field.type === 'number') {
    const value = typeof rawValue === 'number' ? rawValue : Number(rawValue);
    if (!Number.isFinite(value)) return `${field.label} must be a number.`;
    if (!Number.isInteger(value)) return `${field.label} must be a whole number of years.`;
    if (field.min !== undefined && value < field.min) {
      return `${field.label} must be ${field.min} or more.`;
    }
    if (field.max !== undefined && value > field.max) {
      return `${field.label} must be ${field.max} or less.`;
    }
  }

  if (field.type === 'select') {
    const allowed = (field.options ?? []).map((option) => option.value);
    if (!allowed.includes(String(rawValue))) return `Choose one of the listed options.`;
  }

  return undefined;
}

/**
 * The General Information step (FR-11).
 *
 * Every input is generated from `respondent_fields` in conf.yaml — adding a field there
 * renders it here with no code change.
 */
export function RespondentForm({ fields, onComplete }: RespondentFormProps) {
  const respondent = useSurveyStore((state) => state.respondent);
  const setRespondentField = useSurveyStore((state) => state.setRespondentField);
  const markStarted = useSurveyStore((state) => state.markStarted);

  const [errors, setErrors] = useState<Errors>({});
  const [consent, setConsent] = useState(false);
  const [consentError, setConsentError] = useState<string | undefined>();
  const formRef = useRef<HTMLFormElement>(null);

  const handleBlur = (field: RespondentFieldConfig) => {
    const error = validateField(field, respondent[field.id]);
    setErrors((previous) => {
      const next = { ...previous };
      if (error) next[field.id] = error;
      else delete next[field.id];
      return next;
    });
  };

  const handleChange = (field: RespondentFieldConfig, value: string) => {
    if (field.type === 'number') {
      setRespondentField(field.id, value === '' ? undefined : Number(value));
    } else {
      setRespondentField(field.id, value);
    }
    // Clear an existing error as soon as the value becomes valid, so the message does
    // not linger while the respondent is visibly fixing it.
    setErrors((previous) => {
      if (!previous[field.id]) return previous;
      const candidate = field.type === 'number' ? Number(value) : value;
      if (validateField(field, value === '' ? undefined : candidate)) return previous;
      const next = { ...previous };
      delete next[field.id];
      return next;
    });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: Errors = {};
    for (const field of fields) {
      const error = validateField(field, respondent[field.id]);
      if (error) nextErrors[field.id] = error;
    }
    setErrors(nextErrors);

    const missingConsent = !consent;
    setConsentError(missingConsent ? 'Please confirm this before continuing.' : undefined);

    if (Object.keys(nextErrors).length > 0) {
      const firstInvalid = fields.find((field) => nextErrors[field.id]);
      if (firstInvalid) {
        formRef.current?.querySelector<HTMLElement>(`#${CSS.escape(firstInvalid.id)}`)?.focus();
      }
      return;
    }
    if (missingConsent) {
      formRef.current?.querySelector<HTMLElement>(`#${CONSENT_ID}`)?.focus();
      return;
    }

    markStarted();
    onComplete();
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map((field) => {
          const value = respondent[field.id];
          const stringValue = value === undefined || value === null ? '' : String(value);

          return (
            <div key={field.id} className={field.type === 'select' ? 'sm:col-span-2' : undefined}>
              <Field
                id={field.id}
                label={field.label}
                help={field.help}
                error={errors[field.id]}
                required={field.required}
              >
                {(aria) =>
                  field.type === 'select' ? (
                    <select
                      {...aria}
                      className={inputClassName}
                      value={stringValue}
                      onChange={(event) => handleChange(field, event.target.value)}
                      onBlur={() => handleBlur(field)}
                    >
                      <option value="">Please choose…</option>
                      {(field.options ?? []).map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      {...aria}
                      className={inputClassName}
                      type={field.type === 'number' ? 'number' : 'text'}
                      inputMode={field.type === 'number' ? 'numeric' : undefined}
                      step={field.type === 'number' ? 1 : undefined}
                      min={field.min}
                      max={field.max}
                      value={stringValue}
                      onChange={(event) => handleChange(field, event.target.value)}
                      onBlur={() => handleBlur(field)}
                    />
                  )
                }
              </Field>
            </div>
          );
        })}
      </div>

      <div className="rounded-lg border border-line bg-surface-2 p-4">
        <div className="flex items-start gap-3">
          <input
            id={CONSENT_ID}
            type="checkbox"
            checked={consent}
            aria-describedby={consentError ? `${CONSENT_ID}-error` : undefined}
            aria-invalid={consentError ? true : undefined}
            onChange={(event) => {
              setConsent(event.target.checked);
              if (event.target.checked) setConsentError(undefined);
            }}
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
          />
          <label htmlFor={CONSENT_ID} className="text-sm text-ink">
            {CONSENT_LABEL}
            <span className="ml-1 text-danger" aria-hidden="true">
              *
            </span>
            <span className="mt-1 block text-muted">
              Responses are reported in aggregate. Your name is optional and is never published.
            </span>
          </label>
        </div>
        {consentError && (
          <p id={`${CONSENT_ID}-error`} className="mt-2 text-sm font-medium text-danger">
            {consentError}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button type="submit">Start the questions</Button>
      </div>
    </form>
  );
}
