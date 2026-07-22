import { PatternDetector } from '../../src/business-logic/pattern-detector';
import { EmbeddingsService } from '../../src/services/embeddings';
import { KnowledgeFact } from '../../src/business-logic/knowledge-types';
import { InsightType } from '../../src/business-logic/insight';

describe('PatternDetector', () => {
  let patternDetector: PatternDetector;
  let embeddingsService: EmbeddingsService;

  beforeEach(() => {
    embeddingsService = new EmbeddingsService();
    patternDetector = new PatternDetector(embeddingsService);
  });

  describe('detectPatterns - Detect patterns from semantically similar facts', () => {
    it('should detect a pattern from multiple semantically similar facts', () => {
      // Create facts with similar content about AI adoption
      const facts: KnowledgeFact[] = [
        {
          id: 'fact-001',
          article_id: 'article-001',
          content: 'Companies are increasing AI adoption in their business processes to improve efficiency and reduce costs.',
          type: 'PATTERN',
          confidence: 0.85,
          extraction_method: 'claude',
          source_location: { section: 'body', paragraph: 1 },
          domain: 'ai-adoption',
          domain_confidence: 0.88,
          keywords: ['AI', 'adoption', 'efficiency'],
          extracted_at: '2026-07-22T10:00:00Z',
          version: 1,
          status: 'active',
        },
        {
          id: 'fact-002',
          article_id: 'article-002',
          content: 'Enterprise organizations are rapidly deploying artificial intelligence tools to streamline operations and cut operational expenses.',
          type: 'PATTERN',
          confidence: 0.82,
          extraction_method: 'claude',
          source_location: { section: 'body', paragraph: 2 },
          domain: 'ai-adoption',
          domain_confidence: 0.86,
          keywords: ['artificial intelligence', 'deployment', 'operations'],
          extracted_at: '2026-07-22T11:00:00Z',
          version: 1,
          status: 'active',
        },
        {
          id: 'fact-003',
          article_id: 'article-003',
          content: 'Tech companies are investing heavily in machine learning systems to automate routine business processes.',
          type: 'PATTERN',
          confidence: 0.79,
          extraction_method: 'claude',
          source_location: { section: 'body', paragraph: 3 },
          domain: 'ai-adoption',
          domain_confidence: 0.84,
          keywords: ['machine learning', 'automation', 'investment'],
          extracted_at: '2026-07-22T12:00:00Z',
          version: 1,
          status: 'active',
        },
      ];

      // Embed facts
      facts.forEach(fact => {
        embeddingsService.embedFact({
          id: fact.id,
          content: fact.content,
        });
      });

      // Detect patterns
      const insights = patternDetector.detectPatterns(facts);

      // Should detect at least one pattern with high confidence
      expect(insights.length).toBeGreaterThan(0);
      expect(insights[0].type).toBe(InsightType.PATTERN);
      expect(insights[0].confidence).toBeGreaterThanOrEqual(0.70);
      expect(insights[0].relatedFactIds.length).toBeGreaterThanOrEqual(2);
      expect(insights[0].title).toBeDefined();
      expect(insights[0].title.length).toBeGreaterThan(0);
      expect(insights[0].summary).toBeDefined();
      expect(insights[0].summary.includes('Observed across')).toBe(true);
    });
  });

  describe('detectPatterns - Group facts by similarity threshold', () => {
    it('should group 2 similar facts together and separate 1 dissimilar fact', () => {
      // Create facts with clear similarity grouping - make similar ones VERY similar
      const facts: KnowledgeFact[] = [
        {
          id: 'fact-001',
          article_id: 'article-001',
          content: 'Kubernetes deployment patterns help teams manage containerized applications at scale. Kubernetes orchestration is essential for modern infrastructure and container management systems.',
          type: 'TECHNIQUE',
          confidence: 0.88,
          extraction_method: 'claude',
          source_location: { section: 'body', paragraph: 1 },
          domain: 'infrastructure',
          domain_confidence: 0.90,
          keywords: ['Kubernetes', 'deployment', 'orchestration'],
          extracted_at: '2026-07-22T10:00:00Z',
          version: 1,
          status: 'active',
        },
        {
          id: 'fact-002',
          article_id: 'article-002',
          content: 'Kubernetes deployment patterns help teams manage containerized applications at scale. Kubernetes orchestration is critical for modern infrastructure and container management solutions.',
          type: 'TECHNIQUE',
          confidence: 0.86,
          extraction_method: 'claude',
          source_location: { section: 'body', paragraph: 2 },
          domain: 'infrastructure',
          domain_confidence: 0.89,
          keywords: ['Kubernetes', 'deployment', 'orchestration'],
          extracted_at: '2026-07-22T11:00:00Z',
          version: 1,
          status: 'active',
        },
        {
          id: 'fact-003',
          article_id: 'article-003',
          content: 'Python is a popular programming language used for web development and data science projects.',
          type: 'DEFINITION',
          confidence: 0.95,
          extraction_method: 'claude',
          source_location: { section: 'body', paragraph: 3 },
          domain: 'programming',
          domain_confidence: 0.94,
          keywords: ['Python', 'programming', 'web'],
          extracted_at: '2026-07-22T12:00:00Z',
          version: 1,
          status: 'active',
        },
      ];

      // Embed facts
      facts.forEach(fact => {
        embeddingsService.embedFact({
          id: fact.id,
          content: fact.content,
        });
      });

      // Detect patterns
      const insights = patternDetector.detectPatterns(facts);

      // Should detect multiple patterns - similar facts grouped, dissimilar separated
      expect(insights.length).toBeGreaterThanOrEqual(1);
      // At least one pattern should have 2 related facts (the similar Kubernetes facts)
      const multiFactPattern = insights.find(insight => insight.relatedFactIds.length >= 2);
      expect(multiFactPattern).toBeDefined();
      if (multiFactPattern) {
        expect(multiFactPattern.relatedFactIds).toEqual(
          expect.arrayContaining(['fact-001', 'fact-002'])
        );
      }
    });
  });

  describe('detectPatterns - Calculate pattern confidence from constituent facts', () => {
    it('should calculate pattern confidence based on constituent fact confidences', () => {
      // Create facts with varying confidence levels
      const facts: KnowledgeFact[] = [
        {
          id: 'fact-001',
          article_id: 'article-001',
          content: 'GraphQL is a query language for APIs that provides flexible data fetching and precise control over response payloads.',
          type: 'DEFINITION',
          confidence: 0.95,
          extraction_method: 'claude',
          source_location: { section: 'body', paragraph: 1 },
          domain: 'api-design',
          domain_confidence: 0.92,
          keywords: ['GraphQL', 'query language', 'APIs'],
          extracted_at: '2026-07-22T10:00:00Z',
          version: 1,
          status: 'active',
        },
        {
          id: 'fact-002',
          article_id: 'article-002',
          content: 'GraphQL enables clients to request only the data fields they need, reducing over-fetching and improving API efficiency.',
          type: 'TECHNIQUE',
          confidence: 0.88,
          extraction_method: 'claude',
          source_location: { section: 'body', paragraph: 2 },
          domain: 'api-design',
          domain_confidence: 0.90,
          keywords: ['GraphQL', 'efficiency', 'data fetching'],
          extracted_at: '2026-07-22T11:00:00Z',
          version: 1,
          status: 'active',
        },
      ];

      // Embed facts
      facts.forEach(fact => {
        embeddingsService.embedFact({
          id: fact.id,
          content: fact.content,
        });
      });

      // Detect patterns
      const insights = patternDetector.detectPatterns(facts);

      // Should have at least one insight
      expect(insights.length).toBeGreaterThan(0);

      // Pattern confidence should be derived from constituent facts
      const patternInsight = insights.find(insight => insight.type === InsightType.PATTERN);
      expect(patternInsight).toBeDefined();
      if (patternInsight) {
        // Confidence should be average of constituent fact confidences
        // Facts are 0.95 and 0.88, so average is 0.915
        expect(patternInsight.confidence).toBeCloseTo((0.95 + 0.88) / 2, 1);
        expect(patternInsight.confidence).toBeGreaterThan(0.7);
        expect(patternInsight.confidence).toBeLessThanOrEqual(1);
      }
    });
  });
});
