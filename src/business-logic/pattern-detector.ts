/**
 * M6.4 Pattern Detection Service
 *
 * Detects patterns in facts through semantic clustering using embeddings.
 * Clusters semantically similar facts and generates PATTERN-type insights.
 */

import { KnowledgeFact } from './knowledge-types';
import { Insight, InsightType, InsightFactory } from './insight';
import { EmbeddingsService } from '../services/embeddings';

/**
 * PatternDetector - Identifies patterns in knowledge facts using semantic clustering
 *
 * Uses embeddings from EmbeddingsService to cluster semantically similar facts.
 * Generates PATTERN-type insights from clusters with automatic titles and summaries.
 */
export class PatternDetector {
  private embeddingsService: EmbeddingsService;
  private similarityThreshold: number = 0.70;

  constructor(embeddingsService: EmbeddingsService) {
    this.embeddingsService = embeddingsService;
  }

  /**
   * Detect patterns from a set of facts using semantic clustering
   * @param facts Array of knowledge facts to analyze
   * @returns Array of PATTERN-type insights derived from fact clusters
   */
  detectPatterns(facts: KnowledgeFact[]): Insight[] {
    if (facts.length === 0) {
      return [];
    }

    // Embed all facts if not already embedded
    facts.forEach(fact => {
      this.embeddingsService.embedFact({
        id: fact.id,
        content: fact.content,
      });
    });

    // Cluster facts by semantic similarity
    const clusters = this.clusterFactsByEmbedding(facts);

    // Generate insights from clusters
    const insights: Insight[] = clusters
      .filter(cluster => cluster.length >= 1) // Include single facts and clusters
      .map(cluster => this.generatePatternInsight(cluster, facts));

    return insights;
  }

  /**
   * Cluster facts by cosine similarity of their embeddings
   * Uses union-find to build connected components of similar facts
   * @param facts Facts to cluster
   * @returns Array of clusters, each containing fact IDs
   */
  private clusterFactsByEmbedding(facts: KnowledgeFact[]): string[][] {
    if (facts.length === 0) {
      return [];
    }

    if (facts.length === 1) {
      return [[facts[0].id]];
    }

    // Union-Find data structure for clustering
    const parent = new Map<string, string>();
    const rank = new Map<string, number>();

    // Initialize each fact as its own component
    facts.forEach(fact => {
      parent.set(fact.id, fact.id);
      rank.set(fact.id, 0);
    });

    const find = (id: string): string => {
      if (parent.get(id) !== id) {
        parent.set(id, find(parent.get(id)!));
      }
      return parent.get(id)!;
    };

    const union = (id1: string, id2: string): void => {
      const root1 = find(id1);
      const root2 = find(id2);

      if (root1 !== root2) {
        const rank1 = rank.get(root1) || 0;
        const rank2 = rank.get(root2) || 0;

        if (rank1 < rank2) {
          parent.set(root1, root2);
        } else if (rank1 > rank2) {
          parent.set(root2, root1);
        } else {
          parent.set(root2, root1);
          rank.set(root1, rank1 + 1);
        }
      }
    };

    // Compare all pairs of facts and union if similar
    for (let i = 0; i < facts.length; i++) {
      const similarities = this.embeddingsService.similaritySearch(facts[i].id, facts.length);

      similarities.forEach((sim: any) => {
        if (sim.similarity_score >= this.similarityThreshold) {
          union(facts[i].id, sim.related_fact_id);
        }
      });
    }

    // Build clusters from union-find result
    const clusterMap = new Map<string, string[]>();
    facts.forEach(fact => {
      const root = find(fact.id);
      if (!clusterMap.has(root)) {
        clusterMap.set(root, []);
      }
      clusterMap.get(root)!.push(fact.id);
    });

    return Array.from(clusterMap.values());
  }

  /**
   * Calculate cosine similarity between two vectors
   * @param vec1 First vector
   * @param vec2 Second vector
   * @returns Cosine similarity score (0-1)
   */
  private cosineSimilarity(vec1: number[], vec2: number[]): number {
    const dotProduct = vec1.reduce((sum, a, i) => sum + a * vec2[i], 0);
    const norm1 = Math.sqrt(vec1.reduce((sum, a) => sum + a * a, 0));
    const norm2 = Math.sqrt(vec2.reduce((sum, a) => sum + a * a, 0));

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Generate a PATTERN-type insight from a cluster of facts
   * @param factIds IDs of facts in the cluster
   * @param allFacts All facts for reference
   * @returns Generated PATTERN insight
   */
  private generatePatternInsight(factIds: string[], allFacts: KnowledgeFact[]): Insight {
    const factMap = new Map(allFacts.map(f => [f.id, f]));
    const clusterFacts = factIds
      .map(id => factMap.get(id))
      .filter((fact): fact is KnowledgeFact => fact !== undefined);

    // Generate pattern title from common keywords
    const title = this.generatePatternTitle(clusterFacts);

    // Generate pattern summary
    const summary = this.generatePatternSummary(clusterFacts);

    // Extract tags
    const tags = this.extractPatternTags(clusterFacts);

    // Calculate confidence as average of constituent fact confidences
    const confidence = this.calculateConfidence(clusterFacts);

    // Extract domains
    const domains = Array.from(
      new Set(
        clusterFacts
          .filter(f => f.domain)
          .map(f => f.domain as string)
      )
    );

    // Create insight using factory
    return InsightFactory.create({
      type: InsightType.PATTERN,
      title,
      summary,
      confidence,
      relatedFactIds: clusterFacts.map(f => f.id),
      domains: domains.length > 0 ? domains : ['general'],
      tags,
      supportingEvidence: clusterFacts.map(
        f => `${f.type}: ${f.content.substring(0, 100)}...`
      ),
      evolutionStage: 'new',
      metadata: {
        clusterSize: clusterFacts.length,
        factTypes: Array.from(new Set(clusterFacts.map(f => f.type))),
        extractionMethods: Array.from(new Set(clusterFacts.map(f => f.extraction_method))),
      },
    });
  }

  /**
   * Generate a descriptive title for a pattern from common keywords
   * @param facts Facts in the pattern cluster
   * @returns Pattern title like "kubernetes deployment pattern emerging"
   */
  private generatePatternTitle(facts: KnowledgeFact[]): string {
    // Extract all keywords from cluster facts
    const allKeywords: string[] = [];
    facts.forEach(fact => {
      if (fact.keywords) {
        allKeywords.push(...fact.keywords);
      }
      // Also extract significant words from content
      const words = fact.content
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 4 && !this.isStopWord(w));
      allKeywords.push(...words);
    });

    // Count keyword frequencies
    const keywordFreq = new Map<string, number>();
    allKeywords.forEach(keyword => {
      const lower = keyword.toLowerCase().replace(/[^\w]/g, '');
      keywordFreq.set(lower, (keywordFreq.get(lower) ?? 0) + 1);
    });

    // Get top 2 keywords
    const topKeywords = Array.from(keywordFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([kw]) => kw);

    // Generate title
    if (topKeywords.length >= 2) {
      return `${topKeywords[0]} ${topKeywords[1]} pattern emerging`;
    } else if (topKeywords.length === 1) {
      return `${topKeywords[0]} pattern emerging`;
    }

    return 'Common pattern emerging';
  }

  /**
   * Generate summary text for a pattern
   * @param facts Facts in the pattern cluster
   * @returns Summary text describing the pattern
   */
  private generatePatternSummary(facts: KnowledgeFact[]): string {
    const factCount = facts.length;
    const domainSet = new Set(facts.filter(f => f.domain).map(f => f.domain));
    const domains = Array.from(domainSet).join(', ');

    const sourceDomains = domains ? ` from ${domains}` : '';
    return `Observed across ${factCount} fact${factCount !== 1 ? 's' : ''}${sourceDomains}.`;
  }

  /**
   * Extract semantic tags for a pattern
   * @param facts Facts in the pattern cluster
   * @returns Array of tags (domains + fact types)
   */
  private extractPatternTags(facts: KnowledgeFact[]): string[] {
    const tags = new Set<string>();

    // Add domains
    facts.forEach(fact => {
      if (fact.domain) {
        tags.add(`domain:${fact.domain}`);
      }
    });

    // Add fact types
    facts.forEach(fact => {
      tags.add(`type:${fact.type.toLowerCase()}`);
    });

    return Array.from(tags);
  }

  /**
   * Calculate confidence score for a pattern
   * @param facts Facts in the pattern cluster
   * @returns Average confidence of constituent facts (0-1)
   */
  private calculateConfidence(facts: KnowledgeFact[]): number {
    if (facts.length === 0) {
      return 0;
    }

    const totalConfidence = facts.reduce((sum, fact) => sum + fact.confidence, 0);
    return totalConfidence / facts.length;
  }

  /**
   * Check if a word is a stop word (should be excluded from keywords)
   * @param word Word to check
   * @returns True if word is a stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'from', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been',
      'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'should', 'could', 'may', 'might', 'can', 'must', 'shall', 'this',
      'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'are', 'that', 'which', 'who', 'whom', 'what', 'when', 'where', 'why', 'how',
    ]);
    return stopWords.has(word.toLowerCase());
  }
}
