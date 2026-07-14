#!/usr/bin/env ts-node

import { fetchRSS } from '../business-logic/rss-fetch';
import { normalizeArticle } from '../business-logic/normalize-article';
import { scoreArticles, DEFAULT_CONFIG } from '../business-logic/score-article';
import { generateBrief, generatePlainTextBrief } from '../business-logic/generate-brief';
import { sendTelegram, sendTelegramMock } from '../business-logic/telegram';
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
 * 6. Send to Telegram (or mock if DRY_RUN enabled)
 *
 * Environment variables:
 * - TELEGRAM_BOT_TOKEN: Bot token from @BotFather
 * - TELEGRAM_CHAT_ID: Chat ID to send brief to
 * - DRY_RUN: If "true", mock send instead of real API call
 * - BRIEF_COUNT: Number of articles to include (default: 10)
 */
async function main() {
  try {
    console.log('[Daily Brief] Starting workflow...');

    // Load configuration from environment
    const botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    const chatId = process.env.TELEGRAM_CHAT_ID || '';
    const dryRun = process.env.DRY_RUN === 'true';
    const briefCount = parseInt(process.env.BRIEF_COUNT || '10', 10);

    console.log(`[Daily Brief] Configuration:`);
    console.log(`  - Dry run: ${dryRun}`);
    console.log(`  - Brief count: ${briefCount}`);
    console.log(`  - Sources: ${RSS_SOURCES.length}`);
    console.log('');

    // Fetch articles from all sources
    console.log('[Daily Brief] Fetching RSS feeds...');
    const allRawArticles = [];

    for (const source of RSS_SOURCES) {
      try {
        console.log(`  - Fetching ${source.name} (${source.url})...`);
        const articles = await fetchRSS(source.url, source.name);
        console.log(`    ✓ Got ${articles.length} articles`);
        allRawArticles.push(...articles);
      } catch (error) {
        console.warn(
          `  ✗ Failed to fetch ${source.name}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    console.log(`[Daily Brief] Total raw articles: ${allRawArticles.length}\n`);

    // Normalize articles
    console.log('[Daily Brief] Normalizing articles...');
    const articles = allRawArticles.map(normalizeArticle);
    console.log(`[Daily Brief] Normalized: ${articles.length} articles\n`);

    // Score articles
    console.log('[Daily Brief] Scoring articles...');
    const scoredArticles = scoreArticles(articles, DEFAULT_CONFIG);
    console.log(
      `[Daily Brief] Scored: ${scoredArticles.length} articles (top score: ${scoredArticles[0]?.score || 0})\n`
    );

    // Generate brief
    console.log('[Daily Brief] Generating markdown brief...');
    const markdownBrief = generateBrief(scoredArticles, briefCount);
    console.log(`[Daily Brief] Generated brief (${markdownBrief.length} chars)\n`);

    // Persist articles to canonical store (CRITICAL FIX #1)
    const storeFilePath = path.join(process.cwd(), 'data/canonical_articles.ndjson');
    const store = new NdJsonArticleStore(storeFilePath);
    await persistArticles(scoredArticles, store);
    console.log(`[Daily Brief] Persisted ${scoredArticles.length} articles to store`);

    // Send to Telegram
    console.log('[Daily Brief] Sending to Telegram...');
    if (dryRun) {
      console.log('[Daily Brief] DRY RUN - Mock send to Telegram\n');
      await sendTelegramMock(markdownBrief, botToken || 'DRY_RUN_TOKEN', chatId || '0');
    } else {
      if (!botToken || !chatId) {
        console.error(
          '[Daily Brief] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID'
        );
        console.error('              Set these environment variables to send to Telegram');
        console.error('              Or use DRY_RUN=true for mock send\n');

        // Show preview anyway
        console.log('[Daily Brief] Brief preview (first 500 chars):\n');
        console.log(markdownBrief.substring(0, 500));
        console.log('...\n');
        process.exit(0);
      }

      // Generate plain text version for better Telegram readability
      const plainText = generatePlainTextBrief(markdownBrief);
      await sendTelegram(plainText, botToken, chatId);
    }

    console.log('[Daily Brief] ✅ Complete!\n');
  } catch (error) {
    console.error('[Daily Brief] ❌ Error:', error);
    process.exit(1);
  }
}

// Run main function
main();
