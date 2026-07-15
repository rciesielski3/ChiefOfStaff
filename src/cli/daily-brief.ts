#!/usr/bin/env ts-node

import { fetchRSS } from '../business-logic/rss-fetch';
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
  {
    url: 'https://openai.com/news/rss.xml',
    name: 'OpenAI'
  },
  {
    url: 'https://blog.google/technology/ai/rss/',
    name: 'Google AI'
  },
  {
    url: 'https://blog.cloudflare.com/rss/',
    name: 'Cloudflare'
  },
  {
    url: 'https://devblogs.microsoft.com/feed/',
    name: 'Microsoft DevBlogs'
  },
  {
    url: 'https://lobste.rs/rss',
    name: 'Lobsters'
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

    // Fetch articles from all sources
    const fetchStartTime = Date.now();
    console.log('[Daily Brief] Fetching RSS feeds...');
    logStructured('FETCH_START', { sourceCount: RSS_SOURCES.length });
    const allRawArticles = [];

    for (const source of RSS_SOURCES) {
      const sourceStartTime = Date.now();
      try {
        console.log(`  - Fetching ${source.name} (${source.url})...`);
        const articles = await fetchRSS(source.url, source.name);
        const sourceDuration = Date.now() - sourceStartTime;
        console.log(`    ✓ Got ${articles.length} articles`);
        logStructured('FETCH_SOURCE_COMPLETE', {
          source: source.name,
          articleCount: articles.length,
          durationMs: sourceDuration
        });
        allRawArticles.push(...articles);
      } catch (error) {
        const sourceDuration = Date.now() - sourceStartTime;
        console.warn(
          `  ✗ Failed to fetch ${source.name}:`,
          error instanceof Error ? error.message : error
        );
        logStructured('FETCH_SOURCE_ERROR', {
          source: source.name,
          error: error instanceof Error ? error.message : String(error),
          durationMs: sourceDuration
        });
      }
    }

    const fetchDuration = Date.now() - fetchStartTime;
    console.log(`[Daily Brief] Total raw articles: ${allRawArticles.length}\n`);
    logStructured('FETCH_COMPLETE', {
      totalArticles: allRawArticles.length,
      durationMs: fetchDuration
    });

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
