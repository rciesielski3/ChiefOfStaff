import * as fs from 'fs/promises';
import * as path from 'path';
import { InsightStore } from '../../src/business-logic/insight-store';
import { Insight } from '../../src/business-logic/knowledge-types';

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
        type: 'TREND',
        title: 'Rise of AI in DevOps',
        description: 'Multiple articles show increasing adoption of AI for infrastructure automation.',
        facts_included: ['fact-001', 'fact-002', 'fact-003'],
        related_articles: ['article-001', 'article-002'],
        confidence: 0.85,
        domain: 'technology',
        generated_at: new Date().toISOString(),
      };

      const insight2: Insight = {
        id: 'insight-002',
        type: 'SYNTHESIS',
        title: 'Kubernetes Best Practices Convergence',
        description: 'Best practices across sources are converging on similar resource management patterns.',
        facts_included: ['fact-004', 'fact-005'],
        related_articles: ['article-003', 'article-004', 'article-005'],
        confidence: 0.90,
        domain: 'infrastructure',
        generated_at: new Date().toISOString(),
      };

      // Add insights
      await store.add(insight1);
      await store.add(insight2);

      // Retrieve by ID
      const retrieved1 = await store.findById('insight-001');
      const retrieved2 = await store.findById('insight-002');

      expect(retrieved1).toEqual(insight1);
      expect(retrieved2).toEqual(insight2);

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
          type: 'TREND' as const,
          title: 'AI Trend',
          description: 'Description 1',
          facts_included: ['fact-001'],
          related_articles: ['article-001'],
          confidence: 0.85,
          domain: 'technology',
          generated_at: new Date().toISOString(),
        },
        {
          id: 'insight-002',
          type: 'SYNTHESIS' as const,
          title: 'Health Synthesis',
          description: 'Description 2',
          facts_included: ['fact-002'],
          related_articles: ['article-002'],
          confidence: 0.90,
          domain: 'health',
          generated_at: new Date().toISOString(),
        },
        {
          id: 'insight-003',
          type: 'BENCHMARK' as const,
          title: 'Another Tech Benchmark',
          description: 'Description 3',
          facts_included: ['fact-003'],
          related_articles: ['article-003'],
          confidence: 0.80,
          domain: 'technology',
          generated_at: new Date().toISOString(),
        },
      ];

      for (const insight of insights) {
        await store.add(insight);
      }

      const techInsights = await store.findByDomain('technology');
      expect(techInsights).toHaveLength(2);
      expect(techInsights.every(i => i.domain === 'technology')).toBe(true);

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

      const originalInsight: Insight = {
        id: 'insight-001',
        type: 'TREND',
        title: 'Original Title',
        description: 'Original description',
        facts_included: ['fact-001'],
        related_articles: ['article-001'],
        confidence: 0.75,
        domain: 'technology',
        generated_at: '2026-07-22T10:00:00Z',
      };

      // Add the original insight
      await store.add(originalInsight);

      // Small delay to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      // Update the insight
      const update = {
        title: 'Updated Title',
        description: 'Updated description',
        confidence: 0.95,
        facts_included: ['fact-001', 'fact-002', 'fact-003'],
      };

      const updatedInsight = await store.update('insight-001', update);

      expect(updatedInsight).not.toBeNull();
      expect(updatedInsight!.title).toBe('Updated Title');
      expect(updatedInsight!.description).toBe('Updated description');
      expect(updatedInsight!.confidence).toBe(0.95);
      expect(updatedInsight!.facts_included).toEqual(['fact-001', 'fact-002', 'fact-003']);
      expect(updatedInsight!.generated_at).toBe('2026-07-22T10:00:00Z'); // Unchanged
      expect(updatedInsight!.updated_at).toBeDefined();
      expect(new Date(updatedInsight!.updated_at!).getTime()).toBeGreaterThan(
        new Date(originalInsight.generated_at).getTime()
      );

      // Verify update persisted
      const retrieved = await store.findById('insight-001');
      expect(retrieved!.title).toBe('Updated Title');
      expect(retrieved!.updated_at).toBeDefined();
    });
  });

  describe('Test 4: Delete insights (delete)', () => {
    it('should remove insights from storage', async () => {
      const store = new InsightStore(testFilePath);

      const insights = [
        {
          id: 'insight-001',
          type: 'TREND' as const,
          title: 'First Insight',
          description: 'Description 1',
          facts_included: ['fact-001'],
          related_articles: ['article-001'],
          confidence: 0.85,
          domain: 'technology',
          generated_at: new Date().toISOString(),
        },
        {
          id: 'insight-002',
          type: 'SYNTHESIS' as const,
          title: 'Second Insight',
          description: 'Description 2',
          facts_included: ['fact-002'],
          related_articles: ['article-002'],
          confidence: 0.90,
          domain: 'health',
          generated_at: new Date().toISOString(),
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
