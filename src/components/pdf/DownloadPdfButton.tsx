'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import type { AppConfig } from '@/lib/config/schema';
import type { Recommendation, ScoreResult } from '@/types/domain';

interface DownloadPdfButtonProps {
  config: AppConfig;
  result: ScoreResult;
  improvements: Recommendation[];
  strengths: Recommendation[];
  respondentName?: string;
  respondentDesignation?: string;
}

type State = 'idle' | 'generating' | 'error';

function filenameFor(levelName: string, generatedAt: Date): string {
  const level = levelName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `digital-maturity-${level}-${generatedAt.toISOString().slice(0, 10)}.pdf`;
}

/**
 * Generates the results PDF in the browser, on click.
 *
 * @react-pdf and the document component are both imported dynamically, so roughly a
 * megabyte of PDF machinery stays out of the initial page load and out of the server
 * bundle entirely — nobody who does not click pays for it.
 */
export function DownloadPdfButton({
  config,
  result,
  improvements,
  strengths,
  respondentName,
  respondentDesignation,
}: DownloadPdfButtonProps) {
  const [state, setState] = useState<State>('idle');
  const inFlight = useRef(false);

  const handleDownload = async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState('generating');

    let url: string | undefined;
    try {
      const [{ pdf }, { ResultsPdfDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/pdf/ResultsPdfDocument'),
      ]);

      const generatedAt = new Date();
      const blob = await pdf(
        <ResultsPdfDocument
          config={config}
          result={result}
          improvements={improvements}
          strengths={strengths}
          respondentName={respondentName}
          respondentDesignation={respondentDesignation}
          generatedAt={generatedAt}
        />,
      ).toBlob();

      url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filenameFor(result.level.name, generatedAt);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setState('idle');
    } catch {
      // No console logging: the document contains the respondent's answers.
      setState('error');
    } finally {
      // Revoke after the browser has had a chance to start the download.
      const objectUrl = url;
      if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
      inFlight.current = false;
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button onClick={handleDownload} disabled={state === 'generating'} aria-busy={state === 'generating'}>
        {state === 'generating'
          ? 'Preparing your PDF…'
          : state === 'error'
            ? 'Try the download again'
            : 'Download your results as a PDF'}
      </Button>
      {state === 'error' && (
        <p role="status" className="text-sm text-danger">
          The PDF could not be generated. Your results are still shown on this page.
        </p>
      )}
    </div>
  );
}
