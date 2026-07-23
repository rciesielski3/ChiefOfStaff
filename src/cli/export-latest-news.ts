#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { exportLatestNews } from '../business-logic/export-latest-news';
import { NdJsonArticleStore } from '../business-logic/article-store';

/**
 * CLI: Export latest articles to QA News public API
 *
 * Usage: npx ts-node src/cli/export-latest-news.ts
 *
 * Flow:
 * 1. Load ArticleStore from data/canonical_articles.ndjson
 * 2. Call exportLatestNews(store, 50) to get top 50 articles
 * 3. Write JSON output to both qa-news/public/latest.json and qa-news/data/latest.json
 * 4. Log status and exit
 */

// Helper function for structured logging with timestamps
function logStructured(stage: string, data: Record<string, any>): void {
  const timestamp = new Date().toISOString();
  const fields = Object.entries(data)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ');
  console.log(`[${timestamp}] [${stage}] ${fields}`);
}

/**
 * Write export data to both public and data directories
 * Ensures the latest.json file exists in both locations for redundancy
 */
async function writeToDataDirs(
  projectRoot: string,
  data: any
): Promise<{ publicPath: string; dataPath: string }> {
  const publicPath = path.join(projectRoot, 'qa-news/public/latest.json');
  const dataPath = path.join(projectRoot, 'qa-news/data/latest.json');
  const jsonContent = JSON.stringify(data, null, 2);

  // Create both directories
  await fs.mkdir(path.dirname(publicPath), { recursive: true });
  await fs.mkdir(path.dirname(dataPath), { recursive: true });

  // Write to both locations
  await fs.writeFile(publicPath, jsonContent);
  await fs.writeFile(dataPath, jsonContent);

  return { publicPath, dataPath };
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
      outputDirs: 'qa-news/public and qa-news/data'
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

    // Write JSON export to both public and data directories
    const writeStartTime = Date.now();
    logStructured('WRITE_START', {
      articleCount: latest.items.length
    });
    const { publicPath, dataPath } = await writeToDataDirs(projectRoot, latest);
    const writeDuration = Date.now() - writeStartTime;
    logStructured('WRITE_COMPLETE', {
      durationMs: writeDuration,
      publicPath,
      dataPath
    });

    // Log status
    console.log(`✓ Exported ${latest.items.length} articles to:`);
    console.log(`  Public: ${publicPath}`);
    console.log(`  Data: ${dataPath}`);
    console.log(`  Date: ${latest.date}`);
    console.log(`  Updated: ${latest.updatedAt}`);

    const totalDuration = Date.now() - workflowStartTime;
    logStructured('WORKFLOW_COMPLETE', {
      totalDurationMs: totalDuration,
      articleCount: latest.items.length,
      publicPath,
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
