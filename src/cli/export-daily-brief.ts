#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { exportDailyBrief, writeDailyBrief } from '../business-logic/export-daily-brief';
import { NdJsonArticleStore } from '../business-logic/article-store';

/**
 * CLI: Export daily brief articles to QA News data directory
 *
 * Usage: npx ts-node src/cli/export-daily-brief.ts
 *
 * Flow:
 * 1. Load ArticleStore from data/canonical_articles.ndjson
 * 2. Call exportDailyBrief(store, 10) to get top 10 articles
 * 3. Write JSON output to qa-news/data/daily-brief.json
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

async function main(): Promise<void> {
  const workflowStartTime = Date.now();
  try {
    const startTime = new Date().toISOString();
    logStructured('WORKFLOW_START', { timestamp: startTime });

    // Resolve paths relative to project root
    const projectRoot = path.resolve(__dirname, '../..');
    const storeFilePath = path.join(projectRoot, 'data/canonical_articles.ndjson');
    const outputPath = path.join(projectRoot, 'qa-news/data/daily-brief.json');

    logStructured('PATHS_RESOLVED', {
      projectRoot,
      storeFilePath,
      outputPath
    });

    // Create article store
    const storeCreateTime = Date.now();
    logStructured('STORE_INIT_START', { storeFilePath });
    const store = new NdJsonArticleStore(storeFilePath);
    const storeCreateDuration = Date.now() - storeCreateTime;
    logStructured('STORE_INIT_COMPLETE', { durationMs: storeCreateDuration });

    // Export daily brief (top 10 articles)
    const exportStartTime = Date.now();
    const exportLimit = 10;
    logStructured('EXPORT_START', { limit: exportLimit });
    const dailyBrief = await exportDailyBrief(store, exportLimit);
    const exportDuration = Date.now() - exportStartTime;
    logStructured('EXPORT_COMPLETE', {
      articleCount: dailyBrief.items.length,
      exportDate: dailyBrief.date,
      durationMs: exportDuration
    });

    // Validation: Detect empty export
    if (dailyBrief.items.length === 0) {
      console.warn('[Export Daily Brief] ⚠️  WARNING: Export produced 0 articles');
      console.warn('[Export Daily Brief] Store may be empty or not yet populated by daily-brief');
      console.warn('[Export Daily Brief] Check: data/canonical_articles.ndjson exists and has content');

      // Additional diagnostics
      try {
        const fileSize = await fs.stat(storeFilePath);
        console.warn(`[Export Daily Brief] File exists: ${fileSize.size} bytes`);
      } catch (e) {
        console.warn('[Export Daily Brief] File does not exist or cannot be read');
      }

      logStructured('VALIDATION_WARNING', {
        reason: 'empty_export',
        expectedMinArticles: 1,
        actualArticles: 0
      });
    }

    // Write to output file
    const writeStartTime = Date.now();
    logStructured('WRITE_START', { outputPath });
    await writeDailyBrief(dailyBrief, outputPath);
    const writeDuration = Date.now() - writeStartTime;
    logStructured('WRITE_COMPLETE', {
      articleCount: dailyBrief.items.length,
      filePath: outputPath,
      durationMs: writeDuration
    });

    console.log(`[Export Daily Brief] ✅ Exported daily brief to ${outputPath}`);
    console.log(`[Export Daily Brief] - Articles: ${dailyBrief.items.length}`);
    console.log(`[Export Daily Brief] - Date: ${dailyBrief.date}`);

    logStructured('WORKFLOW_COMPLETE', {
      totalDurationMs: Date.now() - workflowStartTime,
      articleCount: dailyBrief.items.length
    });

  } catch (error) {
    console.error('[Export Daily Brief] ❌ ERROR:', error instanceof Error ? error.message : error);
    logStructured('WORKFLOW_ERROR', {
      error: error instanceof Error ? error.message : String(error),
      totalDurationMs: Date.now() - workflowStartTime
    });
    process.exit(1);
  }
}

main();
