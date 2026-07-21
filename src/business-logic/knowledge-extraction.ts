/**
 * M6.1 Knowledge Extraction Service + M6.2 Domain Classification Pipeline
 *
 * Extracts structured knowledge facts from articles using Claude API.
 * Handles fact validation, confidence filtering, domain classification (heuristic + fallback).
 */

import Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  KnowledgeFact,
  FactExtractionRequest,
  ExtractedFactRaw,
  FactExtractionBatch,
  CONFIDENCE_THRESHOLDS,
  validateFact,
} from './knowledge-types';
import { DomainClassifier, DomainClassificationResult } from './domain-classifier';
import {
  DomainClassificationFallback,
  InMemoryClassificationCache,
  ClassificationCacheStore,
  ArticleContext,
} from './domain-classification-fallback';
import { EmbeddingsService } from '../services/embeddings';
import { EvolutionEngine, Fact as EvolutionFact, EvolutionResult } from '../services/evolution-engine';
import { SensitivityAssessor } from '../services/sensitivity-assessor';

/**
 * Service for extracting knowledge facts from articles using Claude
 * Includes domain classification pipeline (heuristic + fallback)
 */
export class KnowledgeExtractionService {
  private client: Anthropic;
  private model: string;
  private readonly MAX_TOKENS = 2048;
  private readonly CHUNK_SIZE = 8000; // Split articles >8000 chars
  private readonly VALID_MODELS = [
    'claude-opus-4-8',
    'claude-opus-4-7',
    'claude-opus-4-6',
    'claude-sonnet-5',
    'claude-sonnet-4-6',
    'claude-haiku-4-5',
    'claude-3-5-sonnet-20241022',
  ];

  private domainClassifier: DomainClassifier;
  private domainFallback: DomainClassificationFallback;
  private readonly FALLBACK_CONFIDENCE_THRESHOLD = 0.60;

  constructor(
    apiKey?: string,
    model?: string,
    domainClassifierCache?: ClassificationCacheStore,
    domainFallbackCache?: ClassificationCacheStore
  ) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });

    // Validate model at initialization (default to cheapest model: Haiku 4.5)
    const configuredModel = model || process.env.CLAUDE_MODEL || 'claude-haiku-4-5';
    if (!this.VALID_MODELS.includes(configuredModel)) {
      throw new Error(
        `Invalid Claude model: ${configuredModel}. Valid models: ${this.VALID_MODELS.join(', ')}`
      );
    }
    this.model = configuredModel;

    // Initialize domain classifiers with optional caches
    this.domainClassifier = new DomainClassifier();
    this.domainFallback = new DomainClassificationFallback({
      cache: domainFallbackCache ?? new InMemoryClassificationCache(),
    });
  }

  async extractFacts(request: FactExtractionRequest): Promise<FactExtractionBatch> {
    const startTime = Date.now();

    try {
      // Split article into chunks if needed
      const chunks = this.chunkArticle(request.full_text);

      // Extract from each chunk
      const allFactsRaw: ExtractedFactRaw[] = [];
      for (let i = 0; i < chunks.length; i++) {
        const chunkFacts = await this.extractFromChunk(
          request,
          chunks[i],
          i + 1,
          chunks.length
        );
        allFactsRaw.push(...chunkFacts);
      }

      // Convert raw facts to KnowledgeFact objects
      const facts = this.convertToKnowledgeFacts(
        request.article_id,
        allFactsRaw
      );

      // Filter by confidence threshold
      const validFacts = facts.filter(fact => {
        const threshold = CONFIDENCE_THRESHOLDS[fact.type];
        return fact.confidence >= threshold;
      });

      // Validate each fact
      const fullyValidFacts: KnowledgeFact[] = [];
      for (const fact of validFacts) {
        const errors = validateFact(fact);
        if (errors.length === 0) {
          fullyValidFacts.push(fact);
        } else {
          console.warn(`Invalid fact from article ${request.article_id}:`, errors);
        }
      }

      // Classify domains for all facts (M6.2 pipeline)
      const classifiedFacts = await this.classifyFactsDomains(fullyValidFacts, request);

      const elapsedMs = Date.now() - startTime;

      return {
        article_id: request.article_id,
        facts: classifiedFacts,
        extraction_time_ms: elapsedMs,
      };
    } catch (error) {
      const elapsedMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      return {
        article_id: request.article_id,
        facts: [],
        extraction_time_ms: elapsedMs,
        error: errorMessage,
      };
    }
  }

  /**
   * Extract facts from a single chunk of text using Claude
   */
  private async extractFromChunk(
    request: FactExtractionRequest,
    chunk: string,
    chunkNum: number,
    totalChunks: number
  ): Promise<ExtractedFactRaw[]> {
    const chunkLabel = totalChunks > 1 ? ` (chunk ${chunkNum}/${totalChunks})` : '';

    const prompt = `You are an expert knowledge extraction system. Your task is to extract structured knowledge facts from an article.

ARTICLE METADATA:
- Title: ${request.title}
- URL: ${request.url}
- Summary: ${request.summary}${chunkLabel}

ARTICLE TEXT:
${chunk}

---

Extract ONLY high-confidence, durable facts that will remain true beyond this article's immediate context.

For each fact, respond with a JSON object containing:
- "content": The fact statement (50–500 chars)
- "type": One of DEFINITION, TECHNIQUE, WARNING, BENCHMARK, QUOTE, PATTERN, INSIGHT
- "confidence": 0.0–1.0 (how certain the extraction is)
- "source_text": If type is QUOTE, the exact quote; otherwise optional
- "source_location": { "section": "title"|"summary"|"body"|"url", "paragraph": 0 }

Return ONLY a JSON array, no markdown fences or extra text. Example format:
[
  {"content": "React is a JavaScript library for building UIs", "type": "DEFINITION", "confidence": 0.95},
  {"content": "Always use keys in list renders", "type": "TECHNIQUE", "confidence": 0.88}
]

Only include facts with confidence >= 0.5. Extract 3–8 facts per chunk.

FACTS:`;

    const message = await this.client.messages.create({
      model: this.model,
      max_tokens: this.MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text from response (with null check)
    if (!message.content || !message.content[0]) {
      console.warn(
        `Claude returned empty content for article ${request.article_id}${chunkLabel}`
      );
      return [];
    }

    const responseText =
      message.content[0].type === 'text' ? message.content[0].text : '';

    // Parse JSON array from response
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.warn(
          `No JSON array found in extraction response for article ${request.article_id}${chunkLabel}`
        );
        return [];
      }

      const factsRaw = JSON.parse(jsonMatch[0]) as ExtractedFactRaw[];

      // Ensure each fact has required fields
      return factsRaw.filter(fact => {
        return (
          fact.content &&
          typeof fact.content === 'string' &&
          fact.type &&
          typeof fact.confidence === 'number'
        );
      });
    } catch (error) {
      console.error(
        `Failed to parse extraction JSON for article ${request.article_id}${chunkLabel}:`,
        error
      );
      return [];
    }
  }

  /**
   * Convert raw extracted facts to KnowledgeFact objects
   */
  private convertToKnowledgeFacts(
    articleId: string,
    rawFacts: ExtractedFactRaw[]
  ): KnowledgeFact[] {
    return rawFacts.map((raw) => ({
      id: `fact_${articleId}_${randomUUID()}`,
      article_id: articleId,
      content: raw.content,
      type: raw.type,
      confidence: raw.confidence,
      extraction_method: 'claude',
      source_text: raw.source_text,
      source_location: raw.source_location,
      extracted_at: new Date().toISOString(),
      version: 1,
      status: 'active',
    }));
  }

  /**
   * Split article into chunks if it exceeds CHUNK_SIZE
   */
  private chunkArticle(text: string): string[] {
    if (text.length <= this.CHUNK_SIZE) {
      return [text];
    }

    const chunks: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      let chunk = remaining.substring(0, this.CHUNK_SIZE);

      // Try to break at sentence boundary
      const lastPeriod = chunk.lastIndexOf('.');
      if (lastPeriod > this.CHUNK_SIZE * 0.8) {
        chunk = chunk.substring(0, lastPeriod + 1);
      }

      chunks.push(chunk.trim());
      remaining = remaining.substring(chunk.length).trim();
    }

    return chunks;
  }

  /**
   * Classify facts into domains using heuristic + fallback pipeline
   * Attaches domain and domain_confidence to each fact
   */
  private async classifyFactsDomains(
    facts: KnowledgeFact[],
    request: FactExtractionRequest
  ): Promise<KnowledgeFact[]> {
    const context: ArticleContext = {
      title: request.title,
      summary: request.summary,
    };

    const classifiedFacts: KnowledgeFact[] = [];

    for (const fact of facts) {
      // Step 1: Run heuristic classifier (fast, zero cost)
      const heuristicResult = this.domainClassifier.classifyFact(fact);

      // Step 2: Use fallback if heuristic confidence is low
      let finalResult: DomainClassificationResult = heuristicResult;
      if (heuristicResult.confidence < this.FALLBACK_CONFIDENCE_THRESHOLD) {
        try {
          finalResult = await this.domainFallback.classifyAsync(
            fact,
            heuristicResult,
            context
          );
        } catch (error) {
          // If fallback fails, stick with heuristic result
          console.warn(
            `Domain fallback classification failed for fact ${fact.id}, using heuristic:`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }

      // Step 3: Attach classification to fact
      classifiedFacts.push({
        ...fact,
        domain: finalResult.domain,
        domain_confidence: finalResult.confidence,
      });
    }

    return classifiedFacts;
  }

  /**
   * Load classifier caches from disk
   * @param cachePath Path to cache file (JSON format)
   */
  async loadCacheSnapshots(cachePath: string): Promise<void> {
    try {
      if (!fs.existsSync(cachePath)) {
        console.info(`Cache file not found: ${cachePath}, starting fresh`);
        return;
      }

      const cacheData = fs.readFileSync(cachePath, 'utf-8');
      const parsed = JSON.parse(cacheData);

      // Restore fallback cache if present
      if (parsed.fallback && Array.isArray(parsed.fallback.entries)) {
        const fallbackCache = this.domainFallback.getCache() as any;
        if (
          fallbackCache &&
          typeof fallbackCache.importEntries === 'function'
        ) {
          fallbackCache.importEntries(parsed.fallback.entries);
          console.info(`Restored ${parsed.fallback.entries.length} fallback cache entries`);
        }
      }
    } catch (error) {
      console.warn(
        `Failed to load cache snapshots from ${cachePath}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Save classifier caches to disk
   * @param cachePath Path to cache file (JSON format)
   */
  async saveCacheSnapshots(cachePath: string): Promise<void> {
    try {
      const dir = path.dirname(cachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const fallbackCache = this.domainFallback.getCache() as any;
      const cacheData: any = {};

      // Export fallback cache
      if (
        fallbackCache &&
        typeof fallbackCache.exportEntries === 'function'
      ) {
        const entries = fallbackCache.exportEntries();
        cacheData.fallback = { entries };
      }

      fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
      console.info(`Saved cache snapshots to ${cachePath}`);
    } catch (error) {
      console.error(
        `Failed to save cache snapshots to ${cachePath}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Get combined cache statistics from both classifiers
   */
  getCombinedCache(): {
    fallback: {
      size: number;
      entries: Array<{ fact_id: string; result: DomainClassificationResult }>;
    };
  } {
    const fallbackCache = this.domainFallback.getCache() as any;
    const fallbackEntries =
      fallbackCache && typeof fallbackCache.exportEntries === 'function'
        ? fallbackCache.exportEntries()
        : [];

    return {
      fallback: {
        size: fallbackEntries.length,
        entries: fallbackEntries,
      },
    };
  }
}

/**
 * Batch extract facts from multiple articles
 */
export async function extractFactsBatch(
  requests: FactExtractionRequest[],
  concurrency: number = 3
): Promise<FactExtractionBatch[]> {
  const service = new KnowledgeExtractionService();
  const results: FactExtractionBatch[] = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < requests.length; i += concurrency) {
    const batch = requests.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(req => service.extractFacts(req))
    );
    results.push(...batchResults);

    // Add small delay between batches
    if (i + concurrency < requests.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  return results;
}

/**
 * M6.3 Knowledge Evolution Pipeline
 *
 * Applies evolution logic (embeddings, deduplication, versioning, sensitivity assessment)
 * to extracted facts.
 *
 * @param facts Extracted facts to evolve
 * @param embeddingsCachePath Optional path to embeddings cache
 * @returns Array of evolution results with evolved facts
 */
export async function extractAndEvolveKnowledge(
  facts: KnowledgeFact[],
  embeddingsCachePath?: string
): Promise<EvolutionResult[]> {
  const embeddingsService = new EmbeddingsService();
  await embeddingsService.loadModel();

  const evolutionEngine = new EvolutionEngine(embeddingsService);
  const sensitivityAssessor = new SensitivityAssessor();

  // Load embeddings cache if it exists
  const cacheDir = embeddingsCachePath || 'data/fact_embeddings.ndjson';
  if (fs.existsSync(cacheDir)) {
    embeddingsService.loadCacheFromNDJSON(cacheDir);
  }

  const allResults: EvolutionResult[] = [];

  // Process each fact through the evolution pipeline
  for (const fact of facts) {
    // Skip INSIGHT type facts (not supported by evolution engine)
    if (fact.type === 'INSIGHT') {
      allResults.push({
        action: 'new',
        fact: fact as any, // Cast is safe for skipped types
      });
      continue;
    }

    // Convert KnowledgeFact to EvolutionFact for the evolution engine
    const evolutionFact: EvolutionFact = {
      id: fact.id,
      article_id: fact.article_id,
      content: fact.content,
      type: fact.type as any, // Safe cast after INSIGHT filter
      confidence: fact.confidence,
      extracted_at: fact.extracted_at,
      sensitivity: 'PUBLIC', // Will be updated by sensitivity assessor
      version: fact.version,
    };

    // Process through evolution engine
    const evolutionResult = evolutionEngine.processNewFact(evolutionFact);

    // Apply sensitivity assessment if fact was not filtered out
    if (evolutionResult.fact) {
      const sensitivityResult = await sensitivityAssessor.assessFact({
        id: evolutionResult.fact.id,
        content: evolutionResult.fact.content,
        type: evolutionResult.fact.type,
      });

      evolutionResult.fact.sensitivity = sensitivityResult.sensitivity;
    }

    allResults.push(evolutionResult);
  }

  // Save embeddings cache for next run
  embeddingsService.saveCacheToNDJSON(cacheDir);

  return allResults;
}
