import { Insight, InsightType, InsightFactory } from '../../src/business-logic/insight';

describe('Insight Data Model', () => {
  describe('InsightFactory - Create valid insight', () => {
    it('should create a valid insight with all required fields', () => {
      const insight = InsightFactory.create({
        type: InsightType.PATTERN,
        title: 'Emerging Technology Adoption Pattern',
        summary: 'Companies in fintech sector are adopting AI at 3x rate compared to 2024.',
        confidence: 0.87,
        relatedFactIds: ['fact-001', 'fact-002', 'fact-003'],
        domains: ['fintech', 'ai-adoption'],
        tags: ['emerging-trend', 'market-shift'],
        supportingEvidence: ['Q3 funding analysis', 'Patent filings'],
        evolutionStage: 'growth',
        metadata: {
          source: 'market-analysis',
          confidence_factors: ['data-volume', 'expert-consensus'],
        },
      });

      expect(insight.id).toBeDefined();
      expect(insight.type).toBe(InsightType.PATTERN);
      expect(insight.title).toBe('Emerging Technology Adoption Pattern');
      expect(insight.summary).toBe('Companies in fintech sector are adopting AI at 3x rate compared to 2024.');
      expect(insight.confidence).toBe(0.87);
      expect(insight.relatedFactIds).toHaveLength(3);
      expect(insight.domains).toContain('fintech');
      expect(insight.tags).toContain('emerging-trend');
      expect(insight.supportingEvidence).toHaveLength(2);
      expect(insight.evolutionStage).toBe('growth');
      expect(insight.metadata.source).toBe('market-analysis');
      expect(insight.createdAt).toBeDefined();
      expect(insight.updatedAt).toBeDefined();
    });
  });

  describe('InsightFactory - Validate confidence range', () => {
    it('should reject insights with confidence outside 0-1 range', () => {
      expect(() => {
        InsightFactory.create({
          type: InsightType.SYNTHESIS,
          title: 'Invalid confidence high',
          summary: 'Test summary',
          confidence: 1.5,
          relatedFactIds: ['fact-001'],
          domains: ['test'],
          tags: [],
          supportingEvidence: [],
          evolutionStage: 'new',
          metadata: {},
        });
      }).toThrow('Confidence must be between 0 and 1');

      expect(() => {
        InsightFactory.create({
          type: InsightType.SYNTHESIS,
          title: 'Invalid confidence low',
          summary: 'Test summary',
          confidence: -0.1,
          relatedFactIds: ['fact-001'],
          domains: ['test'],
          tags: [],
          supportingEvidence: [],
          evolutionStage: 'new',
          metadata: {},
        });
      }).toThrow('Confidence must be between 0 and 1');
    });
  });

  describe('InsightFactory - Validate related facts', () => {
    it('should reject insights with no related facts', () => {
      expect(() => {
        InsightFactory.create({
          type: InsightType.TREND,
          title: 'Invalid no facts',
          summary: 'Test summary',
          confidence: 0.75,
          relatedFactIds: [],
          domains: ['test'],
          tags: [],
          supportingEvidence: [],
          evolutionStage: 'new',
          metadata: {},
        });
      }).toThrow('Insight must have at least one related fact');
    });
  });
});
