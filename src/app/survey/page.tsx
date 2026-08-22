import type { Metadata } from 'next';
import { ConfigError } from '@/components/ConfigError';
import { SurveyFlow } from '@/components/survey/SurveyFlow';
import { loadConfig } from '@/lib/config/load';

export const metadata: Metadata = {
  title: 'Survey',
  description: 'Answer seven questions about digital maturity in your organisation.',
};

export default function SurveyPage() {
  // Server component: reads the config once and hands it to the client flow, so
  // conf.yaml never has to be shipped to or parsed in the browser.
  let config;
  try {
    config = loadConfig();
  } catch (error) {
    // The detail belongs in the server log, not on the page — it names config paths.
    console.error(`[survey] config failed to load: ${error instanceof Error ? error.message : String(error)}`);
    return <ConfigError />;
  }

  return <SurveyFlow config={config} />;
}
