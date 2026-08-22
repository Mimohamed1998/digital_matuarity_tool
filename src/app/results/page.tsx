import type { Metadata } from 'next';
import { ResultsView } from '@/components/results/ResultsView';
import { loadConfig } from '@/lib/config/load';

export const metadata: Metadata = {
  title: 'Your results',
  description: 'Your digital maturity score, maturity level and prioritised recommendations.',
};

export default function ResultsPage() {
  const config = loadConfig();
  return <ResultsView config={config} />;
}
