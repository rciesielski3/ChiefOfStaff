import { Insight, InsightType } from './insight';
import { KnowledgeFact } from './knowledge-types';

/**
 * Metrics calculated from a set of insights
 */
export interface InsightMetrics {
  total_count: number;
  by_type: Record<string, number>;
  confidence_mean: number;
  confidence_min: number;
  confidence_max: number;
  facts_per_insight_mean: number;
  no_hallucinations: boolean;
  all_valid_types: boolean;
}

/**
 * Result of validating a set of insights
 */
export interface ValidationResult {
  passed: boolean;
  metrics: InsightMetrics;
  failures: string[];
}

/**
 * Validates insights and calculates quality metrics
 *
 * Validates:
 * - All insights have valid types (from InsightType enum)
 * - Confidence scores are in 0-1 range
 * - No hallucinations (all referenced facts exist)
 * - Required fields present (id, title, summary, confidence, relatedFactIds)
 */
export class InsightValidator {
  /**
   * Validate insights against success criteria
   * - All insights have valid types
   * - Confidence scores are 0-1 range
   * - No hallucinations (e.g., referencing non-existent facts)
   * - At least one insight generated (if facts provided)
   * @param insights Array of insights to validate
   * @param facts Optional array of facts for hallucination detection
   * @returns ValidationResult with pass/fail status and metrics
   */
  validateInsights(
    insights: Insight[],
    facts: KnowledgeFact[] = []
  ): ValidationResult {
    const failures: string[] = [];
    const metrics = this.getMetrics(insights, facts);

    // Check for zero-output failure: no insights generated despite having facts
    if (facts.length > 0 && insights.length === 0) {
      failures.push('No insights generated from available facts');
    }

    // Validate insight types
    const validTypes = Object.values(InsightType);
    if (!metrics.all_valid_types) {
      failures.push(
        `Some insights have invalid types (must be one of: ${validTypes.join(', ')})`
      );
    }

    // Validate confidence scores
    if (metrics.confidence_min < 0 || metrics.confidence_max > 1) {
      failures.push('Confidence scores outside valid range [0, 1]');
    }

    // Validate no hallucinations
    const factIds = new Set(facts.map((f) => f.id));
    for (const insight of insights) {
      for (const factId of insight.relatedFactIds) {
        if (!factIds.has(factId)) {
          failures.push(`Insight "${insight.title}" references non-existent fact: ${factId}`);
        }
      }
    }

    // Validate structure
    for (const insight of insights) {
      if (!insight.id || !insight.title || !insight.summary) {
        failures.push(
          `Insight missing required fields: id="${insight.id}", title="${insight.title}", summary="${insight.summary}"`
        );
      }
      if (!Array.isArray(insight.relatedFactIds) || insight.relatedFactIds.length === 0) {
        failures.push(`Insight "${insight.title}" has no related facts`);
      }
    }

    return {
      passed: failures.length === 0,
      metrics,
      failures,
    };
  }

  /**
   * Calculate metrics for insights
   * @param insights Array of insights
   * @param facts Optional array of facts for hallucination detection
   * @returns InsightMetrics with statistical summaries
   */
  getMetrics(insights: Insight[], facts: KnowledgeFact[] = []): InsightMetrics {
    const by_type: Record<string, number> = {};
    let confidence_sum = 0;
    let confidence_min = insights.length > 0 ? Number.POSITIVE_INFINITY : 0;
    let confidence_max = insights.length > 0 ? Number.NEGATIVE_INFINITY : 0;
    let facts_count_sum = 0;

    for (const insight of insights) {
      const typeStr = String(insight.type);
      by_type[typeStr] = (by_type[typeStr] || 0) + 1;
      confidence_sum += insight.confidence;
      confidence_min = Math.min(confidence_min, insight.confidence);
      confidence_max = Math.max(confidence_max, insight.confidence);
      facts_count_sum += insight.relatedFactIds.length;
    }

    const confidence_mean =
      insights.length > 0 ? confidence_sum / insights.length : 0;
    const facts_per_insight_mean =
      insights.length > 0 ? facts_count_sum / insights.length : 0;

    const validTypes = Object.values(InsightType);
    const all_valid_types = insights.every((i) => validTypes.includes(i.type));

    const factIds = new Set(facts.map((f) => f.id));
    let no_hallucinations = true;
    for (const insight of insights) {
      for (const factId of insight.relatedFactIds) {
        if (!factIds.has(factId)) {
          no_hallucinations = false;
          break;
        }
      }
      if (!no_hallucinations) break;
    }

    return {
      total_count: insights.length,
      by_type,
      confidence_mean,
      confidence_min: insights.length > 0 ? confidence_min : 0,
      confidence_max: insights.length > 0 ? confidence_max : 0,
      facts_per_insight_mean,
      no_hallucinations,
      all_valid_types,
    };
  }
}
