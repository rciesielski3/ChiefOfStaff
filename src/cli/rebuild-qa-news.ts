#!/usr/bin/env ts-node

import { fetchRSS } from '../business-logic/rss-fetch';
import { normalizeArticle } from '../business-logic/normalize-article';
import { scoreArticles, DEFAULT_CONFIG } from '../business-logic/score-article';
import { exportLatestNews, LatestNewsExport } from '../business-logic/export-latest-news';
import { exportWeeklyHighlights } from '../business-logic/export-weekly-highlights';
import { exportMonthlyRecap } from '../business-logic/export-monthly-recap';
import { NdJsonArticleStore } from '../business-logic/article-store';
import { AtomicFileWriter } from '../business-logic/atomic-file-writer';
import * as path from 'path';
import * as fs from 'fs/promises';

/**
 * RSS sources for QA News rebuild
 * Same 8 sources as daily-brief workflow
 */
const RSS_SOURCES = [
  // Tier 1: QA & Test Automation (PRIMARY FOCUS - 6 sources)
  {
    url: 'https://www.ministryoftesting.com/contents/rss',
    name: 'Ministry of Testing'
  },
  {
    url: 'https://testing.googleblog.com/feeds/posts/default',
    name: 'Google Testing Blog'
  },
  {
    url: 'https://feed.infoq.com/',
    name: 'InfoQ'
  },
  {
    url: 'https://martinfowler.com/feed.atom',
    name: 'Martin Fowler'
  },
  {
    url: 'https://cypress.io/blog/rss',
    name: 'Cypress'
  },
  {
    url: 'https://github.com/microsoft/playwright/releases.atom',
    name: 'Playwright'
  },
  // Context & Updates (2 sources - lower priority)
  {
    url: 'https://openai.com/news/rss.xml',
    name: 'OpenAI'
  },
  {
    url: 'https://blog.cloudflare.com/rss/',
    name: 'Cloudflare'
  }
];

/**
 * CLI: Rebuild QA News data by re-fetching RSS feeds and regenerating exports
 *
 * Usage: npx ts-node src/cli/rebuild-qa-news.ts [--verbose]
 *
 * Flags:
 * - --verbose: Log detailed progress information
 *
 * Flow:
 * 1. Fetch articles from all 8 RSS sources
 * 2. Normalize articles
 * 3. Score articles
 * 4. Export latest-news.json (top 50)
 * 5. Export weekly-highlights.json (grouped by week)
 * 6. Export monthly-recap.json (grouped by month, top 25 each)
 * 7. Write all exports to qa-news/data/ directory
 * 8. Exit with code 0 on success, 1 on failure
 */

/**
 * Map article categories to QA-News valid categories
 * QA-News only accepts: 'test-automation' | 'ai' | 'engineering' | 'qa-practice' | 'tooling'
 */
function mapCategory(category: string): string {
  const categoryMap: Record<string, string> = {
    'test-automation': 'test-automation',
    'ai': 'ai',
    'engineering': 'engineering',
    'qa-practice': 'qa-practice',
    'tooling': 'tooling',
    'news': 'test-automation',
    'article': 'engineering',
    'release': 'tooling',
    'tutorial': 'qa-practice',
  };
  return categoryMap[category] || 'test-automation';
}

// Helper function for structured logging with timestamps
function logStructured(stage: string, data: Record<string, any>): void {
  const timestamp = new Date().toISOString();
  const fields = Object.entries(data)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ');
  console.log(`[${timestamp}] [${stage}] ${fields}`);
}

async function main(): Promise<void> {
  const workflowStartTime = Date.now();
  const verbose = process.argv.includes('--verbose');

  try {
    const startTime = new Date().toISOString();
    if (verbose) {
      console.log('[Rebuild QA News] Starting rebuild workflow...');
    }
    logStructured('WORKFLOW_START', {
      timestamp: startTime,
      verbose
    });

    if (verbose) {
      console.log(`[Rebuild QA News] Configuration:`);
      console.log(`  - Sources: ${RSS_SOURCES.length}`);
      console.log(`  - Verbose: ${verbose}`);
    }
    logStructured('CONFIG_LOADED', {
      sourceCount: RSS_SOURCES.length,
      verbose
    });

    // Fetch articles from all sources
    const fetchStartTime = Date.now();
    if (verbose) {
      console.log('[Rebuild QA News] Fetching RSS feeds...');
    }
    logStructured('FETCH_START', { sourceCount: RSS_SOURCES.length });
    const allRawArticles = [];

    for (const source of RSS_SOURCES) {
      const sourceStartTime = Date.now();
      try {
        if (verbose) {
          console.log(`  - Fetching ${source.name} (${source.url})...`);
        }
        const articles = await fetchRSS(source.url, source.name);
        const sourceDuration = Date.now() - sourceStartTime;
        if (verbose) {
          console.log(`    ✓ Got ${articles.length} articles`);
        }
        logStructured('FETCH_SOURCE_COMPLETE', {
          source: source.name,
          articleCount: articles.length,
          durationMs: sourceDuration
        });
        allRawArticles.push(...articles);
      } catch (error) {
        const sourceDuration = Date.now() - sourceStartTime;
        if (verbose) {
          console.warn(
            `  ✗ Failed to fetch ${source.name}:`,
            error instanceof Error ? error.message : error
          );
        }
        logStructured('FETCH_SOURCE_ERROR', {
          source: source.name,
          error: error instanceof Error ? error.message : String(error),
          durationMs: sourceDuration
        });
      }
    }

    const fetchDuration = Date.now() - fetchStartTime;
    if (verbose) {
      console.log(`[Rebuild QA News] Total raw articles: ${allRawArticles.length}\n`);
    }
    logStructured('FETCH_COMPLETE', {
      totalArticles: allRawArticles.length,
      durationMs: fetchDuration
    });

    // Normalize articles
    const normalizeStartTime = Date.now();
    if (verbose) {
      console.log('[Rebuild QA News] Normalizing articles...');
    }
    logStructured('NORMALIZE_START', { articleCount: allRawArticles.length });
    const articles = allRawArticles.map(normalizeArticle);
    const normalizeDuration = Date.now() - normalizeStartTime;
    if (verbose) {
      console.log(`[Rebuild QA News] Normalized: ${articles.length} articles\n`);
    }
    logStructured('NORMALIZE_COMPLETE', {
      articleCount: articles.length,
      durationMs: normalizeDuration
    });

    // Score articles
    const scoreStartTime = Date.now();
    if (verbose) {
      console.log('[Rebuild QA News] Scoring articles...');
    }
    logStructured('SCORE_START', { articleCount: articles.length });
    const scoredArticles = scoreArticles(articles, DEFAULT_CONFIG);
    const scoreDuration = Date.now() - scoreStartTime;
    const topScore = scoredArticles[0]?.score || 0;
    if (verbose) {
      console.log(
        `[Rebuild QA News] Scored: ${scoredArticles.length} articles (top score: ${topScore})\n`
      );
    }
    logStructured('SCORE_COMPLETE', {
      articleCount: scoredArticles.length,
      topScore,
      durationMs: scoreDuration
    });

    // Export latest, weekly, monthly
    const exportStartTime = Date.now();
    if (verbose) {
      console.log('[Rebuild QA News] Exporting articles...');
    }
    logStructured('EXPORT_START', { articleCount: scoredArticles.length });

    const projectRoot = path.resolve(__dirname, '../..');
    const latestExport = await exportLatestNews(
      new NdJsonArticleStore(path.join(projectRoot, 'data/canonical_articles.ndjson')),
      50
    );
    const weeklyExport = exportWeeklyHighlights(scoredArticles);
    const monthlyExport = exportMonthlyRecap(scoredArticles, 25);

    const exportDuration = Date.now() - exportStartTime;
    if (verbose) {
      console.log(`[Rebuild QA News] Generated exports in ${exportDuration}ms`);
      console.log(`  - latest.json: ${latestExport.items.length} articles`);
      console.log(`  - weekly.json: ${weeklyExport.weeks.length} weeks`);
      console.log(`  - monthly.json: ${monthlyExport.months.length} months\n`);
    }
    logStructured('EXPORT_COMPLETE', {
      latestArticles: latestExport.items.length,
      weekCount: weeklyExport.weeks.length,
      monthCount: monthlyExport.months.length,
      durationMs: exportDuration
    });

    // Write exports to qa-news/data/ directory
    const writeStartTime = Date.now();
    if (verbose) {
      console.log('[Rebuild QA News] Writing exports...');
    }
    logStructured('WRITE_START', {
      latestArticles: latestExport.items.length,
      weekCount: weeklyExport.weeks.length,
      monthCount: monthlyExport.months.length
    });

    // Map article categories for latest export
    const mappedLatestExport: LatestNewsExport = {
      ...latestExport,
      items: latestExport.items.map((article) => ({
        ...article,
        category: mapCategory(article.category)
      }))
    };

    const dataDir = path.join(projectRoot, 'qa-news/data');
    const latestPath = path.join(dataDir, 'latest-news.json');
    const weeklyPath = path.join(dataDir, 'weekly-highlights.json');
    const monthlyPath = path.join(dataDir, 'monthly-recap.json');

    // Ensure data directory exists
    await fs.mkdir(dataDir, { recursive: true });

    // Write files to data directory
    await fs.writeFile(latestPath, JSON.stringify(mappedLatestExport, null, 2), 'utf-8');
    await fs.writeFile(weeklyPath, JSON.stringify(weeklyExport, null, 2), 'utf-8');
    await fs.writeFile(monthlyPath, JSON.stringify(monthlyExport, null, 2), 'utf-8');

    const writeDuration = Date.now() - writeStartTime;
    if (verbose) {
      console.log(`[Rebuild QA News] ✓ Wrote exports in ${writeDuration}ms`);
      console.log(`  - ${latestPath}`);
      console.log(`  - ${weeklyPath}`);
      console.log(`  - ${monthlyPath}\n`);
    }
    logStructured('WRITE_COMPLETE', {
      latestPath,
      weeklyPath,
      monthlyPath,
      durationMs: writeDuration
    });

    const totalDuration = Date.now() - workflowStartTime;
    if (verbose) {
      console.log('[Rebuild QA News] ✅ Rebuild complete!\n');
    }
    logStructured('WORKFLOW_COMPLETE', {
      totalDurationMs: totalDuration,
      articlesFetched: allRawArticles.length,
      articlesScored: scoredArticles.length,
      latestExported: latestExport.items.length,
      weeksExported: weeklyExport.weeks.length,
      monthsExported: monthlyExport.months.length
    });
  } catch (error) {
    const totalDuration = Date.now() - workflowStartTime;
    console.error('[Rebuild QA News] ❌ Error:', error);
    logStructured('WORKFLOW_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      totalDurationMs: totalDuration
    });
    process.exit(1);
  }
}

// Run main function with error handler
main().catch((error) => {
  console.error('[Rebuild QA News] ❌ Error:', error);
  logStructured('WORKFLOW_ERROR_UNCAUGHT', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
