#!/usr/bin/env ts-node

/**
 * M6.1 Knowledge Extraction MVP Validation
 *
 * Validates the knowledge extraction by:
 * 1. Extracting facts from top 20 articles
 * 2. Logging extraction metrics (facts per article, confidence distribution)
 * 3. Generating sample facts for manual review
 * 4. Validating schema compliance
 * 5. Computing baseline statistics
 *
 * Usage:
 *   npx ts-node src/cli/validate-knowledge-extraction.ts
 *
 * Environment variables:
 * - EXTRACT_COUNT: Number of articles to extract from (default: 20)
 * - ANTHROPIC_API_KEY: Claude API key (required)
 */

import path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { NdJsonArticleStore } from '../business-logic/article-store';
import { KnowledgeExtractionService } from '../business-logic/knowledge-extraction';
import { FactStore } from '../business-logic/knowledge-store';
import { FactExtractionRequest, KnowledgeFact, validateFact } from '../business-logic/knowledge-types';

interface ValidationMetrics {
  articlesProcessed: number;
  factsExtracted: number;
  avgFactsPerArticle: number;
  confidenceStats: {
    min: number;
    max: number;
    mean: number;
    median: number;
    q25: number;
    q75: number;
  };
  factsByType: Record<string, number>;
  factsByDomain: Record<string, number>;
  domainConfidenceStats: {
    min: number;
    max: number;
    mean: number;
    median: number;
  };
  failedExtractions: number;
  validationErrors: number;
}

// Helper function for structured logging with timestamps
function logStructured(stage: string, data: Record<string, any>): void {
  const timestamp = new Date().toISOString();
  const fields = Object.entries(data)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ');
  console.log(`[${timestamp}] [${stage}] ${fields}`);
}

function calculateConfidenceStats(facts: KnowledgeFact[]): ValidationMetrics['confidenceStats'] {
  if (facts.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0, q25: 0, q75: 0 };
  }

  const confidences = facts.map(f => f.confidence).sort((a, b) => a - b);
  const n = confidences.length;

  // Calculate median correctly for even/odd arrays
  let median: number;
  if (n % 2 === 1) {
    // Odd: middle element
    median = confidences[Math.floor(n / 2)];
  } else {
    // Even: average of two middle elements
    median = (confidences[n / 2 - 1] + confidences[n / 2]) / 2;
  }

  return {
    min: confidences[0],
    max: confidences[n - 1],
    mean: confidences.reduce((a, b) => a + b, 0) / n,
    median,
    q25: confidences[Math.floor(n * 0.25)],
    q75: confidences[Math.floor(n * 0.75)],
  };
}

function calculateDomainConfidenceStats(facts: KnowledgeFact[]): ValidationMetrics['domainConfidenceStats'] {
  const factsWithDomain = facts.filter(f => f.domain_confidence !== undefined && f.domain_confidence !== null);
  if (factsWithDomain.length === 0) {
    return { min: 0, max: 0, mean: 0, median: 0 };
  }

  const confidences = factsWithDomain
    .map(f => f.domain_confidence!)
    .sort((a, b) => a - b);
  const n = confidences.length;

  let median: number;
  if (n % 2 === 1) {
    median = confidences[Math.floor(n / 2)];
  } else {
    median = (confidences[n / 2 - 1] + confidences[n / 2]) / 2;
  }

  return {
    min: confidences[0],
    max: confidences[n - 1],
    mean: confidences.reduce((a, b) => a + b, 0) / n,
    median,
  };
}

async function main() {
  const startTime = Date.now();

  try {
    console.log('[MVP Validation] Starting knowledge extraction validation...\n');
    logStructured('VALIDATION_START', {});

    // Check ANTHROPIC_API_KEY
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }

    const extractCount = parseInt(process.env.EXTRACT_COUNT || '20', 10);
    const articlesPath = 'data/canonical_articles.ndjson';
    const tempStorePath = '/tmp/knowledge_facts_validation.ndjson';

    // Load articles
    console.log(`[MVP Validation] Loading articles from ${articlesPath}...`);
    const articlesStore = new NdJsonArticleStore(articlesPath);
    const allArticles = await articlesStore.read();

    if (allArticles.length === 0) {
      console.warn('[MVP Validation] No articles found, skipping validation');
      return;
    }

    const topArticles = allArticles.slice(0, Math.min(extractCount, allArticles.length));
    console.log(`[MVP Validation] Loaded ${allArticles.length} articles, using top ${topArticles.length}\n`);
    logStructured('ARTICLES_LOADED', {
      totalArticles: allArticles.length,
      selectedArticles: topArticles.length
    });

    const extractionRequests: FactExtractionRequest[] = topArticles.map(article => {
      if (!article.summary) {
        console.warn(`[MVP Validation] Article ${article.id} has no summary`);
      }
      return {
        article_id: article.id,
        title: article.title,
        summary: article.summary,
        url: article.url,
        full_text: article.summary,
      };
    });

    // Extract facts with metrics collection
    console.log(`[MVP Validation] Extracting facts from ${topArticles.length} articles...\n`);
    logStructured('EXTRACTION_START', { articleCount: topArticles.length });

    const service = new KnowledgeExtractionService(process.env.ANTHROPIC_API_KEY);
    const store = new FactStore(tempStorePath);
    await store.clear(); // Start fresh for validation

    const allExtractedFacts: KnowledgeFact[] = [];
    const extractionMetrics: Array<{
      articleId: string;
      title: string;
      factsExtracted: number;
      error?: string;
      extractionTimeMs: number;
    }> = [];

    let failedExtractions = 0;

    const CONCURRENCY = 3;
    for (let i = 0; i < extractionRequests.length; i += CONCURRENCY) {
      const batch = extractionRequests.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(
        batch.map(req => service.extractFacts(req))
      );

      for (const result of batchResults) {
        const article = topArticles.find(a => a.id === result.article_id);
        const metric = {
          articleId: result.article_id,
          title: article?.title || 'Unknown',
          factsExtracted: result.facts.length,
          extractionTimeMs: result.extraction_time_ms,
          error: result.error,
        };
        extractionMetrics.push(metric);

        if (result.error) {
          failedExtractions++;
          console.log(`  ⚠️  ${metric.articleId}: ERROR - ${result.error}`);
        } else {
          allExtractedFacts.push(...result.facts);
          console.log(`  ✓ ${metric.articleId}: ${result.facts.length} facts (${result.extraction_time_ms}ms)`);
        }
      }

      if (i + CONCURRENCY < extractionRequests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('');
    logStructured('EXTRACTION_COMPLETE', {
      factsExtracted: allExtractedFacts.length,
      failedExtractions,
      articlesProcessed: extractionMetrics.length
    });

    // Validate facts
    console.log(`[MVP Validation] Validating ${allExtractedFacts.length} extracted facts...\n`);
    logStructured('VALIDATION_START', { factCount: allExtractedFacts.length });

    let validationErrors = 0;
    const validatedFacts: KnowledgeFact[] = [];

    for (const fact of allExtractedFacts) {
      const errors = validateFact(fact);
      if (errors.length > 0) {
        validationErrors++;
        console.warn(`  ✗ Validation error in fact ${fact.id}:`, errors);
        logStructured('VALIDATION_ERROR', {
          fact_id: fact.id,
          errors: errors.map(e => `${e.field}: ${e.message}`)
        });
      } else {
        validatedFacts.push(fact);
      }
    }

    console.log(`[MVP Validation] Validation complete: ${validatedFacts.length}/${allExtractedFacts.length} facts valid\n`);
    logStructured('VALIDATION_COMPLETE', {
      validFacts: validatedFacts.length,
      invalidFacts: validationErrors
    });

    // Compute metrics
    console.log(`[MVP Validation] Computing baseline statistics...\n`);
    logStructured('STATISTICS_START', {});

    const avgFactsPerArticle = allExtractedFacts.length / Math.max(extractionMetrics.length, 1);
    const factsByType: Record<string, number> = {};
    const factsByDomain: Record<string, number> = {};

    for (const fact of validatedFacts) {
      factsByType[fact.type] = (factsByType[fact.type] || 0) + 1;
      if (fact.domain) {
        factsByDomain[fact.domain] = (factsByDomain[fact.domain] || 0) + 1;
      }
    }

    const confidenceStats = calculateConfidenceStats(validatedFacts);
    const domainConfidenceStats = calculateDomainConfidenceStats(validatedFacts);

    const metrics: ValidationMetrics = {
      articlesProcessed: extractionMetrics.length,
      factsExtracted: allExtractedFacts.length,
      avgFactsPerArticle,
      confidenceStats,
      factsByType,
      factsByDomain,
      domainConfidenceStats,
      failedExtractions,
      validationErrors,
    };

    console.log('[MVP Validation] === BASELINE STATISTICS ===');
    console.log(`\nExtraction Overview:`);
    console.log(`  Articles processed: ${metrics.articlesProcessed}`);
    console.log(`  Total facts extracted: ${metrics.factsExtracted}`);
    console.log(`  Average facts per article: ${metrics.avgFactsPerArticle.toFixed(2)}`);
    console.log(`  Failed extractions: ${metrics.failedExtractions}`);
    console.log(`  Validation errors: ${metrics.validationErrors}`);

    console.log(`\nConfidence Distribution:`);
    console.log(`  Min: ${metrics.confidenceStats.min.toFixed(2)}`);
    console.log(`  Q1 (25%): ${metrics.confidenceStats.q25.toFixed(2)}`);
    console.log(`  Median: ${metrics.confidenceStats.median.toFixed(2)}`);
    console.log(`  Mean: ${metrics.confidenceStats.mean.toFixed(2)}`);
    console.log(`  Q3 (75%): ${metrics.confidenceStats.q75.toFixed(2)}`);
    console.log(`  Max: ${metrics.confidenceStats.max.toFixed(2)}`);

    console.log(`\nFacts by Type:`);
    for (const [type, count] of Object.entries(metrics.factsByType).sort()) {
      const percentage = ((count / validatedFacts.length) * 100).toFixed(1);
      console.log(`  ${type}: ${count} (${percentage}%)`);
    }

    console.log(`\nFacts by Domain:`);
    for (const [domain, count] of Object.entries(metrics.factsByDomain).sort()) {
      const percentage = ((count / validatedFacts.length) * 100).toFixed(1);
      console.log(`  ${domain}: ${count} (${percentage}%)`);
    }

    console.log(`\nDomain Classification Confidence:`);
    console.log(`  Min: ${metrics.domainConfidenceStats.min.toFixed(2)}`);
    console.log(`  Median: ${metrics.domainConfidenceStats.median.toFixed(2)}`);
    console.log(`  Mean: ${metrics.domainConfidenceStats.mean.toFixed(2)}`);
    console.log(`  Max: ${metrics.domainConfidenceStats.max.toFixed(2)}`);

    logStructured('STATISTICS_COMPLETE', {
      articlesProcessed: metrics.articlesProcessed,
      factsExtracted: metrics.factsExtracted,
      avgFactsPerArticle: metrics.avgFactsPerArticle,
      confidenceStats: metrics.confidenceStats,
      factsByType: metrics.factsByType,
      factsByDomain: metrics.factsByDomain,
      domainConfidenceStats: metrics.domainConfidenceStats
    });

    // Show sample facts for manual review
    console.log(`\n[MVP Validation] === SAMPLE FACTS FOR MANUAL REVIEW ===\n`);

    const sampleSize = Math.min(20, validatedFacts.length);
    const sampleFacts = validatedFacts.slice(0, sampleSize);

    for (let i = 0; i < sampleFacts.length; i++) {
      const fact = sampleFacts[i];
      const article = topArticles.find(a => a.id === fact.article_id);
      console.log(`\n${i + 1}. [${fact.type}] Confidence: ${fact.confidence.toFixed(2)}`);
      if (fact.domain) {
        console.log(`   Domain: ${fact.domain} (confidence: ${fact.domain_confidence?.toFixed(2) || 'N/A'})`);
      }
      console.log(`   Article: ${article?.title || 'Unknown'}`);
      console.log(`   Fact: ${fact.content}`);
      if (fact.source_text) {
        console.log(`   Source: "${fact.source_text}"`);
      }
    }

    console.log(`\n[MVP Validation] ✅ Validation complete!`);
    console.log(`\nSummary:`);
    console.log(`  - Extracted facts: ${metrics.factsExtracted}`);
    console.log(`  - Valid facts: ${validatedFacts.length}`);
    console.log(`  - Validation errors: ${metrics.validationErrors}`);
    console.log(`  - Avg confidence: ${metrics.confidenceStats.mean.toFixed(2)}`);

    const totalDuration = Date.now() - startTime;
    logStructured('VALIDATION_SUMMARY', {
      totalDurationMs: totalDuration,
      factsExtracted: metrics.factsExtracted,
      validFacts: validatedFacts.length,
      validationErrors: metrics.validationErrors,
      avgConfidence: metrics.confidenceStats.mean,
      avgFactsPerArticle: metrics.avgFactsPerArticle
    });

    // Save metrics to file for reference
    const metricsPath = 'data/extraction_metrics_baseline.json';
    await fs.writeFile(metricsPath, JSON.stringify(metrics, null, 2), 'utf-8');
    console.log(`\nBaseline metrics saved to: ${metricsPath}`);

  } catch (error) {
    console.error('[MVP Validation] ❌ Error:', error);
    logStructured('VALIDATION_ERROR_FATAL', {
      error: error instanceof Error ? error.message : String(error)
    });
    process.exit(1);
  }
}

// Run main function with error handler
main().catch((error) => {
  console.error('[MVP Validation] ❌ Uncaught error:', error);
  logStructured('VALIDATION_ERROR_UNCAUGHT', {
    error: error instanceof Error ? error.message : String(error)
  });
  process.exit(1);
});
