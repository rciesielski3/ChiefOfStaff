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
 * 3. Write JSON output to qa-news/public/latest.json
 * 4. Log status and exit
 */
async function main(): Promise<void> {
  try {
    // Resolve paths relative to project root
    const projectRoot = path.resolve(__dirname, '../..');
    const storeFilePath = path.join(projectRoot, 'data/canonical_articles.ndjson');
    const outputPath = path.join(projectRoot, 'qa-news/public/latest.json');

    // Create article store
    const store = new NdJsonArticleStore(storeFilePath);

    // Export latest 50 articles
    const latest = await exportLatestNews(store, 50);

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    // Write JSON export
    await fs.writeFile(outputPath, JSON.stringify(latest, null, 2));

    // Log status
    console.log(`✓ Exported ${latest.items.length} articles to ${outputPath}`);
    console.log(`  Date: ${latest.date}`);
    console.log(`  Updated: ${latest.updatedAt}`);
  } catch (error) {
    console.error('✗ Export failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
