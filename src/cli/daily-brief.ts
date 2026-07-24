#!/usr/bin/env ts-node

import { fetchAllSources } from '../business-logic/rss-fetch';
import { normalizeArticle } from '../business-logic/normalize-article';
import { scoreArticles, DEFAULT_CONFIG } from '../business-logic/score-article';
import { generateBrief } from '../business-logic/generate-brief';
import { NdJsonArticleStore } from '../business-logic/article-store';
import { persistArticles } from '../business-logic/persist-articles';
import path from 'path';

/**
 * RSS sources to fetch from
 * Maps to Config Tech workflow configuration
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
 * Main CLI entry point for Daily Brief generation
 *
 * Algorithm:
 * 1. Fetch articles from all RSS sources
 * 2. Normalize articles to standard format
 * 3. Score articles based on keywords and configuration
 * 4. Select top N articles
 * 5. Generate markdown brief
 * 6. Persist articles to the canonical NDJSON store
 *
 * This CLI does NOT send Telegram notifications. Telegram delivery is
 * handled separately by the notify.yml GitHub Actions workflow, which is
 * triggered after this workflow (daily-brief.yml) completes.
 *
 * Environment variables:
 * - BRIEF_COUNT: Number of articles to include (default: 10)
 */

// Helper function for structured logging with timestamps
function logStructured(stage: string, data: Record<string, any>): void {
  const timestamp = new Date().toISOString();
  const fields = Object.entries(data)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ');
  console.log(`[${timestamp}] [${stage}] ${fields}`);
}

async function main() {
  const workflowStartTime = Date.now();
  try {
    const startTime = new Date().toISOString();
    console.log('[Daily Brief] Starting workflow...');
    logStructured('WORKFLOW_START', { timestamp: startTime });

    // Load configuration from environment
    const briefCount = parseInt(process.env.BRIEF_COUNT || '10', 10);

    console.log(`[Daily Brief] Configuration:`);
    console.log(`  - Brief count: ${briefCount}`);
    console.log(`  - Sources: ${RSS_SOURCES.length}`);
    logStructured('CONFIG_LOADED', {
      briefCount,
      sourceCount: RSS_SOURCES.length
    });
    console.log('');

    // Fetch articles from all sources. Per-source failures (network error,
    // non-2xx status, parse error) are isolated inside fetchAllSources — a
    // bad source is skipped so the remaining sources still get fetched.
    const fetchStartTime = Date.now();
    console.log('[Daily Brief] Fetching RSS feeds...');
    logStructured('FETCH_START', { sourceCount: RSS_SOURCES.length });

    const {
      articles: allRawArticles,
      results: fetchResults,
      successCount,
      failureCount
    } = await fetchAllSources(RSS_SOURCES);

    const fetchDuration = Date.now() - fetchStartTime;
    console.log(`[Daily Brief] Total raw articles: ${allRawArticles.length}\n`);
    logStructured('FETCH_COMPLETE', {
      totalArticles: allRawArticles.length,
      durationMs: fetchDuration
    });

    // Report fetch summary: how many sources succeeded/failed and total
    // articles fetched, so a partial-failure run is easy to spot in logs.
    console.log('[Daily Brief] RSS Fetch Summary:');
    console.log(`  - Successful sources: ${successCount}/${RSS_SOURCES.length}`);
    if (failureCount > 0) {
      console.log(`  - Failed sources: ${failureCount}/${RSS_SOURCES.length}`);
      fetchResults
        .filter(r => !r.success)
        .forEach(r => {
          console.log(`    - ${r.source}: ${r.error}`);
        });
    }
    console.log(`  - Total articles fetched: ${allRawArticles.length}\n`);
    logStructured('FETCH_SUMMARY', {
      successCount,
      failureCount,
      totalSources: RSS_SOURCES.length,
      totalArticles: allRawArticles.length
    });

    // Only genuine total failure (no articles from any source) short-circuits
    // the workflow — even then it exits 0 so the GitHub Actions run isn't
    // marked as failed for what is a transient upstream issue.
    if (allRawArticles.length === 0) {
      console.warn('[Daily Brief] ⚠️  No articles fetched from any source');
      logStructured('WORKFLOW_COMPLETE_NO_ARTICLES', {
        totalDurationMs: Date.now() - workflowStartTime
      });
      process.exit(0);
    }

    // Normalize articles
    const normalizeStartTime = Date.now();
    console.log('[Daily Brief] Normalizing articles...');
    logStructured('NORMALIZE_START', { articleCount: allRawArticles.length });
    const articles = allRawArticles.map(normalizeArticle);
    const normalizeDuration = Date.now() - normalizeStartTime;
    console.log(`[Daily Brief] Normalized: ${articles.length} articles\n`);
    logStructured('NORMALIZE_COMPLETE', {
      articleCount: articles.length,
      durationMs: normalizeDuration
    });

    // Score articles
    const scoreStartTime = Date.now();
    console.log('[Daily Brief] Scoring articles...');
    logStructured('SCORE_START', { articleCount: articles.length });
    const scoredArticles = scoreArticles(articles, DEFAULT_CONFIG);
    const scoreDuration = Date.now() - scoreStartTime;
    const topScore = scoredArticles[0]?.score || 0;
    console.log(
      `[Daily Brief] Scored: ${scoredArticles.length} articles (top score: ${topScore})\n`
    );
    logStructured('SCORE_COMPLETE', {
      articleCount: scoredArticles.length,
      topScore,
      durationMs: scoreDuration
    });

    // Generate brief
    const generateStartTime = Date.now();
    console.log('[Daily Brief] Generating markdown brief...');
    logStructured('GENERATE_START', {
      articleCount: scoredArticles.length,
      briefCount
    });
    const markdownBrief = generateBrief(scoredArticles, briefCount);
    const generateDuration = Date.now() - generateStartTime;
    console.log(`[Daily Brief] Generated brief (${markdownBrief.length} chars)\n`);
    logStructured('GENERATE_COMPLETE', {
      briefLength: markdownBrief.length,
      durationMs: generateDuration
    });

    // Persist articles to canonical store (CRITICAL FIX #1)
    const persistStartTime = Date.now();
    const storeFilePath = path.join(process.cwd(), 'data/canonical_articles.ndjson');
    logStructured('PERSIST_START', {
      articleCount: scoredArticles.length,
      storeFilePath
    });
    const store = new NdJsonArticleStore(storeFilePath);
    await persistArticles(scoredArticles, store);
    const persistDuration = Date.now() - persistStartTime;
    console.log(`[Daily Brief] Persisted ${scoredArticles.length} articles to store`);
    logStructured('PERSIST_COMPLETE', {
      articleCount: scoredArticles.length,
      durationMs: persistDuration
    });

    // Telegram notifications are now handled by the notify.yml workflow
    // which is triggered when this workflow completes.
    // The CLI no longer sends Telegram messages directly - it only persists articles.
    console.log('[Daily Brief] Telegram notifications are handled by notify.yml workflow');
    logStructured('TELEGRAM_SKIPPED', {
      reason: 'delegated_to_notify_workflow',
      info: 'Notifications are sent by notify.yml after this workflow completes'
    });

    const totalDuration = Date.now() - workflowStartTime;
    console.log('[Daily Brief] ✅ Complete!\n');
    logStructured('WORKFLOW_COMPLETE', {
      totalDurationMs: totalDuration,
      articlesFetched: allRawArticles.length,
      articlesScored: scoredArticles.length,
      briefGenerated: true
    });
  } catch (error) {
    const totalDuration = Date.now() - workflowStartTime;
    console.error('[Daily Brief] ❌ Error:', error);
    logStructured('WORKFLOW_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      totalDurationMs: totalDuration
    });
    process.exit(1);
  }
}

// Run main function with error handler
main().catch((error) => {
  console.error('[Daily Brief] ❌ Error:', error);
  logStructured('WORKFLOW_ERROR_UNCAUGHT', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
