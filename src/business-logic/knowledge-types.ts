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
