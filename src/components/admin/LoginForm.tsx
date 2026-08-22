'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Field, inputClassName } from '@/components/ui/Field';

/** The one message shown for every failure — the server never explains which part failed. */
const GENERIC_ERROR = 'That password was not accepted.';
const RATE_LIMITED = 'Too many attempts. Wait a few minutes and try again.';

export function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(undefined);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.status === 204) {
        setPassword('');
        router.replace('/admin');
        router.refresh();
        return;
      }
      setError(response.status === 429 ? RATE_LIMITED : GENERIC_ERROR);
    } catch {
      setError(GENERIC_ERROR);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <Field id="admin-password" label="Password" error={error} required>
        {(aria) => (
          <input
            {...aria}
            className={inputClassName}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        )}
      </Field>

      <Button type="submit" disabled={busy || password.length === 0} aria-busy={busy}>
        {busy ? 'Signing in…' : 'Sign in'}
      </Button>
    </form>
  );
}
