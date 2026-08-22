import type { Metadata } from 'next';
import { ConfigError } from '@/components/ConfigError';
import { ResultsView } from '@/components/results/ResultsView';
import { loadConfig } from '@/lib/config/load';

export const metadata: Metadata = {
  title: 'Your results',
  description: 'Your digital maturity score, maturity level and prioritised recommendations.',
};

export default function ResultsPage() {
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    console.error(`[results] config failed to load: ${error instanceof Error ? error.message : String(error)}`);
    return <ConfigError />;
  }

  return <ResultsView config={config} />;
}
