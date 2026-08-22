import { describe, expect, it } from 'vitest';
import { loadConfig, loadConfigFromString } from '@/lib/config/load';
import {
  buildHeader,
  escapeCsvValue,
  neutraliseFormula,
  submissionToFlatRow,
  toCsvRow,
} from '@/lib/export/csv';
import type { Submission } from '@/types/domain';

const config = loadConfig();

const SUBMISSION: Submission = {
  id: 'sub_2026-08-22T09-31-04-123Z_a1b2c3',
  submittedAt: '2026-08-22T09:31:04.123Z',
  configVersion: '1.0.0',
  respondent: {
    name: 'Priya Fernando',
    designation: 'Head of Product Development',
    experienceTechnicalYears: 8,
    experienceManagerialYears: 4,
    experienceDigitalisationYears: 3,
    highestQualification: 'masters',
  },
  answers: {
    leadership: 5,
    strategy_governance: 4,
    people_culture: 3,
    technology: 2,
    research: 4,
    design: 2,
    development: 3,
  },
  result: {
    overallScore: 3.8021,
    tierScores: { organisational_enablers: 4.073, core_operations: 3.17 },
    level: { value: 4, name: 'Established' },
  },
  meta: { userAgent: 'test', durationMs: 184320 },
};

describe('RFC 4180 quoting', () => {
  it('leaves a plain value unquoted', () => {
    expect(escapeCsvValue('Head of Product')).toBe('Head of Product');
  });

  it('quotes a value containing a comma', () => {
    expect(escapeCsvValue('Perera, Anil')).toBe('"Perera, Anil"');
  });

  it('quotes and doubles an embedded quote', () => {
    expect(escapeCsvValue('the "digital" team')).toBe('"the ""digital"" team"');
  });

  it('quotes a value containing a newline or carriage return', () => {
    expect(escapeCsvValue('line one\nline two')).toBe('"line one\nline two"');
    // A carriage return mid-string is quoted but not prefixed — only a LEADING formula
    // character makes a spreadsheet treat the cell as a formula.
    expect(escapeCsvValue('with\rreturn')).toBe('"with\rreturn"');
    expect(escapeCsvValue('\rleading')).toBe('"\'\rleading"');
  });

  it('terminates rows with CRLF', () => {
    expect(toCsvRow(['a', 'b'])).toBe('a,b\r\n');
  });
});

describe('CSV injection defence', () => {
  it('neutralises a HYPERLINK formula', () => {
    expect(neutraliseFormula('=HYPERLINK("http://evil")')).toBe('\'=HYPERLINK("http://evil")');
  });

  it('neutralises +, - and @ prefixes', () => {
    expect(neutraliseFormula('+1+1')).toBe("'+1+1");
    expect(neutraliseFormula('-1+1')).toBe("'-1+1");
    expect(neutraliseFormula('@SUM(A1)')).toBe("'@SUM(A1)");
  });

  it('neutralises leading tab and carriage return', () => {
    expect(neutraliseFormula('\tcmd')).toBe("'\tcmd");
    expect(neutraliseFormula('\rcmd')).toBe("'\rcmd");
  });

  it('leaves a value that merely contains those characters alone', () => {
    expect(neutraliseFormula('R&D = strategy')).toBe('R&D = strategy');
    expect(neutraliseFormula('cost-effective')).toBe('cost-effective');
  });

  it('leaves an empty value empty', () => {
    expect(neutraliseFormula('')).toBe('');
  });

  it('applies the defence through the row builder too', () => {
    const attack = { ...SUBMISSION, respondent: { ...SUBMISSION.respondent, designation: '=1+1' } };
    const row = toCsvRow(submissionToFlatRow(config, attack));
    expect(row).toContain("'=1+1");
    expect(row).not.toMatch(/(^|,)=1\+1/);
  });
});

describe('header and row shape', () => {
  it('puts the factor columns in configuration order', () => {
    const header = buildHeader(config);
    const factorColumns = header.filter((column) => column.startsWith('answer_'));
    expect(factorColumns).toEqual(config.factors.map((factor) => `answer_${factor.id}`));
  });

  it('includes id, timestamp, respondent fields, tiers and the result', () => {
    const header = buildHeader(config);
    expect(header.slice(0, 3)).toEqual(['id', 'submittedAt', 'configVersion']);
    expect(header).toContain('designation');
    expect(header).toContain('tier_organisational_enablers');
    expect(header).toContain('tier_core_operations');
    expect(header.slice(-3)).toEqual(['overallScore', 'levelValue', 'levelName']);
  });

  it('produces one value per header column', () => {
    expect(submissionToFlatRow(config, SUBMISSION)).toHaveLength(buildHeader(config).length);
  });

  it('writes the values in the right columns', () => {
    const header = buildHeader(config);
    const row = submissionToFlatRow(config, SUBMISSION);
    const at = (column: string) => row[header.indexOf(column)];
    expect(at('id')).toBe(SUBMISSION.id);
    expect(at('designation')).toBe('Head of Product Development');
    expect(at('answer_leadership')).toBe('5');
    expect(at('answer_design')).toBe('2');
    expect(at('tier_organisational_enablers')).toBe('4.073');
    expect(at('overallScore')).toBe('3.8021');
    expect(at('levelValue')).toBe('4');
    expect(at('levelName')).toBe('Established');
  });

  it('renders a missing optional name as an empty cell, not "undefined"', () => {
    const anonymous: Submission = {
      ...SUBMISSION,
      respondent: { ...SUBMISSION.respondent, name: undefined },
    };
    const header = buildHeader(config);
    const row = submissionToFlatRow(config, anonymous);
    expect(row[header.indexOf('name')]).toBe('');
    expect(toCsvRow(row)).not.toContain('undefined');
  });
});

describe('adding a factor to the config', () => {
  /** The real config with one extra Tier-2 factor, weights adjusted to still sum to 1. */
  const withExtraFactor = loadConfigFromString(
    loadConfigYamlWithExtraFactor(),
    'with-extra-factor.yaml',
  );

  it('adds exactly one column, in the new factor’s configured position', () => {
    const before = buildHeader(config);
    const after = buildHeader(withExtraFactor);

    expect(after).toHaveLength(before.length + 1);

    const added = after.filter((column) => !before.includes(column));
    expect(added).toEqual(['answer_sourcing']);

    // Position: it follows `design` and precedes `development`, as configured.
    expect(after.indexOf('answer_sourcing')).toBe(after.indexOf('answer_design') + 1);
    expect(after.indexOf('answer_development')).toBe(after.indexOf('answer_sourcing') + 1);
  });

  it('produces a row of the matching width with no code change', () => {
    const row = submissionToFlatRow(withExtraFactor, { ...SUBMISSION, answers: { ...SUBMISSION.answers, sourcing: 3 } });
    expect(row).toHaveLength(buildHeader(withExtraFactor).length);
    expect(row[buildHeader(withExtraFactor).indexOf('answer_sourcing')]).toBe('3');
  });
});

/** Reads the real conf.yaml and splices in an eighth factor between design and development. */
function loadConfigYamlWithExtraFactor(): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-only fixture read
  const { readFileSync } = require('node:fs') as typeof import('node:fs');
  const source = readFileSync('conf.yaml', 'utf8');

  const extra = `  - id: sourcing
    tier: core_operations
    name: "Sourcing"
    weight: 0.10
    question: "To what extent are digital technologies used in sourcing?"
    statements:
      1: "Sourcing is manual."
      2: "Some digital sourcing tools are used."
      3: "Digital sourcing is routine."
      4: "Sourcing is integrated with development systems."
      5: "Sourcing is continuously optimised with analytics."
    recommendations:
      1: "Digitise supplier records."
      2: "Standardise the sourcing toolset."
      3: "Integrate sourcing with development."
      4: "Add analytics to supplier selection."
      5: "Sustain this."

`;

  return source
    // make room for the new factor's weight within Tier 2: 0.40 + 0.13 + 0.37 + 0.10 = 1.00
    .replace('    weight: 0.23\n', '    weight: 0.13\n')
    .replace('  - id: development\n', `${extra}  - id: development\n`);
}
