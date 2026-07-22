import { SynthesisEngine } from '../../src/business-logic/synthesis-engine';
import { InsightType, InsightFactory } from '../../src/business-logic/insight';
import { KnowledgeFact } from '../../src/business-logic/knowledge-types';

describe('SynthesisEngine', () => {
  let synthesisEngine: SynthesisEngine;

  beforeEach(() => {
    synthesisEngine = new SynthesisEngine();
  });

  describe('synthesizeInsights - Synthesize multiple patterns into cohesive BEST_PRACTICE insights', () => {
    it('should combine multiple high-confidence patterns into a BEST_PRACTICE insight', () => {
      // Create PATTERN insights with high confidence
      const pattern1 = InsightFactory.create({
        type: InsightType.PATTERN,
        title: 'kubernetes deployment pattern emerging',
        summary: 'Observed across 3 facts from infrastructure.',
        confidence: 0.87,
        relatedFactIds: ['fact-001', 'fact-002'],
        domains: ['infrastructure'],
        tags: ['type:pattern', 'domain:infrastructure'],
        supportingEvidence: ['Evidence 1', 'Evidence 2'],
        evolutionStage: 'new',
        metadata: { clusterSize: 2 },
      });

      const pattern2 = InsightFactory.create({
        type: InsightType.PATTERN,
        title: 'kubernetes orchestration pattern emerging',
        summary: 'Observed across 2 facts from infrastructure.',
        confidence: 0.86,
        relatedFactIds: ['fact-003', 'fact-004'],
        domains: ['infrastructure'],
        tags: ['type:pattern', 'domain:infrastructure'],
        supportingEvidence: ['Evidence 3', 'Evidence 4'],
        evolutionStage: 'new',
        metadata: { clusterSize: 2 },
      });

      const facts: KnowledgeFact[] = [
        {
          id: 'fact-001',
          article_id: 'article-001',
          content: 'Kubernetes patterns enable efficient container orchestration at scale.',
          type: 'TECHNIQUE',
          confidence: 0.88,
          extraction_method: 'claude',
          domain: 'infrastructure',
          domain_confidence: 0.90,
          keywords: ['Kubernetes', 'orchestration'],
          extracted_at: '2026-07-22T10:00:00Z',
          version: 1,
          status: 'active',
        },
      ];

      // Synthesize insights
      const insights = synthesisEngine.synthesizeInsights([pattern1, pattern2], facts);

      // Should create BEST_PRACTICE insight
      const bestPracticeInsights = insights.filter(i => i.type === InsightType.BEST_PRACTICE);
      expect(bestPracticeInsights.length).toBeGreaterThanOrEqual(1);

      // BEST_PRACTICE should combine patterns
      const bestPractice = bestPracticeInsights[0];
      expect(bestPractice.type).toBe(InsightType.BEST_PRACTICE);
      expect(bestPractice.confidence).toBeGreaterThan(0.85);
      expect(bestPractice.relatedFactIds.length).toBeGreaterThanOrEqual(2);
      expect(bestPractice.title).toContain('best practice');
      expect(bestPractice.domains).toContain('infrastructure');
    });
  });

  describe('synthesizeInsights - Identify best practices from consistent patterns with high confidence', () => {
    it('should identify best practices only when confidence is > 0.85 and patterns >= 2', () => {
      // Create multiple patterns with varying confidence
      const highConfidencePatterns = [
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'api design pattern emerging',
          summary: 'Observed across 2 facts from api-design.',
          confidence: 0.92,
          relatedFactIds: ['fact-001', 'fact-002'],
          domains: ['api-design'],
          tags: ['type:pattern', 'domain:api-design'],
          supportingEvidence: ['Evidence 1', 'Evidence 2'],
          evolutionStage: 'new',
          metadata: { clusterSize: 2 },
        }),
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'api best practice pattern emerging',
          summary: 'Observed across 2 facts from api-design.',
          confidence: 0.88,
          relatedFactIds: ['fact-003', 'fact-004'],
          domains: ['api-design'],
          tags: ['type:pattern', 'domain:api-design'],
          supportingEvidence: ['Evidence 3', 'Evidence 4'],
          evolutionStage: 'new',
          metadata: { clusterSize: 2 },
        }),
      ];

      const lowConfidencePatterns = [
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'testing pattern emerging',
          summary: 'Observed across 2 facts from testing.',
          confidence: 0.72,
          relatedFactIds: ['fact-005', 'fact-006'],
          domains: ['testing'],
          tags: ['type:pattern', 'domain:testing'],
          supportingEvidence: ['Evidence 5', 'Evidence 6'],
          evolutionStage: 'new',
          metadata: { clusterSize: 2 },
        }),
      ];

      const facts: KnowledgeFact[] = [];

      // Synthesize with high-confidence patterns
      const insights = synthesisEngine.synthesizeInsights(highConfidencePatterns, facts);

      // Should create BEST_PRACTICE for high-confidence group
      const bestPracticeInsights = insights.filter(i => i.type === InsightType.BEST_PRACTICE);
      expect(bestPracticeInsights.length).toBeGreaterThanOrEqual(1);

      // Verify best practice has high confidence (avg of 0.92 and 0.88 = 0.90)
      const bestPractice = bestPracticeInsights[0];
      expect(bestPractice.confidence).toBeCloseTo(0.90, 1);
      expect(bestPractice.confidence).toBeGreaterThan(0.85);

      // Synthesize with low-confidence patterns
      const lowConfidenceInsights = synthesisEngine.synthesizeInsights(lowConfidencePatterns, facts);

      // Should NOT create BEST_PRACTICE for low-confidence group (0.72 < 0.85)
      const lowBestPractice = lowConfidenceInsights.filter(
        i => i.type === InsightType.BEST_PRACTICE
      );
      expect(lowBestPractice.length).toBe(0);
    });

    it('should set evolutionStage to ESTABLISHED when avgConfidence > 0.90', () => {
      // Create patterns with very high confidence
      const patterns = [
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'microservices pattern emerging',
          summary: 'Observed across 2 facts from architecture.',
          confidence: 0.94,
          relatedFactIds: ['fact-001', 'fact-002'],
          domains: ['architecture'],
          tags: ['type:pattern'],
          supportingEvidence: ['Evidence 1', 'Evidence 2'],
          evolutionStage: 'new',
          metadata: { clusterSize: 2 },
        }),
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'microservices architecture pattern',
          summary: 'Observed across 2 facts from architecture.',
          confidence: 0.92,
          relatedFactIds: ['fact-003', 'fact-004'],
          domains: ['architecture'],
          tags: ['type:pattern'],
          supportingEvidence: ['Evidence 3', 'Evidence 4'],
          evolutionStage: 'new',
          metadata: { clusterSize: 2 },
        }),
      ];

      const facts: KnowledgeFact[] = [];

      const insights = synthesisEngine.synthesizeInsights(patterns, facts);

      // Should create BEST_PRACTICE with ESTABLISHED stage
      const bestPractice = insights.find(i => i.type === InsightType.BEST_PRACTICE);
      expect(bestPractice).toBeDefined();
      if (bestPractice) {
        expect(bestPractice.confidence).toBeCloseTo(0.93, 1);
        expect(bestPractice.evolutionStage).toBe('ESTABLISHED');
      }
    });

    it('should set evolutionStage to growth when avgConfidence <= 0.90', () => {
      // Create patterns with moderate-high confidence
      const patterns = [
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'caching pattern emerging',
          summary: 'Observed across 2 facts from performance.',
          confidence: 0.86,
          relatedFactIds: ['fact-001', 'fact-002'],
          domains: ['performance'],
          tags: ['type:pattern'],
          supportingEvidence: ['Evidence 1', 'Evidence 2'],
          evolutionStage: 'new',
          metadata: { clusterSize: 2 },
        }),
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'caching best practice pattern',
          summary: 'Observed across 2 facts from performance.',
          confidence: 0.86,
          relatedFactIds: ['fact-003', 'fact-004'],
          domains: ['performance'],
          tags: ['type:pattern'],
          supportingEvidence: ['Evidence 3', 'Evidence 4'],
          evolutionStage: 'new',
          metadata: { clusterSize: 2 },
        }),
      ];

      const facts: KnowledgeFact[] = [];

      const insights = synthesisEngine.synthesizeInsights(patterns, facts);

      // Should create BEST_PRACTICE with growth stage
      const bestPractice = insights.find(i => i.type === InsightType.BEST_PRACTICE);
      expect(bestPractice).toBeDefined();
      if (bestPractice) {
        expect(bestPractice.confidence).toBeCloseTo(0.86, 1);
        expect(bestPractice.evolutionStage).toBe('growth');
      }
    });
  });

  describe('synthesizeInsights - Identify cross-domain relationships', () => {
    it('should identify RELATIONSHIP insights when patterns span multiple domains', () => {
      // Create patterns that span multiple domains
      const patterns = [
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'distributed systems pattern emerging',
          summary: 'Observed pattern across infrastructure and concurrency.',
          confidence: 0.88,
          relatedFactIds: ['fact-001', 'fact-002'],
          domains: ['infrastructure', 'concurrency'],
          tags: ['type:pattern', 'domain:infrastructure', 'domain:concurrency'],
          supportingEvidence: ['Evidence 1', 'Evidence 2'],
          evolutionStage: 'new',
          metadata: { clusterSize: 2 },
        }),
      ];

      const facts: KnowledgeFact[] = [];

      const insights = synthesisEngine.synthesizeInsights(patterns, facts);

      // Should create RELATIONSHIP insight
      const relationshipInsights = insights.filter(i => i.type === InsightType.RELATIONSHIP);
      expect(relationshipInsights.length).toBeGreaterThanOrEqual(1);

      // RELATIONSHIP should span multiple domains
      const relationship = relationshipInsights[0];
      expect(relationship.type).toBe(InsightType.RELATIONSHIP);
      expect(relationship.domains.length).toBeGreaterThan(1);
      expect(relationship.title).toContain('relationship');
    });

    it('should NOT create RELATIONSHIP for single-domain patterns', () => {
      // Create patterns that only span single domains
      const patterns = [
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'kubernetes pattern emerging',
          summary: 'Observed pattern in infrastructure.',
          confidence: 0.88,
          relatedFactIds: ['fact-001', 'fact-002'],
          domains: ['infrastructure'],
          tags: ['type:pattern', 'domain:infrastructure'],
          supportingEvidence: ['Evidence 1', 'Evidence 2'],
          evolutionStage: 'new',
          metadata: { clusterSize: 2 },
        }),
      ];

      const facts: KnowledgeFact[] = [];

      const insights = synthesisEngine.synthesizeInsights(patterns, facts);

      // Should NOT create RELATIONSHIP for single-domain patterns
      const relationshipInsights = insights.filter(i => i.type === InsightType.RELATIONSHIP);
      expect(relationshipInsights.length).toBe(0);
    });

    it('should group multi-domain patterns by theme when identifying relationships', () => {
      // Create multiple patterns spanning same domains (same theme)
      const patterns = [
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'performance optimization pattern emerging',
          summary: 'Observed across caching and concurrency domains.',
          confidence: 0.87,
          relatedFactIds: ['fact-001', 'fact-002'],
          domains: ['caching', 'concurrency'],
          tags: ['type:pattern', 'domain:caching', 'domain:concurrency'],
          supportingEvidence: ['Evidence 1', 'Evidence 2'],
          evolutionStage: 'new',
          metadata: { clusterSize: 2 },
        }),
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'performance pattern emerging',
          summary: 'Observed across caching and concurrency domains.',
          confidence: 0.85,
          relatedFactIds: ['fact-003', 'fact-004'],
          domains: ['caching', 'concurrency'],
          tags: ['type:pattern', 'domain:caching', 'domain:concurrency'],
          supportingEvidence: ['Evidence 3', 'Evidence 4'],
          evolutionStage: 'new',
          metadata: { clusterSize: 2 },
        }),
      ];

      const facts: KnowledgeFact[] = [];

      const insights = synthesisEngine.synthesizeInsights(patterns, facts);

      // Should group patterns with same theme/domains
      const relationshipInsights = insights.filter(i => i.type === InsightType.RELATIONSHIP);
      expect(relationshipInsights.length).toBeGreaterThanOrEqual(1);

      // Relationship should have both domains
      const relationship = relationshipInsights[0];
      expect(relationship.domains).toContain('caching');
      expect(relationship.domains).toContain('concurrency');
    });
  });

  describe('groupPatternsByTheme - Extract and normalize themes from pattern titles', () => {
    it('should extract theme by removing common prefixes from pattern titles', () => {
      const patterns = [
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'pattern: kubernetes orchestration pattern emerging',
          summary: 'Test',
          confidence: 0.87,
          relatedFactIds: ['fact-001'],
          domains: ['infrastructure'],
          tags: [],
          supportingEvidence: [],
          evolutionStage: 'new',
          metadata: {},
        }),
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'kubernetes deployment emerging',
          summary: 'Test',
          confidence: 0.86,
          relatedFactIds: ['fact-002'],
          domains: ['infrastructure'],
          tags: [],
          supportingEvidence: [],
          evolutionStage: 'new',
          metadata: {},
        }),
      ];

      // Verify grouping through synthesizeInsights (which groups internally)
      const facts: KnowledgeFact[] = [];
      const insights = synthesisEngine.synthesizeInsights(patterns, facts);

      // Both patterns should be grouped under similar theme
      const bestPractices = insights.filter(i => i.type === InsightType.BEST_PRACTICE);
      expect(bestPractices.length).toBeGreaterThanOrEqual(1);

      // The grouped best practice should reference both patterns
      if (bestPractices[0]) {
        expect(bestPractices[0].relatedFactIds.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('synthesizeInsights - Handle edge cases', () => {
    it('should handle empty pattern list', () => {
      const insights = synthesisEngine.synthesizeInsights([], []);
      expect(insights).toEqual([]);
    });

    it('should handle single pattern (no BEST_PRACTICE since patterns < 2)', () => {
      const patterns = [
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'single pattern emerging',
          summary: 'Only one pattern.',
          confidence: 0.90,
          relatedFactIds: ['fact-001'],
          domains: ['testing'],
          tags: [],
          supportingEvidence: [],
          evolutionStage: 'new',
          metadata: {},
        }),
      ];

      const insights = synthesisEngine.synthesizeInsights(patterns, []);

      // Should NOT create BEST_PRACTICE for single pattern
      const bestPractices = insights.filter(i => i.type === InsightType.BEST_PRACTICE);
      expect(bestPractices.length).toBe(0);
    });

    it('should handle multiple theme groups independently', () => {
      // Create patterns from different theme groups
      const patterns = [
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'kubernetes pattern emerging',
          summary: 'Infrastructure pattern.',
          confidence: 0.88,
          relatedFactIds: ['fact-001'],
          domains: ['infrastructure'],
          tags: [],
          supportingEvidence: [],
          evolutionStage: 'new',
          metadata: {},
        }),
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'kubernetes deployment pattern',
          summary: 'Infrastructure pattern.',
          confidence: 0.86,
          relatedFactIds: ['fact-002'],
          domains: ['infrastructure'],
          tags: [],
          supportingEvidence: [],
          evolutionStage: 'new',
          metadata: {},
        }),
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'testing pattern emerging',
          summary: 'Testing pattern.',
          confidence: 0.84,
          relatedFactIds: ['fact-003'],
          domains: ['testing'],
          tags: [],
          supportingEvidence: [],
          evolutionStage: 'new',
          metadata: {},
        }),
        InsightFactory.create({
          type: InsightType.PATTERN,
          title: 'testing best practice pattern',
          summary: 'Testing pattern.',
          confidence: 0.82,
          relatedFactIds: ['fact-004'],
          domains: ['testing'],
          tags: [],
          supportingEvidence: [],
          evolutionStage: 'new',
          metadata: {},
        }),
      ];

      const insights = synthesisEngine.synthesizeInsights(patterns, []);

      // Kubernetes group should pass threshold (0.87 avg)
      // Testing group should fail threshold (0.83 avg < 0.85)
      const bestPractices = insights.filter(i => i.type === InsightType.BEST_PRACTICE);
      expect(bestPractices.length).toBeGreaterThanOrEqual(1);

      // Should have kubernetes best practice
      const k8sBestPractice = bestPractices.find(bp => bp.title.includes('kubernetes'));
      expect(k8sBestPractice).toBeDefined();
    });
  });
});
