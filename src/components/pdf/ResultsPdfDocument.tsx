import { Document, Font, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { AppConfig } from '@/lib/config/schema';
import { formatScore } from '@/lib/format';
import type { Recommendation, ScoreResult } from '@/types/domain';

/**
 * The downloadable results PDF (FR-8).
 *
 * @react-pdf primitives and standard fonts only — no remote font fetching, no
 * html2canvas, no screenshotting the DOM. The output is real text, so it is selectable
 * and searchable. Charts are omitted; the tables carry the same numbers.
 */

interface ResultsPdfDocumentProps {
  config: AppConfig;
  result: ScoreResult;
  improvements: Recommendation[];
  strengths: Recommendation[];
  respondentName?: string;
  respondentDesignation?: string;
  generatedAt: Date;
}

// @react-pdf hyphenates by default, which in narrow table columns produces breaks like
// "Organisational En-ablers" and "trans-formation". Returning the word whole disables it:
// words wrap intact instead, which is what a reader expects in a report.
Font.registerHyphenationCallback((word) => [word]);

const COLOURS = {
  ink: '#16181d',
  muted: '#5a6270',
  line: '#d7dbe2',
  surface: '#f4f6f8',
};

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 56, paddingHorizontal: 48, fontSize: 10, color: COLOURS.ink, lineHeight: 1.5 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', marginBottom: 4 },
  subtitle: { fontSize: 11, color: COLOURS.muted, marginBottom: 2 },
  metaLine: { fontSize: 9, color: COLOURS.muted },
  sectionHeading: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 22, marginBottom: 8 },
  scoreBlock: { marginTop: 18, padding: 14, backgroundColor: COLOURS.surface, borderLeftWidth: 4, borderLeftColor: COLOURS.ink },
  scoreValue: { fontSize: 28, fontFamily: 'Helvetica-Bold' },
  levelName: { fontSize: 14, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  headline: { fontSize: 11, marginTop: 6 },
  body: { marginTop: 6 },
  bullet: { flexDirection: 'row', marginTop: 3 },
  bulletMark: { width: 12 },
  bulletText: { flex: 1 },
  table: { borderTopWidth: 1, borderTopColor: COLOURS.line, marginTop: 6 },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLOURS.line, paddingVertical: 6 },
  headerRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: COLOURS.line, paddingVertical: 6, backgroundColor: COLOURS.surface },
  cellHeader: { fontFamily: 'Helvetica-Bold', fontSize: 9 },
  colFactor: { width: '22%', paddingRight: 6 },
  colTier: { width: '20%', paddingRight: 6 },
  colAnswer: { width: '16%', paddingRight: 6 },
  colStatement: { width: '42%' },
  colTierName: { width: '50%' },
  colWeight: { width: '25%', textAlign: 'right' },
  colScore: { width: '25%', textAlign: 'right' },
  recommendation: { marginTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: COLOURS.line },
  recommendationHeading: { fontFamily: 'Helvetica-Bold', fontSize: 11 },
  recommendationMeta: { fontSize: 9, color: COLOURS.muted, marginTop: 1 },
  footer: { position: 'absolute', bottom: 28, left: 48, right: 48, fontSize: 8, color: COLOURS.muted, borderTopWidth: 1, borderTopColor: COLOURS.line, paddingTop: 6 },
});

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bullet} wrap={false}>
      <Text style={styles.bulletMark}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export function ResultsPdfDocument({
  config,
  result,
  improvements,
  strengths,
  respondentName,
  respondentDesignation,
  generatedAt,
}: ResultsPdfDocumentProps) {
  const { decimals, max_answer: maxAnswer } = config.scoring;
  const generated = generatedAt.toISOString().slice(0, 10);

  return (
    <Document
      title={`${config.meta.title} — result`}
      author={config.meta.title}
      subject="Digital maturity assessment result"
    >
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{config.meta.title}</Text>
        <Text style={styles.subtitle}>{config.meta.subtitle}</Text>
        <Text style={styles.metaLine}>
          Generated {generated}
          {respondentDesignation ? ` · ${respondentDesignation}` : ''}
          {respondentName ? ` · ${respondentName}` : ''}
        </Text>

        <View style={styles.scoreBlock}>
          <Text style={styles.scoreValue}>
            {formatScore(result.overallScore, decimals)} / {formatScore(maxAnswer, 0)}
          </Text>
          <Text style={styles.levelName}>
            Level {result.level.value} · {result.level.name}
          </Text>
          <Text style={styles.metaLine}>{result.level.subtitle}</Text>
          <Text style={styles.headline}>{result.level.headline}</Text>
          <Text style={styles.body}>{result.level.description}</Text>
        </View>

        <Text style={styles.sectionHeading}>What this level looks like</Text>
        {result.level.characteristics.map((characteristic) => (
          <Bullet key={characteristic}>{characteristic}</Bullet>
        ))}

        <Text style={styles.sectionHeading}>Tier scores</Text>
        <View style={styles.table}>
          <View style={styles.headerRow}>
            <Text style={[styles.colTierName, styles.cellHeader]}>Tier</Text>
            <Text style={[styles.colWeight, styles.cellHeader]}>Weight</Text>
            <Text style={[styles.colScore, styles.cellHeader]}>Score</Text>
          </View>
          {result.tierScores.map((tier) => (
            <View key={tier.tierId} style={styles.row} wrap={false}>
              <Text style={styles.colTierName}>{tier.tierName}</Text>
              <Text style={styles.colWeight}>{formatScore(tier.weight, 2)}</Text>
              <Text style={styles.colScore}>{formatScore(tier.score, decimals)}</Text>
            </View>
          ))}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Weighted-sum model, configuration version ${config.meta.version}. Page ${pageNumber} of ${totalPages}.`
          }
          fixed
        />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionHeading}>Your answers</Text>
        <View style={styles.table}>
          <View style={styles.headerRow} fixed>
            <Text style={[styles.colFactor, styles.cellHeader]}>Factor</Text>
            <Text style={[styles.colTier, styles.cellHeader]}>Tier</Text>
            <Text style={[styles.colAnswer, styles.cellHeader]}>Answer</Text>
            <Text style={[styles.colStatement, styles.cellHeader]}>Statement chosen</Text>
          </View>
          {result.factorScores.map((factor) => {
            const tier = result.tierScores.find((t) => t.tierId === factor.tierId);
            const configFactor = config.factors.find((f) => f.id === factor.factorId);
            return (
              <View key={factor.factorId} style={styles.row} wrap={false}>
                <Text style={styles.colFactor}>{factor.factorName}</Text>
                <Text style={styles.colTier}>{tier?.tierName ?? ''}</Text>
                <Text style={styles.colAnswer}>
                  {factor.answer} · {config.scale_labels[String(factor.answer)] ?? ''}
                </Text>
                <Text style={styles.colStatement}>
                  {configFactor?.statements[String(factor.answer)] ?? ''}
                </Text>
              </View>
            );
          })}
        </View>

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Weighted-sum model, configuration version ${config.meta.version}. Page ${pageNumber} of ${totalPages}.`
          }
          fixed
        />
      </Page>

      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionHeading}>Where to improve next</Text>
        {improvements.length === 0 ? (
          <Text style={styles.body}>
            Every factor is already at the highest level on this scale. The strengths below are
            what to protect.
          </Text>
        ) : (
          <>
            <Text style={styles.body}>
              Highest-impact actions first, ranked by how much each factor&apos;s weight and your
              current gap affect the overall score.
            </Text>
            {improvements.map((recommendation, index) => (
              // wrap={false} keeps a recommendation whole; long text is never clipped,
              // it simply moves to the next page.
              <View key={recommendation.factorId} style={styles.recommendation} wrap={false}>
                <Text style={styles.recommendationHeading}>
                  {index + 1}. {recommendation.factorName}
                </Text>
                <Text style={styles.recommendationMeta}>
                  {recommendation.tierName} · currently {recommendation.currentAnswer} ·{' '}
                  {config.scale_labels[String(recommendation.currentAnswer)] ?? ''} · closing this
                  gap adds up to {formatScore(recommendation.impact, 2)}
                </Text>
                <Text style={styles.body}>{recommendation.text}</Text>
              </View>
            ))}
          </>
        )}

        {strengths.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Strengths to sustain</Text>
            {strengths.map((strength) => (
              <View key={strength.factorId} style={styles.recommendation} wrap={false}>
                <Text style={styles.recommendationHeading}>{strength.factorName}</Text>
                <Text style={styles.recommendationMeta}>{strength.tierName}</Text>
                <Text style={styles.body}>{strength.text}</Text>
              </View>
            ))}
          </>
        )}

        <Text
          style={styles.footer}
          render={({ pageNumber, totalPages }) =>
            `Scores combine tier and factor weights as a weighted sum; see the model page for the method. Configuration version ${config.meta.version}. Page ${pageNumber} of ${totalPages}.`
          }
          fixed
        />
      </Page>
    </Document>
  );
}
