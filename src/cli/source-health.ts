#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { getEnabledSources } from '../config/rss-sources.config';
import { fetchRSS, filterExcludedPaths } from '../business-logic/rss-fetch';
import {
  computeSourceHealth,
  FeedCheck,
  formatSourceHealthReport,
  SourceHealthArticle,
  summarizeFeedItems,
} from '../business-logic/source-health';
import { resolveProjectRoot } from './project-root';

/**
 * CLI: Report per-source article yield over a recent window.
 *
 * Usage: npx ts-node src/cli/source-health.ts [--days N] [--now ISO] [--no-fetch]
 *
 * Reads data/canonical_articles.ndjson and prints a plain-text report to
 * stdout (warnings go to stderr). Sources with zero articles in the window
 * are fetched live, so a quiet feed can be told from a broken one; --no-fetch
 * skips that (offline use). A failed fetch is reported, not fatal: exits 0.
 * Exits 1 if the store file cannot be read, 2 on invalid flags.
 */

function parseArgs(): { days: number; now: Date; fetch: boolean } {
  const args = process.argv.slice(2);
  const valueOf = (flag: string): string | undefined => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };

  const daysArg = valueOf('--days');
  const days = daysArg === undefined ? 7 : Number(daysArg);
  if (!Number.isFinite(days) || days <= 0) {
    console.error(`[Source Health] ❌ Invalid --days value: ${daysArg}`);
    process.exit(2);
  }

  const nowArg = valueOf('--now');
  const now = nowArg === undefined ? new Date() : new Date(nowArg);
  if (Number.isNaN(now.getTime())) {
    console.error(`[Source Health] ❌ Invalid --now value: ${nowArg}`);
    process.exit(2);
  }

  return { days, now, fetch: !args.includes('--no-fetch') };
}

/** Live-fetch each source (in parallel); failures become FeedCheck data. */
async function checkFeeds(names: string[]): Promise<Map<string, FeedCheck>> {
  const sources = getEnabledSources().filter((s) => names.includes(s.name));
  const checks = await Promise.all(
    sources.map(async (source): Promise<[string, FeedCheck]> => {
      try {
        const items = filterExcludedPaths(
          await fetchRSS(source.url, source.name),
          source.excludePathPrefixes,
        );
        return [source.name, summarizeFeedItems(items)];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return [source.name, { ok: false, error: message }];
      }
    }),
  );
  return new Map(checks);
}

async function main(): Promise<void> {
  const { days, now, fetch } = parseArgs();
  const storeFilePath = path.join(resolveProjectRoot(), 'data/canonical_articles.ndjson');

  let content: string;
  try {
    content = await fs.readFile(storeFilePath, 'utf-8');
  } catch (error) {
    console.error(
      `[Source Health] ❌ Cannot read ${storeFilePath}:`,
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }

  const articles: SourceHealthArticle[] = [];
  let skipped = 0;
  for (const line of content.split('\n')) {
    if (!line.trim()) continue;
    try {
      articles.push(JSON.parse(line));
    } catch {
      skipped++;
    }
  }
  if (skipped > 0) {
    console.error(`[Source Health] ⚠️  Skipped ${skipped} unparseable line(s)`);
  }

  const enabled = getEnabledSources().map((s) => s.name);
  const report = computeSourceHealth(enabled, articles, now, days);
  const zeroSources = report.sources.filter((s) => s.count === 0).map((s) => s.source);
  const feedChecks = fetch && zeroSources.length > 0 ? await checkFeeds(zeroSources) : new Map();
  console.log(formatSourceHealthReport(report, feedChecks));
}

void main();
