#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { exportLatestNews, LatestNewsExport } from '../business-logic/export-latest-news';
import { NdJsonArticleStore } from '../business-logic/article-store';

/**
 * CLI: Export latest articles to QA News data directory
 *
 * Usage: npx ts-node src/cli/export-latest-news.ts
 *
 * Flow:
 * 1. Load ArticleStore from data/canonical_articles.ndjson
 * 2. Call exportLatestNews(store, 50) to get top 50 articles
 * 3. Write JSON output to qa-news/data/latest-news.json
 * 4. Log status and exit
 */

// Helper function for structured logging with timestamps
function logStructured(stage: string, data: Record<string, any>): void {
  const timestamp = new Date().toISOString();
  const fields = Object.entries(data)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ');
  console.error(`[${timestamp}] [${stage}] ${fields}`);
}

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


async function main(): Promise<void> {
  const workflowStartTime = Date.now();
  try {
    const startTime = new Date().toISOString();
    logStructured('WORKFLOW_START', { timestamp: startTime });

    // Resolve paths relative to project root
    const projectRoot = path.resolve(__dirname, '../..');
    const storeFilePath = path.join(projectRoot, 'data/canonical_articles.ndjson');
    logStructured('PATHS_RESOLVED', {
      projectRoot,
      storeFilePath,
      outputDir: 'qa-news/data'
    });

    // Create article store
    const storeCreateTime = Date.now();
    logStructured('STORE_INIT_START', { storeFilePath });
    const store = new NdJsonArticleStore(storeFilePath);
    const storeCreateDuration = Date.now() - storeCreateTime;
    logStructured('STORE_INIT_COMPLETE', { durationMs: storeCreateDuration });

    // Export latest 50 articles
    const exportStartTime = Date.now();
    const exportLimit = 50;
    logStructured('EXPORT_START', { limit: exportLimit });
    const latest = await exportLatestNews(store, exportLimit);
    const exportDuration = Date.now() - exportStartTime;
    logStructured('EXPORT_COMPLETE', {
      articleCount: latest.items.length,
      exportDate: latest.date,
      durationMs: exportDuration
    });

    // Validation: Detect empty store (CRITICAL #3)
    if (latest.items.length === 0) {
      console.warn('[Export Latest News] ⚠️  WARNING: Export produced 0 articles');
      console.warn('[Export Latest News] Store may be empty or not yet populated by daily-brief');
      console.warn('[Export Latest News] Check: data/canonical_articles.ndjson exists and has content');
      logStructured('VALIDATION_FAILED', {
        reason: 'empty_export',
        expectedMinArticles: 1,
        actualArticles: 0
      });
      process.exit(1);  // Fail workflow so operators notice
    }

    // Write JSON export to qa-news/data directory
    const writeStartTime = Date.now();
    logStructured('WRITE_START', {
      articleCount: latest.items.length
    });

    // Map article categories to QA-News valid categories
    const mappedData: LatestNewsExport = {
      ...latest,
      items: latest.items.map((article) => ({
        ...article,
        category: mapCategory(article.category)
      }))
    };

    const dataPath = path.join(projectRoot, 'qa-news/data/latest-news.json');
    const jsonContent = JSON.stringify(mappedData, null, 2);

    // Ensure data directory exists
    await fs.mkdir(path.dirname(dataPath), { recursive: true });

    // Write to data directory
    await fs.writeFile(dataPath, jsonContent, 'utf-8');

    const writeDuration = Date.now() - writeStartTime;
    logStructured('WRITE_COMPLETE', {
      durationMs: writeDuration,
      dataPath
    });

    // Output JSON to stdout for workflow capture
    console.log(JSON.stringify(latest));

    const totalDuration = Date.now() - workflowStartTime;
    logStructured('WORKFLOW_COMPLETE', {
      totalDurationMs: totalDuration,
      articleCount: latest.items.length,
      dataPath
    });
  } catch (error) {
    const totalDuration = Date.now() - workflowStartTime;
    console.error('✗ Export failed:', error instanceof Error ? error.message : error);
    logStructured('WORKFLOW_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      totalDurationMs: totalDuration
    });
    process.exit(1);
  }
}

// Run main function with error handler
main().catch((error) => {
  console.error('[Export Latest News] ❌ Error:', error);
  logStructured('WORKFLOW_ERROR_UNCAUGHT', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
