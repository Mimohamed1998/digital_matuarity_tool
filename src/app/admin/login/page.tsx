import type { Metadata } from 'next';
import { Card } from '@/components/ui/Card';
import { LoginForm } from '@/components/admin/LoginForm';

export const metadata: Metadata = {
  title: 'Admin sign in',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default function AdminLoginPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Researcher sign in</h1>
        <p className="text-sm text-muted">
          This area holds respondent data. It is not linked from the public site.
        </p>
      </header>

      <Card>
        <LoginForm />
      </Card>
    </div>
  );
}
