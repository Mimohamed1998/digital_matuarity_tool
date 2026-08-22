import Link from 'next/link';
import { ButtonLink } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { loadConfig } from '@/lib/config/load';

export default function LandingPage() {
  const config = loadConfig();
  const { meta, tiers, factors } = config;

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">{meta.title}</h1>
          <p className="text-lg text-muted">{meta.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <ButtonLink href="/survey">Start the survey</ButtonLink>
          <p className="text-sm text-muted">
            Takes about {meta.estimated_minutes} minutes · {factors.length} questions
          </p>
        </div>
      </section>

      <section aria-labelledby="about-heading" className="flex flex-col gap-3">
        <h2 id="about-heading" className="text-xl font-semibold text-ink">
          About this study
        </h2>
        <p className="max-w-prose text-ink">{meta.intro}</p>
      </section>

      <section aria-labelledby="what-heading" className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 id="what-heading" className="text-xl font-semibold text-ink">
            What you&rsquo;ll be asked
          </h2>
          <p className="max-w-prose text-muted">{meta.instructions}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {tiers.map((tier) => {
            const tierFactors = factors.filter((factor) => factor.tier === tier.id);
            return (
              <Card
                key={tier.id}
                heading={tier.name}
                headingLevel="h3"
                description={tier.label}
                className="h-full"
              >
                <p className="text-sm text-muted">{tier.description}</p>
                <ul className="mt-4 flex flex-col gap-2">
                  {tierFactors.map((factor) => (
                    <li key={factor.id} className="flex gap-2 text-sm text-ink">
                      <span aria-hidden="true" className="text-muted">
                        —
                      </span>
                      <span>{factor.name}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>

        <p className="text-sm">
          <Link href="/model" className="rounded-sm font-medium text-accent underline">
            How the model works
          </Link>{' '}
          <span className="text-muted">
            — the theory, the weights and the maturity levels behind your score.
          </span>
        </p>
      </section>

      <section>
        <Card heading="Before you start" headingLevel="h2">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-sm text-ink">
            <li>
              Your responses are stored for research purposes only, and are reported in aggregate.
            </li>
            <li>
              Giving your name is optional. Leave it blank if you prefer to respond anonymously.
            </li>
            <li>
              You will see your score, your maturity level and your recommendations as soon as you
              finish, and you can download them as a PDF.
            </li>
            <li>
              <strong className="font-semibold">Results cannot be retrieved later.</strong> There is
              no account and no way to reopen a completed survey, so download the PDF before you
              close the page.
            </li>
          </ul>
        </Card>
      </section>
    </div>
  );
}
