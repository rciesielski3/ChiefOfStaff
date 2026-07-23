#!/usr/bin/env ts-node

import * as fs from 'fs/promises';
import * as path from 'path';
import { exportWeeklyHighlights, exportWeeklyHighlightsWithSummaries, WeeklyHighlightsExport } from '../business-logic/export-weekly-highlights';
import { NdJsonArticleStore } from '../business-logic/article-store';
import { SummaryGenerator } from '../business-logic/summary-generator';

/**
 * CLI: Export weekly highlights to QA News data directory
 *
 * Usage: npx ts-node src/cli/export-weekly-highlights.ts
 *
 * Flow:
 * 1. Load ArticleStore from data/canonical_articles.ndjson
 * 2. Call exportWeeklyHighlights(articles) to group articles by week
 * 3. Write JSON output to qa-news/data/weekly-highlights.json
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

    // Write JSON export to qa-news/data/weekly-highlights.json
    const writeStartTime = Date.now();
    logStructured('WRITE_START', {
      weekCount: weeklyExport.weeks.length
    });

    // Map article categories to QA-News valid categories for data export
    const mappedData: WeeklyHighlightsExport = {
      ...weeklyExport,
      weeks: weeklyExport.weeks.map((week) => ({
        ...week,
        items: week.items.map((article) => ({
          ...article,
          category: mapCategory(article.category)
        }))
      }))
    };

    const jsonContent = JSON.stringify(mappedData, null, 2);
    const dataPath = path.join(projectRoot, 'qa-news/data/weekly-highlights.json');

    // Ensure directory exists
    await fs.mkdir(path.dirname(dataPath), { recursive: true });

    // Write to data directory
    await fs.writeFile(dataPath, jsonContent, 'utf-8');

    const writeDuration = Date.now() - writeStartTime;
    logStructured('WRITE_COMPLETE', {
      durationMs: writeDuration,
      dataPath
    });

    // Output JSON to stdout for workflow capture
    console.log(JSON.stringify(weeklyExport));

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
