import * as fs from 'fs/promises';
import * as path from 'path';
import { InsightStore } from '../../src/business-logic/insight-store';
import { Insight, InsightType } from '../../src/business-logic/insight';

describe('InsightStore', () => {
  const testDir = path.join(__dirname, '../../.test-data');
  const testFilePath = path.join(testDir, 'insights.ndjson');

  beforeEach(async () => {
    // Clean up test data before each test
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore errors
    }
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test data after each test
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore errors
    }
  });

  describe('Test 1: Persist and retrieve insights (add, findById)', () => {
    it('should add insights to NDJSON file and retrieve them by ID', async () => {
      const store = new InsightStore(testFilePath);

      const insight1: Insight = {
        id: 'insight-001',
        type: InsightType.TREND,
        title: 'Rise of AI in DevOps',
        summary: 'Multiple articles show increasing adoption of AI for infrastructure automation.',
        relatedFactIds: ['fact-001', 'fact-002', 'fact-003'],
        domains: ['technology'],
        tags: ['ai', 'devops', 'automation'],
        supportingEvidence: ['Multiple sources document increased adoption'],
        confidence: 0.85,
        evolutionStage: 'growth',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const insight2: Insight = {
        id: 'insight-002',
        type: InsightType.SYNTHESIS,
        title: 'Kubernetes Best Practices Convergence',
        summary: 'Best practices across sources are converging on similar resource management patterns.',
        relatedFactIds: ['fact-004', 'fact-005'],
        domains: ['infrastructure'],
        tags: ['kubernetes', 'best-practices', 'standards'],
        supportingEvidence: ['Resource management patterns converging'],
        confidence: 0.90,
        evolutionStage: 'mature',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Add insights
      await store.add(insight1);
      await store.add(insight2);

      // Retrieve by ID
      const retrieved1 = await store.findById('insight-001');
      const retrieved2 = await store.findById('insight-002');

      // Verify retrieved insights match (accounting for Date serialization)
      expect(retrieved1).not.toBeNull();
      expect(retrieved2).not.toBeNull();
      expect(retrieved1!.id).toBe(insight1.id);
      expect(retrieved1!.title).toBe(insight1.title);
      expect(retrieved1!.summary).toBe(insight1.summary);
      expect(retrieved1!.relatedFactIds).toEqual(insight1.relatedFactIds);
      expect(retrieved1!.domains).toEqual(insight1.domains);
      expect(retrieved1!.confidence).toBe(insight1.confidence);
      expect(retrieved2!.id).toBe(insight2.id);
      expect(retrieved2!.title).toBe(insight2.title);

      // Non-existent ID should return null
      const notFound = await store.findById('non-existent');
      expect(notFound).toBeNull();
    });
  });

  describe('Test 2: Query insights by domain (findByDomain)', () => {
    it('should filter insights by domain', async () => {
      const store = new InsightStore(testFilePath);

      const insights = [
        {
          id: 'insight-001',
          type: InsightType.TREND,
          title: 'AI Trend',
          summary: 'Description 1',
          relatedFactIds: ['fact-001'],
          domains: ['technology'],
          tags: ['ai', 'trend'],
          supportingEvidence: ['Supporting fact 1'],
          confidence: 0.85,
          evolutionStage: 'growth',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'insight-002',
          type: InsightType.SYNTHESIS,
          title: 'Health Synthesis',
          summary: 'Description 2',
          relatedFactIds: ['fact-002'],
          domains: ['health'],
          tags: ['health', 'synthesis'],
          supportingEvidence: ['Supporting fact 2'],
          confidence: 0.90,
          evolutionStage: 'mature',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'insight-003',
          type: InsightType.BEST_PRACTICE,
          title: 'Another Tech Benchmark',
          summary: 'Description 3',
          relatedFactIds: ['fact-003'],
          domains: ['technology'],
          tags: ['benchmark', 'best-practices'],
          supportingEvidence: ['Supporting fact 3'],
          confidence: 0.80,
          evolutionStage: 'growth',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      for (const insight of insights) {
        await store.add(insight);
      }

      const techInsights = await store.findByDomain('technology');
      expect(techInsights).toHaveLength(2);
      expect(techInsights.every(i => i.domains.includes('technology'))).toBe(true);

      const healthInsights = await store.findByDomain('health');
      expect(healthInsights).toHaveLength(1);
      expect(healthInsights[0].id).toBe('insight-002');

      const emptyResult = await store.findByDomain('non-existent');
      expect(emptyResult).toHaveLength(0);
    });
  });

  describe('Test 3: Update insight timestamps on modification (update)', () => {
    it('should update insight fields and refresh updated_at timestamp', async () => {
      const store = new InsightStore(testFilePath);

      const createdAtTime = new Date('2026-07-22T10:00:00Z');
      const originalInsight: Insight = {
        id: 'insight-001',
        type: InsightType.TREND,
        title: 'Original Title',
        summary: 'Original description',
        relatedFactIds: ['fact-001'],
        domains: ['technology'],
        tags: ['original'],
        supportingEvidence: ['Original evidence'],
        confidence: 0.75,
        evolutionStage: 'new',
        metadata: {},
        createdAt: createdAtTime,
        updatedAt: createdAtTime,
      };

      // Add the original insight
      await store.add(originalInsight);

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update the insight
      const update = {
        title: 'Updated Title',
        summary: 'Updated description',
        confidence: 0.95,
        relatedFactIds: ['fact-001', 'fact-002', 'fact-003'],
      };

      const updatedInsight = await store.update('insight-001', update);

      expect(updatedInsight).not.toBeNull();
      expect(updatedInsight!.title).toBe('Updated Title');
      expect(updatedInsight!.summary).toBe('Updated description');
      expect(updatedInsight!.confidence).toBe(0.95);
      expect(updatedInsight!.relatedFactIds).toEqual(['fact-001', 'fact-002', 'fact-003']);
      // Note: Dates are serialized to ISO strings in JSON, so convert for comparison
      const createdAtString = typeof updatedInsight!.createdAt === 'string'
        ? updatedInsight!.createdAt
        : (updatedInsight!.createdAt as unknown as Date).toISOString();
      const expectedCreatedAtString = createdAtTime.toISOString();
      expect(createdAtString).toBe(expectedCreatedAtString); // Unchanged
      expect(updatedInsight!.updatedAt).toBeDefined();
      const updatedAtTime = typeof updatedInsight!.updatedAt === 'string'
        ? new Date(updatedInsight!.updatedAt).getTime()
        : (updatedInsight!.updatedAt as unknown as Date).getTime();
      expect(updatedAtTime).toBeGreaterThan(createdAtTime.getTime());

      // Verify update persisted
      const retrieved = await store.findById('insight-001');
      expect(retrieved!.title).toBe('Updated Title');
      expect(retrieved!.updatedAt).toBeDefined();
    });
  });

  describe('Test 4: Delete insights (delete)', () => {
    it('should remove insights from storage', async () => {
      const store = new InsightStore(testFilePath);

      const insights = [
        {
          id: 'insight-001',
          type: InsightType.TREND,
          title: 'First Insight',
          summary: 'Description 1',
          relatedFactIds: ['fact-001'],
          domains: ['technology'],
          tags: ['first'],
          supportingEvidence: ['Evidence 1'],
          confidence: 0.85,
          evolutionStage: 'growth',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'insight-002',
          type: InsightType.SYNTHESIS,
          title: 'Second Insight',
          summary: 'Description 2',
          relatedFactIds: ['fact-002'],
          domains: ['health'],
          tags: ['second'],
          supportingEvidence: ['Evidence 2'],
          confidence: 0.90,
          evolutionStage: 'mature',
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      for (const insight of insights) {
        await store.add(insight);
      }

      // Verify both exist
      let all = await store.findByType('TREND');
      expect(all.length + (await store.findByType('SYNTHESIS')).length).toBe(2);

      // Delete first insight
      const deleteResult = await store.delete('insight-001');
      expect(deleteResult).toBe(true);

      // Verify deletion
      const notFound = await store.findById('insight-001');
      expect(notFound).toBeNull();

      // Verify second still exists
      const retrieved = await store.findById('insight-002');
      expect(retrieved).not.toBeNull();
      expect(retrieved!.id).toBe('insight-002');

      // Delete non-existent insight
      const deleteNonExistent = await store.delete('non-existent');
      expect(deleteNonExistent).toBe(false);
    });
  });
});
