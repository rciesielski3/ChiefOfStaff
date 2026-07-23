#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { exportWeeklyHighlights, exportWeeklyHighlightsWithSummaries } from '../business-logic/export-weekly-highlights';
import { NdJsonArticleStore } from '../business-logic/article-store';
import { SummaryGenerator } from '../business-logic/summary-generator';

/**
 * CLI: Export weekly highlights to QA News public API
 *
 * Usage: npx ts-node src/cli/export-weekly-highlights.ts
 *
 * Flow:
 * 1. Load ArticleStore from data/canonical_articles.ndjson
 * 2. Call exportWeeklyHighlights(articles) to group articles by week
 * 3. Write JSON output to both qa-news/public/weekly.json and qa-news/data/weekly-highlights.json
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
 * Write export data to both public and data directories
 * Ensures the weekly files exist in both locations for redundancy
 */
async function writeToDataDirs(
  projectRoot: string,
  data: any
): Promise<{ publicPath: string; dataPath: string }> {
  const publicPath = path.join(projectRoot, 'qa-news/public/weekly.json');
  const dataPath = path.join(projectRoot, 'qa-news/data/weekly-highlights.json');
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
      storeFilePath
    });

    // Create article store
    const storeCreateTime = Date.now();
    logStructured('STORE_INIT_START', { storeFilePath });
    const store = new NdJsonArticleStore(storeFilePath);
    const storeCreateDuration = Date.now() - storeCreateTime;
    logStructured('STORE_INIT_COMPLETE', { durationMs: storeCreateDuration });

    // Load articles from store
    const loadStartTime = Date.now();
    logStructured('LOAD_START', {});
    const articles = await store.read();
    const loadDuration = Date.now() - loadStartTime;
    logStructured('LOAD_COMPLETE', {
      articleCount: articles.length,
      durationMs: loadDuration
    });

    // Export weekly highlights
    const exportStartTime = Date.now();
    logStructured('EXPORT_START', { exportType: 'weekly' });
    let weeklyExport;

    // Check if ANTHROPIC_API_KEY is available for summary generation
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      logStructured('SUMMARIES_ENABLED', { });
      const summaryGenerator = new SummaryGenerator(apiKey);
      weeklyExport = await exportWeeklyHighlightsWithSummaries(articles, summaryGenerator);
    } else {
      logStructured('SUMMARIES_SKIPPED', { reason: 'ANTHROPIC_API_KEY not set' });
      weeklyExport = exportWeeklyHighlights(articles);
    }

    const exportDuration = Date.now() - exportStartTime;
    logStructured('EXPORT_COMPLETE', {
      weekCount: weeklyExport.weeks.length,
      totalArticles: weeklyExport.weeks.reduce((sum, w) => sum + w.items.length, 0),
      durationMs: exportDuration
    });

    // Validation: Detect empty export
    if (weeklyExport.weeks.length === 0) {
      console.warn('[Export Weekly Highlights] ⚠️  WARNING: Export produced 0 weeks');
      console.warn('[Export Weekly Highlights] Store may be empty or not yet populated by daily-brief');
      console.warn('[Export Weekly Highlights] Check: data/canonical_articles.ndjson exists and has content');
      logStructured('VALIDATION_FAILED', {
        reason: 'empty_export',
        expectedMinWeeks: 1,
        actualWeeks: 0
      });
      process.exit(1);
    }

    // Write JSON export to both public and data directories
    const writeStartTime = Date.now();
    logStructured('WRITE_START', {
      weekCount: weeklyExport.weeks.length
    });
    const { publicPath, dataPath } = await writeToDataDirs(projectRoot, weeklyExport);
    const writeDuration = Date.now() - writeStartTime;
    logStructured('WRITE_COMPLETE', {
      durationMs: writeDuration,
      publicPath,
      dataPath
    });

    // Log status
    console.log(`✓ Exported ${weeklyExport.weeks.length} weeks to weekly files`);
    console.log(`  Public: ${publicPath}`);
    console.log(`  Data: ${dataPath}`);

    const totalDuration = Date.now() - workflowStartTime;
    logStructured('WORKFLOW_COMPLETE', {
      totalDurationMs: totalDuration,
      weekCount: weeklyExport.weeks.length
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
  console.error('[Export Weekly Highlights] ❌ Error:', error);
  logStructured('WORKFLOW_ERROR_UNCAUGHT', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
