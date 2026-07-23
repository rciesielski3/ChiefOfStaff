import { InsightValidator } from '../../src/business-logic/insight-validator';
import { Insight, InsightType } from '../../src/business-logic/insight';
import { KnowledgeFact } from '../../src/business-logic/knowledge-types';

describe('InsightValidator', () => {
  let validator: InsightValidator;

  beforeEach(() => {
    validator = new InsightValidator();
  });

  describe('getMetrics', () => {
    test('calculates metrics correctly for valid insights', () => {
      const facts: KnowledgeFact[] = [
        {
          id: 'fact-1',
          article_id: 'article-1',
          content: 'Machine learning models require large datasets for training purposes and data quality directly impacts model performance significantly',
          type: 'TECHNIQUE',
          confidence: 0.92,
          extraction_method: 'claude',
          extracted_at: '2026-07-22T10:00:00Z',
          version: 1,
          status: 'active',
        },
        {
          id: 'fact-2',
          article_id: 'article-2',
          content: 'Deep learning neural networks have shown superior performance in image recognition tasks compared to traditional approaches',
          type: 'BENCHMARK',
          confidence: 0.88,
          extraction_method: 'claude',
          extracted_at: '2026-07-22T11:00:00Z',
          version: 1,
          status: 'active',
        },
      ];

      const insights: Insight[] = [
        {
          id: 'insight-1',
          type: InsightType.BEST_PRACTICE,
          title: 'Data Quality Drives ML Success',
          summary: 'High-quality datasets are foundational to machine learning model performance',
          confidence: 0.85,
          relatedFactIds: ['fact-1', 'fact-2'],
          domains: ['ai-ml'],
          tags: ['machine-learning'],
          supportingEvidence: [],
          evolutionStage: 'growth',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'insight-2',
          type: InsightType.RELATIONSHIP,
          title: 'Deep Learning Dominates Image Tasks',
          summary: 'Neural networks consistently outperform traditional ML in image-related domains',
          confidence: 0.79,
          relatedFactIds: ['fact-2'],
          domains: ['ai-ml'],
          tags: ['deep-learning'],
          supportingEvidence: [],
          evolutionStage: 'mature',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const metrics = validator.getMetrics(insights, facts);

      expect(metrics.total_count).toBe(2);
      expect(metrics.by_type[InsightType.BEST_PRACTICE]).toBe(1);
      expect(metrics.by_type[InsightType.RELATIONSHIP]).toBe(1);
      expect(metrics.confidence_mean).toBeCloseTo((0.85 + 0.79) / 2, 2);
      expect(metrics.confidence_min).toBe(0.79);
      expect(metrics.confidence_max).toBe(0.85);
      expect(metrics.facts_per_insight_mean).toBeCloseTo((2 + 1) / 2, 2);
      expect(metrics.no_hallucinations).toBe(true);
      expect(metrics.all_valid_types).toBe(true);
    });

    test('handles empty insights array', () => {
      const metrics = validator.getMetrics([], []);

      expect(metrics.total_count).toBe(0);
      expect(metrics.confidence_mean).toBe(0);
      expect(metrics.confidence_min).toBe(0);
      expect(metrics.confidence_max).toBe(0);
      expect(metrics.facts_per_insight_mean).toBe(0);
      expect(metrics.no_hallucinations).toBe(true);
      expect(metrics.all_valid_types).toBe(true);
    });
  });

  describe('validateInsights', () => {
    test('passes validation for valid insights', () => {
      const facts: KnowledgeFact[] = [
        {
          id: 'fact-1',
          article_id: 'article-1',
          content: 'Test framework speeds up development and reduces bugs by providing automated testing capabilities in software projects',
          type: 'TECHNIQUE',
          confidence: 0.90,
          extraction_method: 'claude',
          extracted_at: '2026-07-22T10:00:00Z',
          version: 1,
          status: 'active',
        },
      ];

      const insights: Insight[] = [
        {
          id: 'insight-1',
          type: InsightType.BEST_PRACTICE,
          title: 'Testing is Essential',
          summary: 'Automated testing frameworks significantly improve code quality and reduce defects',
          confidence: 0.85,
          relatedFactIds: ['fact-1'],
          domains: ['testing'],
          tags: ['quality'],
          supportingEvidence: [],
          evolutionStage: 'growth',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = validator.validateInsights(insights, facts);

      expect(result.passed).toBe(true);
      expect(result.failures.length).toBe(0);
    });

    test('fails validation when insight references non-existent fact', () => {
      const facts: KnowledgeFact[] = [
        {
          id: 'fact-1',
          article_id: 'article-1',
          content: 'Test framework speeds up development and reduces bugs by providing automated testing capabilities in software projects',
          type: 'TECHNIQUE',
          confidence: 0.90,
          extraction_method: 'claude',
          extracted_at: '2026-07-22T10:00:00Z',
          version: 1,
          status: 'active',
        },
      ];

      const insights: Insight[] = [
        {
          id: 'insight-1',
          type: InsightType.BEST_PRACTICE,
          title: 'Testing is Essential',
          summary: 'Automated testing frameworks improve code quality',
          confidence: 0.85,
          relatedFactIds: ['fact-1', 'fact-999'],
          domains: ['testing'],
          tags: ['quality'],
          supportingEvidence: [],
          evolutionStage: 'growth',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = validator.validateInsights(insights, facts);

      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('fact-999'))).toBe(true);
    });

    test('fails validation when confidence is out of range', () => {
      const facts: KnowledgeFact[] = [];

      const insights: Insight[] = [
        {
          id: 'insight-1',
          type: InsightType.BEST_PRACTICE,
          title: 'Testing is Essential',
          summary: 'Automated testing frameworks improve code quality',
          confidence: 1.5, // Invalid: > 1
          relatedFactIds: ['fact-1'],
          domains: ['testing'],
          tags: ['quality'],
          supportingEvidence: [],
          evolutionStage: 'growth',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = validator.validateInsights(insights, facts);

      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('range'))).toBe(true);
    });

    test('fails validation when insight is missing required fields', () => {
      const insights: Insight[] = [
        {
          id: '',
          type: InsightType.BEST_PRACTICE,
          title: '',
          summary: '',
          confidence: 0.85,
          relatedFactIds: [],
          domains: [],
          tags: [],
          supportingEvidence: [],
          evolutionStage: 'growth',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = validator.validateInsights(insights, []);

      expect(result.passed).toBe(false);
      expect(result.failures.length).toBeGreaterThan(0);
    });

    test('reports all failures without stopping at first failure', () => {
      const insights: Insight[] = [
        {
          id: 'insight-1',
          type: InsightType.BEST_PRACTICE,
          title: 'Valid Title',
          summary: 'Valid summary',
          confidence: 1.5, // Invalid confidence
          relatedFactIds: ['fact-999'], // Non-existent fact
          domains: [],
          tags: [],
          supportingEvidence: [],
          evolutionStage: 'growth',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = validator.validateInsights(insights, []);

      expect(result.passed).toBe(false);
      expect(result.failures.length).toBeGreaterThanOrEqual(2);
    });

    test('fails validation when no insights generated despite having facts', () => {
      const facts: KnowledgeFact[] = [
        {
          id: 'fact-1',
          article_id: 'article-1',
          content: 'Test content for zero-output detection',
          type: 'TECHNIQUE',
          confidence: 0.90,
          extraction_method: 'claude',
          extracted_at: '2026-07-23T10:00:00Z',
          version: 1,
          status: 'active',
        },
      ];

      const result = validator.validateInsights([], facts);

      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('No insights generated'))).toBe(true);
    });
  });
});
