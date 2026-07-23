#!/usr/bin/env ts-node

/**
 * M6.3 Knowledge Evolution CLI
 *
 * Applies evolution logic (embeddings, deduplication, versioning, sensitivity assessment)
 * to extracted facts from the daily brief workflow.
 *
 * Environment variables:
 * - INPUT_FACTS: Path to extracted facts NDJSON (default: data/knowledge_facts.ndjson)
 * - OUTPUT_FACTS: Path to evolved facts NDJSON (default: data/knowledge_facts.ndjson)
 * - EMBEDDINGS_CACHE: Path to embeddings cache (default: data/fact_embeddings.ndjson)
 */

import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { KnowledgeFact } from '../business-logic/knowledge-types';
import { extractAndEvolveKnowledge } from '../business-logic/knowledge-extraction';

// Helper function for structured logging
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
    console.log('[Knowledge Evolution] Starting knowledge evolution...');
    logStructured('EVOLUTION_START', { timestamp: startTime });

    // Load configuration from environment
    const inputPath = process.env.INPUT_FACTS || 'data/knowledge_facts.ndjson';
    const outputPath = process.env.OUTPUT_FACTS || 'data/knowledge_facts.ndjson';
    const embeddingsCachePath =
      process.env.EMBEDDINGS_CACHE || 'data/fact_embeddings.ndjson';

    console.log(`[Knowledge Evolution] Configuration:`);
    console.log(`  - Input facts path: ${inputPath}`);
    console.log(`  - Output facts path: ${outputPath}`);
    console.log(`  - Embeddings cache path: ${embeddingsCachePath}`);
    logStructured('CONFIG_LOADED', {
      inputPath,
      outputPath,
      embeddingsCachePath,
    });
    console.log('');

    // Read input facts from NDJSON
    const readStartTime = Date.now();
    console.log(`[Knowledge Evolution] Reading facts from ${inputPath}...`);
    logStructured('READ_START', { inputPath });

    if (!fs.existsSync(inputPath)) {
      throw new Error(`Input facts file not found: ${inputPath}`);
    }

    const factLines = fs
      .readFileSync(inputPath, 'utf-8')
      .split('\n')
      .filter(line => line.trim());

    const inputFacts: KnowledgeFact[] = [];
    let skippedCount = 0;

    for (let index = 0; index < factLines.length; index++) {
      try {
        const fact = JSON.parse(factLines[index]) as KnowledgeFact;
        inputFacts.push(fact);
      } catch (error) {
        skippedCount++;
        console.warn(`[Knowledge Evolution] Warning: Failed to parse fact at line ${index + 1}, skipping`);
      }
    }

    if (skippedCount > 0) {
      console.warn(`[Knowledge Evolution] ⚠️  Skipped ${skippedCount} facts due to parse errors`);
    }

    const readDuration = Date.now() - readStartTime;
    console.log(`[Knowledge Evolution] Loaded ${inputFacts.length} facts`);
    logStructured('READ_COMPLETE', {
      factCount: inputFacts.length,
      durationMs: readDuration,
    });
    console.log('');

    if (inputFacts.length === 0) {
      console.warn('[Knowledge Evolution] ⚠️  No facts found, skipping evolution');
      logStructured('EVOLUTION_SKIPPED', { reason: 'no_facts' });
      return;
    }

    // Apply evolution logic
    const evolutionStartTime = Date.now();
    console.log('[Knowledge Evolution] Applying evolution logic...');
    logStructured('EVOLUTION_BATCH_START', { factCount: inputFacts.length });

    const evolutionResults = await extractAndEvolveKnowledge(
      inputFacts,
      embeddingsCachePath
    );

    const evolutionDuration = Date.now() - evolutionStartTime;

    // Count results by action
    const dedupCount = evolutionResults.filter(
      r => r.action === 'deduplicate'
    ).length;
    const versionCount = evolutionResults.filter(
      r => r.action === 'version'
    ).length;
    const relateCount = evolutionResults.filter(
      r => r.action === 'relate'
    ).length;
    const newCount = evolutionResults.filter(r => r.action === 'new').length;

    console.log('[Knowledge Evolution] Evolution results:');
    console.log(`  - Input facts: ${inputFacts.length}`);
    if (skippedCount > 0) {
      console.log(`  - Skipped facts: ${skippedCount}`);
    }
    console.log(`  - Deduplicated: ${dedupCount}`);
    console.log(`  - Versioned: ${versionCount}`);
    console.log(`  - Related: ${relateCount}`);
    console.log(`  - New: ${newCount}`);
    console.log('');
    logStructured('EVOLUTION_BATCH_COMPLETE', {
      factsProcessed: evolutionResults.length,
      factsSkipped: skippedCount,
      deduplicateCount: dedupCount,
      versionCount,
      relateCount,
      newCount,
      durationMs: evolutionDuration,
    });

    // Write evolved facts to output NDJSON
    const writeStartTime = Date.now();
    console.log(`[Knowledge Evolution] Writing evolved facts to ${outputPath}...`);
    logStructured('WRITE_START', { outputPath });

    const evolvedFacts = evolutionResults
      .filter(r => r.fact)
      .map(r => JSON.stringify(r.fact));

    // Ensure output directory exists
    const outputDir = require('path').dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, evolvedFacts.join('\n'));

    const writeDuration = Date.now() - writeStartTime;
    const outputFactCount = evolvedFacts.length;
    console.log(
      `[Knowledge Evolution] Wrote ${outputFactCount} evolved facts to output`
    );
    logStructured('WRITE_COMPLETE', {
      factCount: outputFactCount,
      outputPath,
      durationMs: writeDuration,
    });
    console.log('');

    // Summary log
    const totalDuration = Date.now() - workflowStartTime;
    console.log('[Knowledge Evolution] ✅ Complete!');
    const summaryMsg = skippedCount > 0
      ? `✓ Evolved ${inputFacts.length} facts (Skipped: ${skippedCount}, Deduplicated: ${dedupCount}, Versioned: ${versionCount}, Related: ${relateCount}, New: ${newCount})`
      : `✓ Evolved ${inputFacts.length} facts (Deduplicated: ${dedupCount}, Versioned: ${versionCount}, Related: ${relateCount}, New: ${newCount})`;
    console.log(summaryMsg);
    console.log('');
    logStructured('EVOLUTION_COMPLETE_SUMMARY', {
      totalDurationMs: totalDuration,
      factsProcessed: inputFacts.length,
      factsSkipped: skippedCount,
      factsOutput: outputFactCount,
      deduplicateCount: dedupCount,
      versionCount,
      relateCount,
      newCount,
      evolutionRate: inputFacts.length > 0 ? ((dedupCount + versionCount) / inputFacts.length).toFixed(2) : '0.00',
    });
  } catch (error) {
    const totalDuration = Date.now() - workflowStartTime;
    console.error('[Knowledge Evolution] ❌ Error:', error);
    logStructured('EVOLUTION_ERROR_FATAL', {
      error: error instanceof Error ? error.message : String(error),
      totalDurationMs: totalDuration,
    });
    process.exit(1);
  }
}

// Run main function
main().catch(error => {
  console.error('[Knowledge Evolution] ❌ Uncaught error:', error);
  process.exit(1);
});
