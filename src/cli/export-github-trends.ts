#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { resolveProjectRoot } from './project-root';
import { fetchGitHubTrends, FetchLike } from '../business-logic/github-trends';
import { Article } from '../business-logic/normalize-article';

/**
 * CLI: Export new and notable QA and AI-testing repositories from GitHub search.
 *
 * Usage: npx ts-node src/cli/export-github-trends.ts [--out <path>]
 *
 * Output path: --out, else GITHUB_TRENDS_OUT, else qa-news/public/trending.json
 * (relative paths resolve against the project root). Output shape: { generatedAt, items }.
 * Set GITHUB_TOKEN to raise the search rate limit. The token is never logged.
 *
 * All-or-nothing: every topic is fetched before anything is written, and the file is
 * replaced atomically (temp file + rename). On any error the previous file is kept and
 * the CLI exits non-zero.
 */

export const DEFAULT_TRENDS_OUT = 'qa-news/public/trending.json';

export interface GitHubTrendsExport {
  generatedAt: string;
  items: Article[];
}

export interface RunExportOptions {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  projectRoot?: string;
  now?: Date;
  fetchImpl?: FetchLike;
  log?: (message: string) => void;
}

/** Resolve the output path from --out, then GITHUB_TRENDS_OUT, then the default. */
export function resolveOutPath(argv: string[], env: NodeJS.ProcessEnv): string {
  const index = argv.indexOf('--out');
  if (index !== -1) {
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error('--out requires a path argument');
    }
    return value;
  }
  return env.GITHUB_TRENDS_OUT || DEFAULT_TRENDS_OUT;
}

/** Write the file via a sibling temp file and rename, so readers never see a partial file. */
async function writeAtomic(outPath: string, content: string): Promise<void> {
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  const tmpPath = `${outPath}.tmp`;
  try {
    await fs.writeFile(tmpPath, content, 'utf8');
    await fs.rename(tmpPath, outPath);
  } catch (error) {
    await fs.rm(tmpPath, { force: true });
    throw error;
  }
}

/** Fetch trends and write them. Returns the written path and item count. Throws on any error. */
export async function runExportGitHubTrends(
  opts: RunExportOptions = {},
): Promise<{ outPath: string; count: number }> {
  const env = opts.env ?? process.env;
  const log = opts.log ?? ((message: string) => console.error(message));
  const projectRoot = opts.projectRoot ?? resolveProjectRoot();
  const outPath = path.resolve(projectRoot, resolveOutPath(opts.argv ?? [], env));
  const token = env.GITHUB_TOKEN || undefined;

  log(`[GitHub Trends] Fetching repositories (authenticated=${token ? 'yes' : 'no'})`);
  const now = opts.now ?? new Date();
  const items = await fetchGitHubTrends({ token, now, fetchImpl: opts.fetchImpl });

  const output: GitHubTrendsExport = { generatedAt: now.toISOString(), items };
  await writeAtomic(outPath, JSON.stringify(output, null, 2) + '\n');
  log(`[GitHub Trends] Wrote ${items.length} items to ${outPath}`);
  return { outPath, count: items.length };
}

if (require.main === module) {
  runExportGitHubTrends({ argv: process.argv.slice(2) }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[GitHub Trends] Export failed, previous file kept: ${message}`);
    process.exitCode = 1;
  });
}
