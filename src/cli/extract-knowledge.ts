#!/usr/bin/env ts-node

/**
 * M6.1 Knowledge Extraction CLI
 *
 * Extracts knowledge facts from articles in the canonical store.
 * Called as an async step in the daily-brief.yml workflow.
 *
 * Environment variables:
 * - EXTRACT_COUNT: Number of top articles to extract from (default: 20)
 * - KNOWLEDGE_FACTS_PATH: Path to knowledge facts store (default: data/knowledge_facts.ndjson)
 * - ARTICLES_PATH: Path to canonical articles (default: data/canonical_articles.ndjson)
 * - ANTHROPIC_API_KEY: Claude API key (required)
 */

import path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { NdJsonArticleStore } from '../business-logic/article-store';
import { KnowledgeExtractionService } from '../business-logic/knowledge-extraction';
import { FactStore } from '../business-logic/knowledge-store';
import { FactExtractionRequest } from '../business-logic/knowledge-types';

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
    console.log('[Knowledge Extraction] Starting knowledge extraction...');
    logStructured('EXTRACTION_START', { timestamp: startTime });

    // Load configuration from environment
    const extractCount = parseInt(process.env.EXTRACT_COUNT || '20', 10);
    const articlesPath = process.env.ARTICLES_PATH || 'data/canonical_articles.ndjson';
    const knowledgeFactsPath = process.env.KNOWLEDGE_FACTS_PATH || 'data/knowledge_facts.ndjson';

    console.log(`[Knowledge Extraction] Configuration:`);
    console.log(`  - Extract from top: ${extractCount} articles`);
    console.log(`  - Articles path: ${articlesPath}`);
    console.log(`  - Knowledge facts path: ${knowledgeFactsPath}`);
    logStructured('CONFIG_LOADED', {
      extractCount,
      articlesPath,
      knowledgeFactsPath
    });
    console.log('');

    // Verify ANTHROPIC_API_KEY is set
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    // Load articles from canonical store
    const readStartTime = Date.now();
    console.log('[Knowledge Extraction] Loading articles from canonical store...');
    logStructured('READ_START', { articlesPath });

    const articlesStore = new NdJsonArticleStore(articlesPath);
    const allArticles = await articlesStore.read();
    const readDuration = Date.now() - readStartTime;

    console.log(`[Knowledge Extraction] Loaded ${allArticles.length} articles`);
    logStructured('READ_COMPLETE', {
      articleCount: allArticles.length,
      durationMs: readDuration
    });

    if (allArticles.length === 0) {
      console.warn('[Knowledge Extraction] ⚠️  No articles found in canonical store, skipping extraction');
      logStructured('EXTRACTION_SKIPPED', { reason: 'no_articles' });
      return;
    }

    // Take top N articles (sorted by score descending)
    const topArticles = allArticles.slice(0, Math.min(extractCount, allArticles.length));
    console.log(`[Knowledge Extraction] Extracting from top ${topArticles.length} articles\n`);
    logStructured('ARTICLE_SELECTION', {
      selectedCount: topArticles.length,
      totalAvailable: allArticles.length
    });

    const extractionRequests: FactExtractionRequest[] = topArticles.map(article => {
      if (!article.summary) {
        console.warn(`[Knowledge Extraction] Article ${article.id} has no summary`);
      }
      return {
        article_id: article.id,
        title: article.title,
        summary: article.summary,
        url: article.url,
        full_text: article.summary,
      };
    });

    // Extract facts from articles
    const extractionService = new KnowledgeExtractionService(process.env.ANTHROPIC_API_KEY);
    const factStore = new FactStore(knowledgeFactsPath);

    let totalFactsExtracted = 0;
    let totalFactsStored = 0;
    let totalFactsDeduplicated = 0;
    let failedExtractions = 0;

    const extractionStartTime = Date.now();
    console.log('[Knowledge Extraction] Extracting facts from articles...');
    logStructured('EXTRACTION_BATCH_START', {
      articleCount: extractionRequests.length,
      concurrency: 3
    });

    // Extract with concurrency control
    const CONCURRENCY = 3;
    for (let i = 0; i < extractionRequests.length; i += CONCURRENCY) {
      const batch = extractionRequests.slice(i, i + CONCURRENCY);
      const batchNum = Math.floor(i / CONCURRENCY) + 1;
      const totalBatches = Math.ceil(extractionRequests.length / CONCURRENCY);

      console.log(`[Knowledge Extraction] Processing batch ${batchNum}/${totalBatches}...`);

      const batchResults = await Promise.all(
        batch.map(req => extractionService.extractFacts(req))
      );

      // Store facts from this batch
      for (const result of batchResults) {
        totalFactsExtracted += result.facts.length;

        if (result.error) {
          failedExtractions++;
          console.warn(
            `  ⚠️  Error extracting from article ${result.article_id}: ${result.error}`
          );
          logStructured('EXTRACTION_ERROR', {
            article_id: result.article_id,
            error: result.error,
            extractionTimeMs: result.extraction_time_ms
          });
        } else {
          if (result.facts.length > 0) {
            const storeResult = await factStore.append(result.facts);
            totalFactsStored += storeResult.stored;
            totalFactsDeduplicated += storeResult.deduplicated;

            console.log(
              `  ✓ Article ${result.article_id}: ${result.facts.length} facts extracted ` +
              `(${storeResult.stored} stored, ${storeResult.deduplicated} deduplicated, ` +
              `${result.extraction_time_ms}ms)`
            );
            logStructured('EXTRACTION_COMPLETE', {
              article_id: result.article_id,
              factsExtracted: result.facts.length,
              factsStored: storeResult.stored,
              factsDeduplicated: storeResult.deduplicated,
              extractionTimeMs: result.extraction_time_ms
            });
          } else {
            console.log(`  - Article ${result.article_id}: no facts extracted`);
          }
        }
      }

      // Small delay between batches to respect rate limits
      if (i + CONCURRENCY < extractionRequests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    const extractionDuration = Date.now() - extractionStartTime;
    console.log('');
    logStructured('EXTRACTION_BATCH_COMPLETE', {
      articlesProcessed: extractionRequests.length,
      factsExtracted: totalFactsExtracted,
      factsStored: totalFactsStored,
      factsDeduplicated: totalFactsDeduplicated,
      failedExtractions,
      durationMs: extractionDuration
    });

    // Get statistics
    const statsStartTime = Date.now();
    console.log('[Knowledge Extraction] Computing statistics...');
    logStructured('STATS_START', {});

    const stats = await factStore.getStats();
    const statsDuration = Date.now() - statsStartTime;

    console.log('[Knowledge Extraction] Statistics:');
    console.log(`  - Total facts in store: ${stats.total}`);
    console.log(`  - Average confidence: ${stats.avgConfidence.toFixed(2)}`);
    console.log(`  - By type:`, JSON.stringify(stats.byType));
    console.log(`  - By status:`, JSON.stringify(stats.byStatus));
    console.log('');
    logStructured('STATS_COMPLETE', {
      totalFacts: stats.total,
      avgConfidence: stats.avgConfidence,
      byType: stats.byType,
      byStatus: stats.byStatus,
      durationMs: statsDuration
    });

    const totalDuration = Date.now() - workflowStartTime;
    console.log('[Knowledge Extraction] ✅ Complete!\n');
    logStructured('EXTRACTION_COMPLETE_SUMMARY', {
      totalDurationMs: totalDuration,
      articlesProcessed: extractionRequests.length,
      factsExtracted: totalFactsExtracted,
      factsStored: totalFactsStored,
      factsDeduplicated: totalFactsDeduplicated,
      failedExtractions,
      totalFactsInStore: stats.total,
      avgConfidence: stats.avgConfidence
    });
  } catch (error) {
    const totalDuration = Date.now() - workflowStartTime;
    console.error('[Knowledge Extraction] ❌ Error:', error);
    logStructured('EXTRACTION_ERROR_FATAL', {
      error: error instanceof Error ? error.message : String(error),
      totalDurationMs: totalDuration
    });
    process.exit(1);
  }
}

// Run main function with error handler
main().catch((error) => {
  console.error('[Knowledge Extraction] ❌ Uncaught error:', error);
  logStructured('EXTRACTION_ERROR_UNCAUGHT', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
