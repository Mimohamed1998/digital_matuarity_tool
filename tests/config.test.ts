import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { dump as dumpYaml, load as parseYaml } from 'js-yaml';
import { loadConfig, loadConfigFromString } from '@/lib/config/load';

const REAL_CONFIG = readFileSync(path.join(process.cwd(), 'conf.yaml'), 'utf8');

/** Parse the real config, mutate it, and dump it back to YAML. */
function mutated(mutate: (doc: Record<string, unknown>) => void): string {
  const doc = parseYaml(REAL_CONFIG) as Record<string, unknown>;
  mutate(doc);
  return dumpYaml(doc);
}

type Tier = { id: string; weight: number };
type Factor = { id: string; tier: string; weight: number; statements: Record<string, string> };
type Level = { value: number; min_score: number };

describe('loadConfig', () => {
  it('loads and validates the real conf.yaml', () => {
    const config = loadConfig();
    expect(config.meta.version).toBe('1.0.0');
    expect(config.factors).toHaveLength(7);
    expect(config.tiers).toHaveLength(2);
    expect(config.maturity_levels).toHaveLength(5);
  });

  it('caches, returning the same object on a second call', () => {
    expect(loadConfig()).toBe(loadConfig());
  });
});

describe('loadConfigFromString — valid input', () => {
  it('accepts the real configuration', () => {
    const config = loadConfigFromString(REAL_CONFIG);
    expect(config.scoring.formula).toBe('weighted_sum');
    expect(config.factors.map((f) => f.id)).toEqual([
      'leadership',
      'strategy_governance',
      'people_culture',
      'technology',
      'research',
      'design',
      'development',
    ]);
  });

  it('exposes statements and recommendations keyed 1-5', () => {
    const config = loadConfigFromString(REAL_CONFIG);
    for (const factor of config.factors) {
      for (const key of ['1', '2', '3', '4', '5']) {
        expect(factor.statements[key]).toBeTruthy();
        expect(factor.recommendations[key]).toBeTruthy();
      }
    }
  });
});

describe('loadConfigFromString — rejections', () => {
  it('rejects tier weights that do not sum to 1', () => {
    const source = mutated((doc) => {
      (doc.tiers as Tier[])[0].weight = 0.9;
    });
    expect(() => loadConfigFromString(source)).toThrow(/tiers: tier weights must sum to 1\.0/);
  });

  it('rejects factor weights that do not sum to 1 within a tier', () => {
    const source = mutated((doc) => {
      (doc.factors as Factor[])[0].weight = 0.5;
    });
    expect(() => loadConfigFromString(source)).toThrow(
      /tiers\.0: factor weights within tier "organisational_enablers" must sum to 1\.0/,
    );
  });

  it('rejects a factor referring to an unknown tier', () => {
    const source = mutated((doc) => {
      (doc.factors as Factor[])[0].tier = 'no_such_tier';
    });
    expect(() => loadConfigFromString(source)).toThrow(
      /factors\.0\.tier: factor "leadership" refers to unknown tier "no_such_tier"/,
    );
  });

  it('rejects a duplicate factor id', () => {
    const source = mutated((doc) => {
      const factors = doc.factors as Factor[];
      factors[1].id = factors[0].id;
    });
    expect(() => loadConfigFromString(source)).toThrow(
      /factors\.1\.id: duplicate factor id "leadership"/,
    );
  });

  it('rejects a factor missing statement 4', () => {
    const source = mutated((doc) => {
      delete (doc.factors as Factor[])[0].statements['4'];
    });
    expect(() => loadConfigFromString(source)).toThrow(/factors\.0\.statements/);
  });

  it('rejects non-contiguous maturity bands', () => {
    const source = mutated((doc) => {
      const levels = doc.maturity_levels as Level[];
      levels[2].min_score = levels[1].min_score - 0.5;
    });
    expect(() => loadConfigFromString(source)).toThrow(
      /maturity_levels\.2\.min_score: maturity bands must ascend by min_score/,
    );
  });

  it('rejects a first maturity band that does not start at min_answer', () => {
    const source = mutated((doc) => {
      (doc.maturity_levels as Level[])[0].min_score = 0;
    });
    expect(() => loadConfigFromString(source)).toThrow(
      /maturity_levels\.0\.min_score: the first maturity band must start at scoring\.min_answer/,
    );
  });

  it('rejects a tier with no factors', () => {
    const source = mutated((doc) => {
      doc.tiers = [
        ...(doc.tiers as Tier[]),
        { id: 'orphan', name: 'Orphan', label: 'Tier 3', weight: 0, description: 'none' },
      ];
    });
    expect(() => loadConfigFromString(source)).toThrow(/tiers\.2: tier "orphan" has no factors/);
  });

  it('rejects input that is not valid YAML', () => {
    expect(() => loadConfigFromString('meta: [unclosed', 'fixture.yaml')).toThrow(
      /fixture\.yaml is not valid YAML/,
    );
  });

  it('names every offending field path in the message', () => {
    const source = mutated((doc) => {
      (doc.tiers as Tier[])[0].weight = 0.9;
      (doc.factors as Factor[])[0].tier = 'no_such_tier';
    });
    let message = '';
    try {
      loadConfigFromString(source);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain('tiers:');
    expect(message).toContain('factors.0.tier:');
  });
});
