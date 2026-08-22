import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Digital Maturity Assessment',
    template: '%s · Digital Maturity Assessment',
  },
  description:
    'Assess the digital maturity of an apparel manufacturing organisation across seven factors, ' +
    'and get a score, a maturity level and prioritised recommendations for improvement.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en-GB" className="h-full">
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <a
          href="#main"
          className="sr-only-focusable absolute left-4 top-4 z-50 rounded-md bg-accent px-4 py-2 text-accent-contrast"
        >
          Skip to main content
        </a>

        <header className="border-b border-line bg-surface">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <Link href="/" className="rounded-sm font-semibold text-ink hover:text-accent">
              Digital Maturity Assessment
            </Link>
            <nav aria-label="Primary">
              <Link href="/model" className="rounded-sm text-sm text-muted hover:text-accent">
                How the model works
              </Link>
            </nav>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>

        <footer className="border-t border-line bg-surface">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 text-sm text-muted sm:px-6">
            <p>
              A research instrument for the study &ldquo;Developing a Digital Maturity Model in the
              Apparel Industry&rdquo;. Responses are stored for research purposes only and cannot
              be retrieved once submitted.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
