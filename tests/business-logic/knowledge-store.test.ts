import { FactStore, getFactStore, resetFactStore } from '../../src/business-logic/knowledge-store';
import { KnowledgeFact } from '../../src/business-logic/knowledge-types';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('FactStore', () => {
  const testFilePath = 'data/test_knowledge_facts.ndjson';

  let store: FactStore;

  const mockFact: KnowledgeFact = {
    id: 'fact_001',
    article_id: 'article_001',
    content: 'Kubernetes automates container orchestration and deployment across clusters',
    type: 'DEFINITION',
    confidence: 0.95,
    extraction_method: 'claude',
    extracted_at: new Date().toISOString(),
    version: 1,
    status: 'active',
  };

  beforeEach(() => {
    store = new FactStore(testFilePath);
  });

  afterEach(async () => {
    try {
      await store.clear();
    } catch (e) {
      // Ignore cleanup errors
    }
    resetFactStore();
  });

  describe('append and deduplication', () => {
    it('should append facts to store', async () => {
      const result = await store.append([mockFact]);

      expect(result.stored).toBe(1);
      expect(result.deduplicated).toBe(0);

      const facts = await store.readAll();
      expect(facts).toHaveLength(1);
      expect(facts[0].id).toBe('fact_001');
    });

    it('should deduplicate identical facts', async () => {
      // First append
      const result1 = await store.append([mockFact]);
      expect(result1.stored).toBe(1);

      // Second append with same content (different ID)
      const duplicate: KnowledgeFact = {
        ...mockFact,
        id: 'fact_002', // Different ID, same content
      };

      const result2 = await store.append([duplicate]);
      expect(result2.stored).toBe(0);
      expect(result2.deduplicated).toBe(1);

      // Should still have only 1 fact
      const facts = await store.readAll();
      expect(facts).toHaveLength(1);
    });

    it('should handle normalization in deduplication', async () => {
      // Append original
      await store.append([mockFact]);

      // Try to append with extra whitespace
      const similar: KnowledgeFact = {
        ...mockFact,
        id: 'fact_003',
        content: 'KUBERNETES   AUTOMATES   CONTAINER   ORCHESTRATION   AND   DEPLOYMENT   ACROSS   CLUSTERS',
      };

      const result = await store.append([similar]);
      expect(result.deduplicated).toBe(1);
    });

    it('should track stats for multiple deduped/stored facts', async () => {
      const fact1 = mockFact;
      const fact2: KnowledgeFact = {
        ...mockFact,
        id: 'fact_002',
        article_id: 'article_002',
        content: 'Docker containers package applications with dependencies included always',
      };
      const fact3: KnowledgeFact = {
        ...mockFact,
        id: 'fact_003',
        content: mockFact.content, // Duplicate of fact1
      };

      const result = await store.append([fact1, fact2, fact3]);
      expect(result.stored).toBe(2);
      expect(result.deduplicated).toBe(1);
    });
  });

  describe('read operations', () => {
    it('should read all facts', async () => {
      const facts = [
        mockFact,
        {
          ...mockFact,
          id: 'fact_002',
          content: 'Docker provides containerization technology for applications',
        },
      ];

      await store.append(facts);
      const stored = await store.readAll();

      expect(stored).toHaveLength(2);
    });

    it('should read facts by article ID', async () => {
      const article1Fact: KnowledgeFact = {
        ...mockFact,
        article_id: 'article_001',
      };
      const article2Fact: KnowledgeFact = {
        ...mockFact,
        id: 'fact_002',
        article_id: 'article_002',
        content: 'Different article content for testing facts here',
      };

      await store.append([article1Fact, article2Fact]);

      const article1Facts = await store.getByArticleId('article_001');
      expect(article1Facts).toHaveLength(1);
      expect(article1Facts[0].article_id).toBe('article_001');

      const article2Facts = await store.getByArticleId('article_002');
      expect(article2Facts).toHaveLength(1);
      expect(article2Facts[0].article_id).toBe('article_002');
    });

    it('should read facts by type', async () => {
      const definitionFact: KnowledgeFact = {
        ...mockFact,
        type: 'DEFINITION',
      };
      const techniqueFact: KnowledgeFact = {
        ...mockFact,
        id: 'fact_002',
        type: 'TECHNIQUE',
        content: 'Use health checks to monitor container status effectively',
      };

      await store.append([definitionFact, techniqueFact]);

      const definitions = await store.getByType('DEFINITION');
      expect(definitions).toHaveLength(1);
      expect(definitions[0].type).toBe('DEFINITION');

      const techniques = await store.getByType('TECHNIQUE');
      expect(techniques).toHaveLength(1);
      expect(techniques[0].type).toBe('TECHNIQUE');
    });

    it('should read facts by minimum confidence', async () => {
      const highConfidence: KnowledgeFact = {
        ...mockFact,
        confidence: 0.95,
      };
      const lowConfidence: KnowledgeFact = {
        ...mockFact,
        id: 'fact_002',
        confidence: 0.60,
        content: 'Lower confidence fact with different content text',
      };

      await store.append([highConfidence, lowConfidence]);

      const highFacts = await store.getByMinConfidence(0.90);
      expect(highFacts).toHaveLength(1);
      expect(highFacts[0].confidence).toBe(0.95);

      const allFacts = await store.getByMinConfidence(0.50);
      expect(allFacts).toHaveLength(2);
    });

    it('should return empty array for non-existent store', async () => {
      const facts = await store.readAll();
      expect(facts).toEqual([]);
    });
  });

  describe('statistics', () => {
    it('should calculate statistics', async () => {
      const facts: KnowledgeFact[] = [
        { ...mockFact, type: 'DEFINITION', confidence: 0.9 },
        { ...mockFact, id: 'f2', type: 'DEFINITION', confidence: 0.95, content: 'Technique fact 1' },
        { ...mockFact, id: 'f3', type: 'TECHNIQUE', confidence: 0.85, content: 'Technique fact 2' },
        { ...mockFact, id: 'f4', type: 'PATTERN', confidence: 0.80, content: 'Pattern fact 1' },
      ];

      await store.append(facts);
      const stats = await store.getStats();

      expect(stats.total).toBe(4);
      expect(stats.byType.DEFINITION).toBe(2);
      expect(stats.byType.TECHNIQUE).toBe(1);
      expect(stats.byType.PATTERN).toBe(1);
      expect(stats.avgConfidence).toBeCloseTo(0.875, 1);
      expect(stats.byStatus.active).toBe(4);
    });

    it('should count facts', async () => {
      await store.append([mockFact]);
      expect(await store.count()).toBe(1);

      const fact2: KnowledgeFact = {
        ...mockFact,
        id: 'fact_002',
        content: 'Another fact for counting purposes',
      };
      await store.append([fact2]);
      expect(await store.count()).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should handle malformed JSON in store gracefully', async () => {
      // Manually write malformed line
      await fs.mkdir(path.dirname(testFilePath), { recursive: true });
      await fs.writeFile(testFilePath, 'not valid json\n' + JSON.stringify(mockFact) + '\n', 'utf-8');

      // Should skip malformed line and read valid one
      const facts = await store.readAll();
      expect(facts).toHaveLength(1);
      expect(facts[0].id).toBe('fact_001');
    });

    it('should create directory if it does not exist', async () => {
      const deepPath = 'data/deep/nested/path/facts.ndjson';
      const deepStore = new FactStore(deepPath);

      try {
        await deepStore.append([mockFact]);

        const facts = await deepStore.readAll();
        expect(facts).toHaveLength(1);
      } finally {
        // Cleanup
        try {
          await fs.unlink(deepPath);
        } catch (e) {
          // ignore
        }
      }
    });
  });

  describe('clear operation', () => {
    it('should clear all facts', async () => {
      await store.append([mockFact]);
      expect(await store.count()).toBe(1);

      await store.clear();
      expect(await store.count()).toBe(0);
    });
  });
});
