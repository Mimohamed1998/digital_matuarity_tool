import type { Metadata } from 'next';
import { SurveyFlow } from '@/components/survey/SurveyFlow';
import { loadConfig } from '@/lib/config/load';

export const metadata: Metadata = {
  title: 'Survey',
  description: 'Answer seven questions about digital maturity in your organisation.',
};

export default function SurveyPage() {
  // Server component: reads the config once and hands it to the client flow, so
  // conf.yaml never has to be shipped to or parsed in the browser.
  const config = loadConfig();
  return <SurveyFlow config={config} />;
}
