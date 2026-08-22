import type { Metadata } from 'next';
import Image from 'next/image';
import { Card } from '@/components/ui/Card';
import { loadConfig } from '@/lib/config/load';
import { formatScore, formatWeight } from '@/lib/format';

export const metadata: Metadata = {
  title: 'How the model works',
  description:
    'The theory behind the digital maturity model for the apparel industry: the two-tier ' +
    'structure, the factor weights, the scoring formula and the five maturity levels.',
};

export default function ModelPage() {
  const config = loadConfig();
  const { meta, tiers, factors, maturity_levels: levels, scoring } = config;

  const weightRows = tiers.flatMap((tier) =>
    factors
      .filter((factor) => factor.tier === tier.id)
      .map((factor) => ({
        tierId: tier.id,
        tierName: tier.name,
        tierWeight: tier.weight,
        factorName: factor.name,
        factorWeight: factor.weight,
        effectiveWeight: tier.weight * factor.weight,
      })),
  );

  const effectiveTotal = weightRows.reduce((total, row) => total + row.effectiveWeight, 0);
  const tierWeightTotal = tiers.reduce((total, tier) => total + tier.weight, 0);

  /** The worked example from the plan, computed rather than transcribed. */
  const exampleAnswer = 3;
  const exampleOverall = tiers.reduce(
    (total, tier) =>
      total +
      tier.weight *
        factors
          .filter((factor) => factor.tier === tier.id)
          .reduce((tierTotal, factor) => tierTotal + factor.weight * exampleAnswer, 0),
    0,
  );

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-ink sm:text-4xl">
          How the model works
        </h1>
        <p className="max-w-prose text-lg text-muted">{meta.subtitle}</p>
      </section>

      <section aria-labelledby="aim-heading" className="flex flex-col gap-3">
        <h2 id="aim-heading" className="text-2xl font-semibold text-ink">
          Aim of the study
        </h2>
        <p className="max-w-prose text-ink">{meta.intro}</p>
        <p className="max-w-prose text-ink">
          The study combines qualitative and quantitative data — interviews with industry
          professionals to understand current practices, challenges and strategic priorities,
          alongside questionnaire data. The result is a model capable of indexing the level of
          digital transformation in apparel organisations and supporting them in enhancing that
          journey.
        </p>
      </section>

      <section aria-labelledby="structure-heading" className="flex flex-col gap-5">
        <h2 id="structure-heading" className="text-2xl font-semibold text-ink">
          The two-tier structure
        </h2>

        <figure className="flex flex-col gap-3">
          <div className="rounded-lg border border-line bg-surface p-4">
            <Image
              src="/assets/model-diagram.png"
              alt={
                'Diagram of the proposed model. Tier 01, Organisational Enabler, combines ' +
                'Leadership, Strategy and Governance, People and Culture, and Technology, ' +
                'weighted i1 to i4, and is then weighted by w1. Tier 02, Core Operation, ' +
                'covers Product Development through Research, Design and Development, ' +
                'weighted l1 to l3, and is then weighted by w2. Both tiers combine into a ' +
                'single maturity score.'
              }
              width={1200}
              height={700}
              className="h-auto w-full"
              priority={false}
            />
          </div>
          <figcaption className="text-sm text-muted">
            The proposed model, as drawn in the source document. The same structure is described
            in words below, so nothing here depends on being able to see the figure.
          </figcaption>
        </figure>

        <div className="grid gap-4 sm:grid-cols-2">
          {tiers.map((tier) => (
            <Card
              key={tier.id}
              heading={tier.name}
              headingLevel="h3"
              description={`${tier.label} · weight ${formatScore(tier.weight, 2)}`}
              className="h-full"
            >
              <p className="text-sm text-muted">{tier.description}</p>
              <ul className="mt-4 flex flex-col gap-2">
                {factors
                  .filter((factor) => factor.tier === tier.id)
                  .map((factor) => (
                    <li key={factor.id} className="flex justify-between gap-3 text-sm text-ink">
                      <span>{factor.name}</span>
                      <span className="tabular-nums text-muted">
                        {formatScore(factor.weight, 3)}
                      </span>
                    </li>
                  ))}
              </ul>
            </Card>
          ))}
        </div>

        <p className="max-w-prose text-sm text-muted">
          &ldquo;Product Development&rdquo; in the figure is a grouping label for Research, Design
          and Development rather than a scored factor in its own right — there is no eighth
          question in the source questionnaire.
        </p>
      </section>

      <section aria-labelledby="weights-heading" className="flex flex-col gap-4">
        <h2 id="weights-heading" className="text-2xl font-semibold text-ink">
          The weights
        </h2>
        <p className="max-w-prose text-ink">
          Each factor carries a weight within its tier, and each tier carries a weight in the
          overall score. Multiplying the two gives the factor&rsquo;s effective weight — its true
          share of the final number. Both the tier weights and the factor weights within a tier
          sum to 1, which is what keeps the overall score on the same 1–5 scale as the answers.
        </p>

        <div className="scroll-x rounded-lg border border-line bg-surface">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only-focusable p-3 text-left text-muted">
              Factor weights, tier weights and effective weights, from conf.yaml
            </caption>
            <thead>
              <tr className="border-b border-line text-left">
                <th scope="col" className="p-3 font-semibold text-ink">
                  Tier
                </th>
                <th scope="col" className="p-3 font-semibold text-ink">
                  Factor
                </th>
                <th scope="col" className="p-3 text-right font-semibold text-ink">
                  Factor weight
                </th>
                <th scope="col" className="p-3 text-right font-semibold text-ink">
                  Tier weight
                </th>
                <th scope="col" className="p-3 text-right font-semibold text-ink">
                  Effective weight
                </th>
              </tr>
            </thead>
            <tbody>
              {weightRows.map((row) => (
                <tr key={`${row.tierId}-${row.factorName}`} className="border-b border-line">
                  <td className="p-3 text-muted">{row.tierName}</td>
                  <td className="p-3 text-ink">{row.factorName}</td>
                  <td className="p-3 text-right tabular-nums text-ink">
                    {formatScore(row.factorWeight, 3)}
                  </td>
                  <td className="p-3 text-right tabular-nums text-muted">
                    {formatScore(row.tierWeight, 2)}
                  </td>
                  <td className="p-3 text-right tabular-nums font-medium text-ink">
                    {formatScore(row.effectiveWeight, 4)}
                    <span className="ml-2 text-muted">({formatWeight(row.effectiveWeight)})</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={3} className="p-3 text-left font-semibold text-ink">
                  Totals
                </th>
                <td className="p-3 text-right tabular-nums font-semibold text-ink">
                  {formatScore(tierWeightTotal, 2)}
                </td>
                <td className="p-3 text-right tabular-nums font-semibold text-ink">
                  {formatScore(effectiveTotal, 2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section aria-labelledby="formula-heading" className="flex flex-col gap-4">
        <h2 id="formula-heading" className="text-2xl font-semibold text-ink">
          The formula
        </h2>
        <p className="max-w-prose text-ink">
          Every answer is an integer from {scoring.min_answer} to {scoring.max_answer}. Each
          tier&rsquo;s score is the weighted sum of its factors&rsquo; answers, and the overall
          score is the weighted sum of the tier scores.
        </p>

        <div className="scroll-x rounded-lg border border-line bg-surface-2 p-4">
          <pre className="text-sm text-ink">
            <code>
              {tiers
                .map((tier) => {
                  const terms = factors
                    .filter((factor) => factor.tier === tier.id)
                    .map((factor) => `${formatScore(factor.weight, 3)} × ${factor.name}`)
                    .join('  +  ');
                  return `${tier.name} = ${terms}`;
                })
                .join('\n')}
              {'\n\n'}
              {`Overall = ${tiers
                .map((tier) => `${formatScore(tier.weight, 2)} × ${tier.name}`)
                .join('  +  ')}`}
            </code>
          </pre>
        </div>

        <p className="max-w-prose text-ink">
          <strong className="font-semibold">Worked example.</strong> If every factor is answered{' '}
          {exampleAnswer}, each tier scores {formatScore(exampleAnswer, 2)}, and the overall score
          is {formatScore(exampleOverall, 2)} — the middle of the scale, and Level{' '}
          {levels.filter((level) => exampleOverall >= level.min_score).slice(-1)[0]?.value}{' '}
          {levels.filter((level) => exampleOverall >= level.min_score).slice(-1)[0]?.name}. Scores
          are displayed to {scoring.decimals} decimal places, but the maturity band is always
          chosen from the unrounded score.
        </p>
      </section>

      <section aria-labelledby="levels-heading" className="flex flex-col gap-5">
        <h2 id="levels-heading" className="text-2xl font-semibold text-ink">
          The maturity levels
        </h2>

        <figure className="flex flex-col gap-3">
          <div className="rounded-lg border border-line bg-surface p-4">
            <Image
              src="/assets/maturity-pyramid.png"
              alt={
                'A five-level pyramid. From the base upwards: Level 1 Initial, manual and ' +
                'siloed; Level 2 Emerging, ad hoc and reactive; Level 3 Developing, structured ' +
                'and consistent; Level 4 Established, managed and integrated; Level 5 Optimised, ' +
                'innovation leader. Maturity increases towards the top.'
              }
              width={1200}
              height={900}
              className="h-auto w-full"
            />
          </div>
          <figcaption className="text-sm text-muted">
            Maturity increases from Level 1 (Initial) to Level 5 (Optimised). The full content of
            the figure is in the table below.
          </figcaption>
        </figure>

        <div className="flex flex-col gap-4">
          {[...levels].reverse().map((level, index, reversed) => {
            const next = reversed[index - 1];
            const upper = next
              ? `below ${formatScore(next.min_score, 2)}`
              : `up to ${formatScore(scoring.max_answer, 2)}`;
            return (
              <article
                key={level.value}
                className="rounded-lg border border-line bg-surface p-5"
                style={{ borderLeft: `6px solid var(--level-${level.value})` }}
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                  <h3
                    className="text-lg font-semibold"
                    style={{ color: `var(--level-${level.value}-text)` }}
                  >
                    Level {level.value} · {level.name}
                  </h3>
                  <p className="text-sm tabular-nums text-muted">
                    {formatScore(level.min_score, 2)} and {upper}
                  </p>
                </div>
                <p className="mt-1 text-sm font-medium text-ink">
                  {level.subtitle} — {level.headline}
                </p>
                <p className="mt-2 max-w-prose text-sm text-ink">{level.description}</p>
                <ul className="mt-3 flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
                  {level.characteristics.map((characteristic) => (
                    <li key={characteristic}>{characteristic}</li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      
    </div>
  );
}
