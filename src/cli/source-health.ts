#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { getEnabledSources } from '../config/rss-sources.config';
import {
  computeSourceHealth,
  formatSourceHealthReport,
  SourceHealthArticle,
} from '../business-logic/source-health';

/**
 * CLI: Report per-source article yield over a recent window.
 *
 * Usage: npx ts-node src/cli/source-health.ts [--days N] [--now ISO]
 *
 * Reads data/canonical_articles.ndjson and prints a plain-text report to
 * stdout (warnings go to stderr). Exits 1 if the file cannot be read, 2 on
 * invalid flags.
 */

function parseArgs(): { days: number; now: Date } {
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

  return { days, now };
}

async function main(): Promise<void> {
  const { days, now } = parseArgs();
  const projectRoot = path.resolve(__dirname, '../..');
  const storeFilePath = path.join(projectRoot, 'data/canonical_articles.ndjson');

  let content: string;
  try {
    content = await fs.readFile(storeFilePath, 'utf-8');
  } catch (error) {
    console.error(
      `[Source Health] ❌ Cannot read ${storeFilePath}:`,
      error instanceof Error ? error.message : error
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
  console.log(formatSourceHealthReport(report));
}

main();
