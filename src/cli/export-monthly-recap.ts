#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { exportMonthlyRecap, exportMonthlyRecapWithSummaries } from '../business-logic/export-monthly-recap';
import { NdJsonArticleStore } from '../business-logic/article-store';
import { SummaryGenerator } from '../business-logic/summary-generator';

/**
 * CLI: Export monthly recaps to QA News public API
 *
 * Usage: npx ts-node src/cli/export-monthly-recap.ts
 *
 * Flow:
 * 1. Load ArticleStore from data/canonical_articles.ndjson
 * 2. Call exportMonthlyRecap(articles, 25) to group articles by month and curate to top 25
 * 3. Write to both qa-news/public/monthly.json and qa-news/data/monthly-recap.json
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

// Helper function to write export to both public and data directories
async function writeToDataDirs(projectRoot: string, exportData: any): Promise<void> {
  const publicPath = path.join(projectRoot, 'qa-news/public/monthly-recap.json');
  const dataPath = path.join(projectRoot, 'qa-news/data/monthly-recap.json');

  // Transform data for QA-News format:
  // 1. Rename monthOf to month and convert format from YYYY-MM-01 to YYYY-MM
  // 2. Add themes array (empty for now, will be populated by Task 6)
  // 3. Map article categories to valid QA-News categories
  const mappedData = {
    ...exportData,
    months: exportData.months.map((month: any) => ({
      month: month.monthOf.substring(0, 7), // Convert "2026-07-01" to "2026-07"
      summary: month.summary || '',
      themes: [], // Empty themes for now (will be populated by synthesis)
      items: month.items.map((article: any) => ({
        ...article,
        category: mapCategory(article.category)
      }))
    }))
  };

  const jsonContent = JSON.stringify(mappedData, null, 2);

  // Ensure directories exist
  await fs.mkdir(path.dirname(publicPath), { recursive: true });
  await fs.mkdir(path.dirname(dataPath), { recursive: true });

  // Write to both locations
  await Promise.all([fs.writeFile(publicPath, jsonContent), fs.writeFile(dataPath, jsonContent)]);

  logStructured('FILES_WRITTEN', {
    publicPath,
    dataPath
  });
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

    // Export monthly recaps (curate to top 25 per month)
    const curateLimit = 25;
    const exportStartTime = Date.now();
    logStructured('EXPORT_START', { exportType: 'monthly', curateLimit });
    let monthlyExport;

    // Check if ANTHROPIC_API_KEY is available for summary generation
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (apiKey) {
      logStructured('SUMMARIES_ENABLED', { });
      const summaryGenerator = new SummaryGenerator(apiKey);
      monthlyExport = await exportMonthlyRecapWithSummaries(articles, curateLimit, summaryGenerator);
    } else {
      logStructured('SUMMARIES_SKIPPED', { reason: 'ANTHROPIC_API_KEY not set' });
      monthlyExport = exportMonthlyRecap(articles, curateLimit);
    }

    const exportDuration = Date.now() - exportStartTime;
    logStructured('EXPORT_COMPLETE', {
      monthCount: monthlyExport.months.length,
      totalArticles: monthlyExport.months.reduce((sum, m) => sum + m.items.length, 0),
      durationMs: exportDuration
    });

    // Validation: Detect empty export
    if (monthlyExport.months.length === 0) {
      console.warn('[Export Monthly Recap] ⚠️  WARNING: Export produced 0 months');
      console.warn('[Export Monthly Recap] Store may be empty or not yet populated by daily-brief');
      console.warn('[Export Monthly Recap] Check: data/canonical_articles.ndjson exists and has content');
      logStructured('VALIDATION_FAILED', {
        reason: 'empty_export',
        expectedMinMonths: 1,
        actualMonths: 0
      });
      process.exit(1);
    }

    // Write export to both public and data directories
    const writeStartTime = Date.now();
    logStructured('WRITE_START', {
      monthCount: monthlyExport.months.length
    });
    await writeToDataDirs(projectRoot, monthlyExport);
    const writeDuration = Date.now() - writeStartTime;
    logStructured('WRITE_COMPLETE', { durationMs: writeDuration });

    // Output JSON to stdout for workflow capture
    console.log(JSON.stringify(monthlyExport));

    const totalDuration = Date.now() - workflowStartTime;
    logStructured('WORKFLOW_COMPLETE', {
      totalDurationMs: totalDuration,
      monthCount: monthlyExport.months.length
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
  console.error('[Export Monthly Recap] ❌ Error:', error);
  logStructured('WORKFLOW_ERROR_UNCAUGHT', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
