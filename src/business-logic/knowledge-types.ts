/**
 * M6.1 Knowledge Extraction — Type Definitions
 *
 * Defines the schema for knowledge facts extracted from articles.
 * See /docs/knowledge/schema.md for detailed specification.
 */

/**
 * Semantic classification of knowledge facts
 */
export type FactType =
  | 'DEFINITION'   // Explains what something is
  | 'TECHNIQUE'    // How-to or best practice
  | 'WARNING'      // Important caution or risk
  | 'BENCHMARK'    // Measurable metric or data
  | 'QUOTE'        // Direct quotation
  | 'PATTERN'      // Trend or recurring relationship
  | 'INSIGHT';     // Synthesized analysis

/**
 * Lifecycle status of a fact
 */
export type FactStatus = 'active' | 'superseded' | 'deprecated';

/**
 * Types of insights generated from cross-article analysis
 */
export type InsightType =
  | 'TREND'         // Multiple articles point to emerging pattern
  | 'CONTRADICTION' // Conflicting claims across articles
  | 'SYNTHESIS'     // Combining facts from N articles into new understanding
  | 'BENCHMARK'     // Repeated measurements/metrics over time
  | 'ALERT';        // Unusual/surprising finding

/**
 * Method used to extract the fact
 */
export type ExtractionMethod = 'claude' | 'manual';

/**
 * Source location metadata for citation
 */
export interface SourceLocation {
  section?: 'title' | 'summary' | 'body' | 'url';
  paragraph?: number;
}

/**
 * A knowledge fact extracted from an article
 *
 * Represents a durable, reusable piece of information with:
 * - Semantic classification (DEFINITION, TECHNIQUE, etc.)
 * - Confidence scoring (0.0–1.0)
 * - Source attribution and citation
 * - Versioning and lifecycle tracking
 */
export interface KnowledgeFact {
  // Unique identifier
  id: string;

  // Source article reference
  article_id: string;

  // Fact content
  content: string;                           // The actual fact text (50–500 chars)
  type: FactType;                            // Semantic classification

  // Confidence and quality
  confidence: number;                        // 0.0–1.0, extraction certainty
  extraction_method: ExtractionMethod;       // How was this fact extracted

  // Citations
  source_text?: string;                      // Exact quote from article (QUOTE type)
  source_location?: SourceLocation;          // Location within article

  // Metadata (filled by M6.2+)
  domain?: string;                           // Domain classification (e.g., "ai-ml", "infrastructure")
  domain_confidence?: number;                // Domain classification confidence (0.0–1.0)
  keywords?: string[];                       // Key terms for searchability

  // Timestamps and versioning
  extracted_at: string;                      // ISO timestamp
  version: number;                           // Version number, incremented on updates
  superseded_by?: string;                    // ID of fact that replaces this one
  status: FactStatus;                        // Lifecycle status
}

/**
 * Request object for fact extraction
 */
export interface FactExtractionRequest {
  article_id: string;
  title: string;
  summary: string;
  url: string;
  full_text: string;  // Article body for extraction
}

/**
 * Response from Claude API during fact extraction
 */
export interface ExtractedFactRaw {
  content: string;
  type: FactType;
  confidence: number;
  source_text?: string;
  source_location?: SourceLocation;
}

/**
 * Batch extraction result
 */
export interface FactExtractionBatch {
  article_id: string;
  facts: KnowledgeFact[];
  extraction_time_ms: number;
  error?: string;
}

/**
 * Confidence thresholds by fact type (minimum to include in KB)
 */
export const CONFIDENCE_THRESHOLDS: Record<FactType, number> = {
  'DEFINITION': 0.90,
  'TECHNIQUE': 0.80,
  'WARNING': 0.95,
  'BENCHMARK': 0.85,
  'QUOTE': 1.00,
  'PATTERN': 0.75,
  'INSIGHT': 0.70,
};

/**
 * Check if a fact meets the confidence threshold for its type
 */
export function meetsConfidenceThreshold(fact: KnowledgeFact): boolean {
  const threshold = CONFIDENCE_THRESHOLDS[fact.type];
  return fact.confidence >= threshold;
}

/**
 * Validate a knowledge fact for storage
 */
export interface FactValidationError {
  field: string;
  message: string;
}

export function validateFact(fact: KnowledgeFact): FactValidationError[] {
  const errors: FactValidationError[] = [];

  if (!fact.id || fact.id.length === 0) {
    errors.push({ field: 'id', message: 'ID is required and cannot be empty' });
  }

  if (!fact.article_id || fact.article_id.length === 0) {
    errors.push({ field: 'article_id', message: 'Article ID is required' });
  }

  if (!fact.content || fact.content.length < 50 || fact.content.length > 500) {
    errors.push({ field: 'content', message: 'Content must be 50–500 characters' });
  }

  if (!['DEFINITION', 'TECHNIQUE', 'WARNING', 'BENCHMARK', 'QUOTE', 'PATTERN', 'INSIGHT'].includes(fact.type)) {
    errors.push({ field: 'type', message: 'Invalid fact type' });
  }

  if (fact.confidence < 0 || fact.confidence > 1) {
    errors.push({ field: 'confidence', message: 'Confidence must be between 0.0 and 1.0' });
  }

  if (!['claude', 'manual'].includes(fact.extraction_method)) {
    errors.push({ field: 'extraction_method', message: 'Invalid extraction method' });
  }

  if (isNaN(new Date(fact.extracted_at).getTime())) {
    errors.push({ field: 'extracted_at', message: 'extracted_at must be valid ISO timestamp' });
  }

  if (fact.version < 1) {
    errors.push({ field: 'version', message: 'Version must be >= 1' });
  }

  if (!['active', 'superseded', 'deprecated'].includes(fact.status)) {
    errors.push({ field: 'status', message: 'Invalid status' });
  }

  return errors;
}

/**
 * M6.4 Insight Generation — Type Definitions
 *
 * Represents a cross-article insight synthesized from multiple facts.
 * See /docs/knowledge/insights.md for detailed specification.
 */
export interface Insight {
  // Unique identifier
  id: string;

  // Insight content
  type: InsightType;                  // Semantic classification
  title: string;                      // Human-readable title
  description: string;                // Detailed explanation

  // Associated data
  facts_included: string[];           // IDs of facts that contributed
  related_articles: string[];         // IDs of source articles

  // Quality and confidence
  confidence: number;                 // 0.0–1.0, synthesis certainty
  domain?: string;                    // Domain classification (optional)

  // Metadata
  generated_at: string;               // ISO timestamp
  updated_at?: string;                // Last update timestamp (for versioning)
}

/**
 * Validate an insight for storage
 */
export interface InsightValidationError {
  field: string;
  message: string;
}

export function validateInsight(insight: Insight): InsightValidationError[] {
  const errors: InsightValidationError[] = [];

  if (!insight.id || insight.id.length === 0) {
    errors.push({ field: 'id', message: 'ID is required and cannot be empty' });
  }

  if (!['TREND', 'CONTRADICTION', 'SYNTHESIS', 'BENCHMARK', 'ALERT'].includes(insight.type)) {
    errors.push({ field: 'type', message: 'Invalid insight type' });
  }

  if (!insight.title || insight.title.length === 0) {
    errors.push({ field: 'title', message: 'Title is required' });
  }

  if (!insight.description || insight.description.length === 0) {
    errors.push({ field: 'description', message: 'Description is required' });
  }

  if (!Array.isArray(insight.facts_included)) {
    errors.push({ field: 'facts_included', message: 'facts_included must be an array' });
  }

  if (!Array.isArray(insight.related_articles)) {
    errors.push({ field: 'related_articles', message: 'related_articles must be an array' });
  }

  if (insight.confidence < 0 || insight.confidence > 1) {
    errors.push({ field: 'confidence', message: 'Confidence must be between 0.0 and 1.0' });
  }

  if (isNaN(new Date(insight.generated_at).getTime())) {
    errors.push({ field: 'generated_at', message: 'generated_at must be valid ISO timestamp' });
  }

  if (insight.updated_at && isNaN(new Date(insight.updated_at).getTime())) {
    errors.push({ field: 'updated_at', message: 'updated_at must be valid ISO timestamp' });
  }

  return errors;
}
