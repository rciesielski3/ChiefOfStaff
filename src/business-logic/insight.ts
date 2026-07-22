/**
 * Insight Data Model
 *
 * Represents a higher-level insight derived from facts in the knowledge engine.
 * Insights synthesize patterns, trends, relationships, and best practices across facts.
 */

/**
 * Types of insights that can be generated from the knowledge base
 */
export enum InsightType {
  /** Pattern: Recurring sequences or structures in facts */
  PATTERN = 'PATTERN',
  /** Synthesis: Combination of multiple facts into a cohesive understanding */
  SYNTHESIS = 'SYNTHESIS',
  /** Trend: Directional changes over time across facts */
  TREND = 'TREND',
  /** Best Practice: Optimal approaches identified from facts */
  BEST_PRACTICE = 'BEST_PRACTICE',
  /** Anomaly: Unusual or unexpected fact clusters */
  ANOMALY = 'ANOMALY',
  /** Relationship: Connections between previously unrelated facts */
  RELATIONSHIP = 'RELATIONSHIP',
}

/**
 * Insight interface - represents a derived insight from the knowledge engine
 */
export interface Insight {
  /** Unique identifier for the insight */
  id: string;

  /** Type of insight (PATTERN, SYNTHESIS, TREND, etc.) */
  type: InsightType;

  /** Descriptive title of the insight */
  title: string;

  /** Detailed summary explaining the insight */
  summary: string;

  /** Confidence score 0-1 indicating reliability */
  confidence: number;

  /** IDs of facts supporting this insight (at least one required) */
  relatedFactIds: string[];

  /** Domain categories this insight spans */
  domains: string[];

  /** Semantic tags for discovery and classification */
  tags: string[];

  /** Supporting evidence items explaining the insight */
  supportingEvidence: string[];

  /** Lifecycle stage: new, growth, mature, declining, archived */
  evolutionStage: string;

  /** Flexible metadata for additional context */
  metadata: Record<string, unknown>;

  /** Timestamp when insight was created */
  createdAt: Date;

  /** Timestamp when insight was last updated */
  updatedAt: Date;
}

/**
 * Factory for creating and validating Insight instances
 */
export class InsightFactory {
  /**
   * Create a new insight with validation
   * @param input Partial insight data (id and timestamps generated automatically)
   * @returns Valid Insight instance
   * @throws Error if validation fails
   */
  static create(input: Omit<Insight, 'id' | 'createdAt' | 'updatedAt'>): Insight {
    // Validate confidence is in valid range
    if (input.confidence < 0 || input.confidence > 1) {
      throw new Error('Confidence must be between 0 and 1');
    }

    // Validate at least one related fact
    if (!input.relatedFactIds || input.relatedFactIds.length === 0) {
      throw new Error('Insight must have at least one related fact');
    }

    // Create insight with generated id and timestamps
    const now = new Date();
    return {
      id: `insight-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      updatedAt: now,
      ...input,
    };
  }
}
