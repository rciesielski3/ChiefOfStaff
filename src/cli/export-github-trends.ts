#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { fetchGitHubTrends } from '../business-logic/github-trends';

/**
 * CLI: Export fast-growing QA and AI repositories from GitHub search.
 *
 * Usage: npx ts-node src/cli/export-github-trends.ts [--out <path>]
 *
 * Default output: data/github-trends.json (relative to project root).
 * Set GITHUB_TOKEN to raise the search rate limit. The token is never logged.
 * Exits non-zero on HTTP or write errors.
 */

const DEFAULT_OUT = 'data/github-trends.json';

function parseOutArg(argv: string[]): string {
  const index = argv.indexOf('--out');
  if (index === -1) return DEFAULT_OUT;
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error('--out requires a path argument');
  }
  return value;
}

async function main(): Promise<void> {
  const projectRoot = path.resolve(__dirname, '../..');
  const outPath = path.resolve(projectRoot, parseOutArg(process.argv.slice(2)));
  const token = process.env.GITHUB_TOKEN || undefined;

  console.error(`[GitHub Trends] Fetching repositories (authenticated=${token ? 'yes' : 'no'})`);
  const items = await fetchGitHubTrends({ token });

  const output = { generatedAt: new Date().toISOString(), items };
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.error(`[GitHub Trends] Wrote ${items.length} items to ${outPath}`);
}

main().catch(error => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[GitHub Trends] Export failed: ${message}`);
  process.exitCode = 1;
});
