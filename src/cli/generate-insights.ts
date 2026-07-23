#!/usr/bin/env ts-node

/**
 * M6.4 Insight Generation CLI
 *
 * Orchestrates the complete insight generation pipeline:
 * 1. Load facts from knowledge store
 * 2. Detect patterns using semantic clustering
 * 3. Synthesize higher-level insights from patterns
 * 4. Store insights to NDJSON file
 * 5. Validate insights for quality and hallucinations
 * 6. Report metrics and validation results
 *
 * Environment variables:
 * - KNOWLEDGE_FACTS_PATH: Path to knowledge facts store (default: data/knowledge_facts.ndjson)
 * - INSIGHTS_PATH: Path to insights store (default: data/insights.ndjson)
 * - ANTHROPIC_API_KEY: Claude API key (required for embeddings)
 */

import path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { FactStore } from '../business-logic/knowledge-store';
import { PatternDetector } from '../business-logic/pattern-detector';
import { SynthesisEngine } from '../business-logic/synthesis-engine';
import { InsightStore } from '../business-logic/insight-store';
import { InsightValidator } from '../business-logic/insight-validator';
import { EmbeddingsService } from '../services/embeddings';

// Helper function for structured logging with timestamps
function logStructured(stage: string, data: Record<string, any>): void {
  const timestamp = new Date().toISOString();
  const fields = Object.entries(data)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join(' ');
  console.log(`[${timestamp}] [${stage}] ${fields}`);
}

// Helper function for verbose output
function logVerbose(message: string, verbose: boolean = false): void {
  if (verbose) {
    console.log(message);
  }
}

// Parse command line arguments
function parseArgs(): { verbose: boolean } {
  const args = process.argv.slice(2);
  return {
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
}

async function main() {
  const workflowStartTime = Date.now();
  const { verbose } = parseArgs();

  try {
    const startTime = new Date().toISOString();
    console.log('[Insight Generation] Starting insight generation pipeline...');
    logStructured('PIPELINE_START', { timestamp: startTime });

    // Load configuration from environment
    const knowledgeFactsPath = process.env.KNOWLEDGE_FACTS_PATH || 'data/knowledge_facts.ndjson';
    const insightsPath = process.env.INSIGHTS_PATH || 'data/insights.ndjson';

    console.log(`[Insight Generation] Configuration:`);
    console.log(`  - Knowledge facts path: ${knowledgeFactsPath}`);
    console.log(`  - Insights path: ${insightsPath}`);
    logVerbose(`  - Verbose mode: enabled`, verbose);
    logStructured('CONFIG_LOADED', {
      knowledgeFactsPath,
      insightsPath,
    });
    console.log('');

    // Note: ANTHROPIC_API_KEY is not required for current mock-based embeddings
    // but will be needed when real embeddings are implemented (M6.5+)
    if (!process.env.ANTHROPIC_API_KEY) {
      logVerbose('[Insight Generation] ℹ️  Note: ANTHROPIC_API_KEY not set (using mock embeddings)', verbose);
    }

    // Initialize services
    console.log('[Insight Generation] Initializing services...');
    const factStore = new FactStore(knowledgeFactsPath);
    const embeddingsService = new EmbeddingsService();
    const patternDetector = new PatternDetector(embeddingsService);
    const synthesisEngine = new SynthesisEngine();
    const insightStore = new InsightStore(insightsPath);
    const validator = new InsightValidator();
    console.log('[Insight Generation] Services initialized');
    logStructured('SERVICES_INITIALIZED', {});
    console.log('');

    // Step 1: Load facts
    console.log('[Insight Generation] Step 1: Loading facts from knowledge store...');
    const loadStartTime = Date.now();
    logStructured('FACTS_LOAD_START', { knowledgeFactsPath });

    const facts = await factStore.readAll();
    const loadDuration = Date.now() - loadStartTime;

    console.log(`[Insight Generation] Loaded ${facts.length} facts`);
    logVerbose(`  - Load time: ${loadDuration}ms`, verbose);
    logStructured('FACTS_LOAD_COMPLETE', {
      factCount: facts.length,
      durationMs: loadDuration,
    });

    if (facts.length === 0) {
      console.warn('[Insight Generation] ⚠️  No facts found in knowledge store, skipping pipeline');
      logStructured('PIPELINE_SKIPPED', { reason: 'no_facts' });
      console.log('[Insight Generation] ✅ Pipeline complete (no-op)');
      return;
    }
    console.log('');

    // Step 2: Detect patterns
    console.log('[Insight Generation] Step 2: Detecting patterns from facts...');
    const patternStartTime = Date.now();
    logStructured('PATTERN_DETECTION_START', { factCount: facts.length });

    const patterns = patternDetector.detectPatterns(facts);
    const patternDuration = Date.now() - patternStartTime;

    console.log(`[Insight Generation] Detected ${patterns.length} patterns`);
    logVerbose(`  - Pattern detection time: ${patternDuration}ms`, verbose);
    if (patterns.length > 0 && verbose) {
      console.log(`  - Pattern types: ${patterns.map(p => p.type).join(', ')}`);
    }
    logStructured('PATTERN_DETECTION_COMPLETE', {
      patternCount: patterns.length,
      durationMs: patternDuration,
    });
    console.log('');

    // Step 3: Synthesize insights
    console.log('[Insight Generation] Step 3: Synthesizing higher-level insights...');
    const synthesisStartTime = Date.now();
    logStructured('SYNTHESIS_START', { patternCount: patterns.length });

    const synthesizedInsights = synthesisEngine.synthesizeInsights(patterns, facts);
    const synthesisDuration = Date.now() - synthesisStartTime;

    console.log(`[Insight Generation] Synthesized ${synthesizedInsights.length} insights`);
    logVerbose(`  - Synthesis time: ${synthesisDuration}ms`, verbose);
    if (synthesizedInsights.length > 0 && verbose) {
      console.log(`  - Insight types: ${synthesizedInsights.map(i => i.type).join(', ')}`);
    }
    logStructured('SYNTHESIS_COMPLETE', {
      insightCount: synthesizedInsights.length,
      durationMs: synthesisDuration,
    });
    console.log('');

    // Step 4: Store insights
    console.log('[Insight Generation] Step 4: Storing insights...');
    const storeStartTime = Date.now();
    logStructured('STORAGE_START', { insightCount: synthesizedInsights.length });

    let storedCount = 0;
    for (const insight of synthesizedInsights) {
      await insightStore.add(insight);
      storedCount++;
    }

    const storeDuration = Date.now() - storeStartTime;
    console.log(`[Insight Generation] Stored ${storedCount} insights`);
    logVerbose(`  - Storage time: ${storeDuration}ms`, verbose);
    logStructured('STORAGE_COMPLETE', {
      storedCount,
      durationMs: storeDuration,
    });
    console.log('');

    // Step 5: Validate insights
    console.log('[Insight Generation] Step 5: Validating insights...');
    const validationStartTime = Date.now();
    logStructured('VALIDATION_START', { insightCount: synthesizedInsights.length });

    const allStoredInsights = await insightStore.getAllInsights();
    const validationResult = validator.validateInsights(allStoredInsights, facts);
    const validationDuration = Date.now() - validationStartTime;

    console.log('[Insight Generation] Validation Results:');
    console.log(`  - Status: ${validationResult.passed ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`  - Total insights: ${validationResult.metrics.total_count}`);
    console.log(`  - By type: ${JSON.stringify(validationResult.metrics.by_type)}`);
    console.log(
      `  - Confidence: min=${validationResult.metrics.confidence_min.toFixed(2)}, ` +
      `mean=${validationResult.metrics.confidence_mean.toFixed(2)}, ` +
      `max=${validationResult.metrics.confidence_max.toFixed(2)}`
    );
    console.log(`  - Facts per insight: ${validationResult.metrics.facts_per_insight_mean.toFixed(2)} avg`);
    console.log(`  - No hallucinations: ${validationResult.metrics.no_hallucinations ? '✓' : '✗'}`);
    console.log(`  - All valid types: ${validationResult.metrics.all_valid_types ? '✓' : '✗'}`);

    if (!validationResult.passed && validationResult.failures.length > 0) {
      console.log('  - Failures:');
      validationResult.failures.forEach(failure => {
        console.log(`    - ${failure}`);
      });
    }

    logVerbose(`  - Validation time: ${validationDuration}ms`, verbose);
    logStructured('VALIDATION_COMPLETE', {
      passed: validationResult.passed,
      totalCount: validationResult.metrics.total_count,
      failureCount: validationResult.failures.length,
      durationMs: validationDuration,
      metrics: validationResult.metrics,
    });
    console.log('');

    // Step 6: Report summary
    const totalDuration = Date.now() - workflowStartTime;
    console.log('[Insight Generation] ✅ Pipeline Complete!\n');
    logStructured('PIPELINE_COMPLETE_SUMMARY', {
      totalDurationMs: totalDuration,
      factsLoaded: facts.length,
      patternsDetected: patterns.length,
      insightsSynthesized: synthesizedInsights.length,
      insightsStored: storedCount,
      validationPassed: validationResult.passed,
      totalInsights: validationResult.metrics.total_count,
      avgConfidence: validationResult.metrics.confidence_mean,
    });

    // Exit with non-zero code if validation failed
    if (!validationResult.passed) {
      process.exit(1);
    }
  } catch (error) {
    const totalDuration = Date.now() - workflowStartTime;
    console.error('[Insight Generation] ❌ Error:', error);
    logStructured('PIPELINE_ERROR_FATAL', {
      error: error instanceof Error ? error.message : String(error),
      totalDurationMs: totalDuration,
    });
    process.exit(1);
  }
}

// Run main function with error handler
main().catch((error) => {
  console.error('[Insight Generation] ❌ Uncaught error:', error);
  logStructured('PIPELINE_ERROR_UNCAUGHT', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
