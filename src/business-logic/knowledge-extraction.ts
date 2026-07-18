/**
 * M6.1 Knowledge Extraction Service
 *
 * Extracts structured knowledge facts from articles using Claude API.
 * Handles fact validation, confidence filtering, deduplication prep.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  KnowledgeFact,
  FactExtractionRequest,
  ExtractedFactRaw,
  FactExtractionBatch,
  CONFIDENCE_THRESHOLDS,
  validateFact,
} from './knowledge-types';

/**
 * Service for extracting knowledge facts from articles using Claude
 */
export class KnowledgeExtractionService {
  private client: Anthropic;
  private readonly MAX_TOKENS = 2048;
  private readonly CHUNK_SIZE = 8000; // Split articles >8000 chars

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Extract facts from a single article
   *
   * @param request Article data for extraction
   * @returns Batch result with extracted facts
   */
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

      const elapsedMs = Date.now() - startTime;

      return {
        article_id: request.article_id,
        facts: fullyValidFacts,
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
      model: 'claude-opus-4-1-20250805',
      max_tokens: this.MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Extract text from response
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
    return rawFacts.map((raw, index) => ({
      id: `fact_${articleId}_${Date.now()}_${index}`,
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
