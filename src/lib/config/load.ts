// Server-side only: this module reads `conf.yaml` off the filesystem.
//
// The plan suggests `import 'server-only'` here as a guard. That package is not a
// dependency of this project and adding one purely as a lint marker is not worth it,
// so the boundary is enforced by convention instead: nothing under src/components/
// imports this module, and client components receive config as props from a server
// component. See tests/access-control.test.ts for the check that keeps it honest.
import { readFileSync } from 'node:fs';
import path from 'node:path';
// js-yaml v5 is ESM with named exports only — there is no default export to import.
import { load as parseYaml } from 'js-yaml';
import { z } from 'zod';
import { configSchema, type AppConfig } from './schema';

export const CONFIG_FILENAME = 'conf.yaml';

/** Module-level cache. The config is immutable for the lifetime of the process. */
let cached: AppConfig | null = null;

function describeIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const location = issue.path.length > 0 ? issue.path.join('.') : '(root)';
      return `  • ${location}: ${issue.message}`;
    })
    .join('\n');
}

/**
 * Parse and validate a configuration document.
 *
 * Exported separately from `loadConfig` so tests can feed in fixtures without
 * touching the filesystem.
 */
export function loadConfigFromString(source: string, origin = '<string>'): AppConfig {
  let parsed: unknown;
  try {
    parsed = parseYaml(source);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${origin} is not valid YAML:\n  ${detail}`);
  }

  const result = configSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(
      `${origin} is not a valid survey configuration:\n${describeIssues(result.error)}`,
    );
  }
  return result.data;
}

/**
 * Read, validate and cache `conf.yaml` from the working directory.
 *
 * Throws on a bad config. That is deliberate: a broken configuration must fail the
 * build rather than degrade into wrong scores at runtime.
 */
export function loadConfig(): AppConfig {
  if (cached) return cached;
  const file = path.join(process.cwd(), CONFIG_FILENAME);
  let source: string;
  try {
    source = readFileSync(file, 'utf8');
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not read ${CONFIG_FILENAME} from ${process.cwd()}:\n  ${detail}`);
  }
  cached = loadConfigFromString(source, CONFIG_FILENAME);
  return cached;
}

/** Test seam: forget the cached config so the next `loadConfig()` re-reads the file. */
export function clearConfigCache(): void {
  cached = null;
}
