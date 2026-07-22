/**
 * M6.4 Synthesis Engine
 *
 * Combines patterns and facts into higher-level insights:
 * - Best Practices: Multi-pattern insights with high confidence
 * - Relationships: Cross-domain connection insights
 */

import { Insight, InsightType, InsightFactory } from './insight';
import { KnowledgeFact } from './knowledge-types';

/**
 * SynthesisEngine - Synthesizes patterns into higher-level insights
 *
 * Takes PATTERN-type insights and combines them into:
 * - BEST_PRACTICE insights (high-confidence, multi-pattern groups)
 * - RELATIONSHIP insights (cross-domain patterns)
 */
export class SynthesisEngine {
  private patterns: Insight[] = [];
  private facts: KnowledgeFact[] = [];

  /**
   * Synthesize patterns and facts into higher-level insights
   * @param patterns Array of PATTERN-type insights
   * @param facts Array of knowledge facts (for context)
   * @returns Array of synthesized BEST_PRACTICE and RELATIONSHIP insights
   */
  synthesizeInsights(patterns: Insight[], facts: KnowledgeFact[]): Insight[] {
    if (patterns.length === 0) {
      return [];
    }

    this.patterns = patterns;
    this.facts = facts;

    const results: Insight[] = [];

    // Synthesize best practices from grouped patterns
    const bestPractices = this.synthesizeBestPractice();
    results.push(...bestPractices);

    // Identify cross-domain relationships
    const relationships = this.identifyRelationships();
    results.push(...relationships);

    return results;
  }

  /**
   * Group patterns by theme extracted from their titles
   * Removes common prefixes like "pattern:", "best practice:", "emerging", "trend:"
   * @returns Map of theme -> patterns with that theme
   */
  private groupPatternsByTheme(): Map<string, Insight[]> {
    const grouped = new Map<string, Insight[]>();

    this.patterns.forEach(pattern => {
      const theme = this.extractTheme(pattern.title);
      if (!grouped.has(theme)) {
        grouped.set(theme, []);
      }
      grouped.get(theme)!.push(pattern);
    });

    return grouped;
  }

  /**
   * Synthesize best practices from grouped patterns
   * Creates BEST_PRACTICE insights when:
   * - patterns.length >= 2
   * - avgConfidence > 0.85
   * Sets evolutionStage to ESTABLISHED if avgConfidence > 0.90
   * @returns Array of BEST_PRACTICE insights
   */
  private synthesizeBestPractice(): Insight[] {
    const grouped = this.groupPatternsByTheme();
    const insights: Insight[] = [];

    grouped.forEach((patterns, theme) => {
      // Only create best practice if we have multiple patterns
      if (patterns.length >= 2) {
        // Calculate average confidence
        const avgConfidence =
          patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;

        // Only create if average confidence exceeds threshold
        if (avgConfidence > 0.85) {
          // Collect all related facts from patterns
          const relatedFactIds = Array.from(new Set(patterns.flatMap(p => p.relatedFactIds)));

          // Collect all domains from patterns
          const domains = Array.from(new Set(patterns.flatMap(p => p.domains)));

          // Determine evolution stage
          const evolutionStage = avgConfidence > 0.90 ? 'ESTABLISHED' : 'growth';

          // Create best practice insight
          const insight = InsightFactory.create({
            type: InsightType.BEST_PRACTICE,
            title: `${theme} best practice`,
            summary: `Best practice identified from ${patterns.length} consistent patterns with ${(avgConfidence * 100).toFixed(1)}% confidence.`,
            confidence: avgConfidence,
            relatedFactIds,
            domains: domains.length > 0 ? domains : ['general'],
            tags: ['best-practice', theme, ...domains],
            supportingEvidence: patterns.map(p => p.title),
            evolutionStage,
            metadata: {
              patternCount: patterns.length,
              theme,
              sourcePatternIds: patterns.map(p => p.id),
            },
          });

          insights.push(insight);
        }
      }
    });

    return insights;
  }

  /**
   * Identify relationships between cross-domain patterns
   * Creates RELATIONSHIP insights when patterns span multiple domains
   * Groups patterns by theme to find related multi-domain patterns
   * @returns Array of RELATIONSHIP insights
   */
  private identifyRelationships(): Insight[] {
    const insights: Insight[] = [];

    // Find patterns with multiple domains
    const multiDomainPatterns = this.patterns.filter(p => p.domains.length > 1);

    // Group multi-domain patterns by theme
    const relationshipGroups = new Map<string, Insight[]>();

    multiDomainPatterns.forEach(pattern => {
      const theme = this.extractTheme(pattern.title);
      if (!relationshipGroups.has(theme)) {
        relationshipGroups.set(theme, []);
      }
      relationshipGroups.get(theme)!.push(pattern);
    });

    // Create relationship insights for theme groups
    relationshipGroups.forEach((patterns, theme) => {
      // Get all unique domains in this group
      const domains = Array.from(new Set(patterns.flatMap(p => p.domains)));

      // Create relationship if we have patterns spanning multiple domains
      if (domains.length > 1) {
        const avgConfidence =
          patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;

        // Collect all related facts from patterns
        const relatedFactIds = Array.from(new Set(patterns.flatMap(p => p.relatedFactIds)));

        // Create relationship insight
        const insight = InsightFactory.create({
          type: InsightType.RELATIONSHIP,
          title: `${domains.join('-')} relationship`,
          summary: `Relationship identified between ${domains.join(', ')} domains across ${patterns.length} pattern${patterns.length !== 1 ? 's' : ''}.`,
          confidence: avgConfidence,
          relatedFactIds,
          domains,
          tags: ['relationship', theme, ...domains],
          supportingEvidence: patterns.map(p => p.title),
          evolutionStage: 'new',
          metadata: {
            patternCount: patterns.length,
            theme,
            connectedDomains: domains,
            sourcePatternIds: patterns.map(p => p.id),
          },
        });

        insights.push(insight);
      }
    });

    return insights;
  }

  /**
   * Extract theme from pattern title
   * Removes common prefixes and suffixes:
   * - "pattern:", "best practice:", "emerging", "trend:"
   * Returns the first significant word as the theme for grouping
   * @param title Pattern title to extract theme from
   * @returns Extracted and normalized theme (first word)
   */
  private extractTheme(title: string): string {
    // Remove leading prefixes
    let normalized = title
      .toLowerCase()
      .replace(/^(pattern:|best practice:|trend:)\s*/i, '');

    // Remove all trailing pattern-related words globally
    normalized = normalized
      .replace(/\s+(pattern|emerging|trend)\s*$/, '')
      .replace(/\s+(pattern|emerging|trend)\s+/g, ' ')
      .trim();

    // Extract first word as theme
    const firstWord = normalized.split(/\s+/)[0];
    return firstWord || 'general';
  }
}
