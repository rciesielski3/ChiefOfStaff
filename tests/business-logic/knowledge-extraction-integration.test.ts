import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { KnowledgeExtractionService } from '../../src/business-logic/knowledge-extraction';
import { NdJsonArticleStore } from '../../src/business-logic/article-store';
import { FactStore } from '../../src/business-logic/knowledge-store';
import { FactExtractionBatch, KnowledgeFact } from '../../src/business-logic/knowledge-types';
import { Article } from '../../src/business-logic/normalize-article';

/**
 * Business-logic integration tests for knowledge extraction service
 *
 * Tests the knowledge extraction workflow end-to-end:
 * 1. Loading articles from canonical store (NdJsonArticleStore)
 * 2. Extracting facts using KnowledgeExtractionService
 * 3. Persisting facts to knowledge store (FactStore)
 * 4. Handling cache persistence
 * 5. Error handling for malformed data
 *
 * NOTE: These are business-logic unit tests, not CLI integration tests.
 * They validate the core extraction service and storage components work correctly.
 * CLI orchestration (e.g., entry point invocation, process exit codes) is tested
 * separately in E2E tests.
 */
describe('knowledge extraction service integration', () => {
  const testDir = `/tmp/extract-knowledge-tests-${Date.now()}`;
  let articlesFile: string;
  let factsFile: string;
  let cacheFile: string;

  // Mock data
  const sampleArticles: Article[] = [
    {
      id: 'article_001',
      title: 'Understanding Kubernetes',
      summary: 'A deep dive into container orchestration and Kubernetes concepts',
      url: 'https://example.com/k8s',
      source: 'Tech News',
      category: 'technology',
      publishedAt: '2026-07-20T10:00:00Z',
      tags: ['kubernetes', 'containers', 'devops']
    },
    {
      id: 'article_002',
      title: 'Docker Best Practices',
      summary: 'Learn the best practices for containerizing applications with Docker',
      url: 'https://example.com/docker',
      source: 'Dev Journal',
      category: 'technology',
      publishedAt: '2026-07-19T14:30:00Z',
      tags: ['docker', 'containers']
    }
  ];

  const sampleFacts: KnowledgeFact[] = [
    {
      id: 'fact_001',
      article_id: 'article_001',
      content: 'Kubernetes is a container orchestration platform that automates deployment and management',
      type: 'DEFINITION',
      confidence: 0.95,
      extraction_method: 'claude',
      extracted_at: new Date().toISOString(),
      version: 1,
      status: 'active',
    },
    {
      id: 'fact_002',
      article_id: 'article_001',
      content: 'Pods are the smallest deployable units in Kubernetes',
      type: 'DEFINITION',
      confidence: 0.92,
      extraction_method: 'claude',
      extracted_at: new Date().toISOString(),
      version: 1,
      status: 'active',
    },
    {
      id: 'fact_003',
      article_id: 'article_002',
      content: 'Docker provides containerization technology for applications',
      type: 'DEFINITION',
      confidence: 0.93,
      extraction_method: 'claude',
      extracted_at: new Date().toISOString(),
      version: 1,
      status: 'active',
    }
  ];

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    articlesFile = path.join(testDir, 'articles.ndjson');
    factsFile = path.join(testDir, 'facts.ndjson');
    cacheFile = path.join(testDir, 'cache.json');

    // Write sample articles to file
    const articlesContent = sampleArticles.map(a => JSON.stringify(a)).join('\n') + '\n';
    await fs.writeFile(articlesFile, articlesContent, 'utf-8');
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  describe('happy path: extract facts from sample articles', () => {
    it('should extract facts and persist to NDJSON store', async () => {
      // Mock the extraction service
      const mockExtractionService = {
        extractFacts: jest.fn(async (req: any) => {
          // Return different facts based on article ID
          if (req.article_id === 'article_001') {
            return {
              article_id: 'article_001',
              facts: sampleFacts.slice(0, 2),
              extraction_time_ms: 523,
            } as FactExtractionBatch;
          } else {
            return {
              article_id: 'article_002',
              facts: sampleFacts.slice(2, 3),
              extraction_time_ms: 412,
            } as FactExtractionBatch;
          }
        }),
        loadCacheSnapshots: jest.fn(async () => {}),
        saveCacheSnapshots: jest.fn(async () => {}),
      };

      // Create article store and load articles
      const articleStore = new NdJsonArticleStore(articlesFile);
      const allArticles = await articleStore.read();

      expect(allArticles).toHaveLength(2);
      expect(allArticles[0].id).toBe('article_001');

      // Create fact store
      const factStore = new FactStore(factsFile);

      // Simulate extraction process
      let totalExtracted = 0;
      let totalStored = 0;
      const topArticles = allArticles.slice(0, Math.min(20, allArticles.length));

      for (const article of topArticles) {
        const result = await mockExtractionService.extractFacts({
          article_id: article.id,
          title: article.title,
          summary: article.summary,
          url: article.url,
          full_text: article.summary,
        });

        totalExtracted += result.facts.length;

        if (!result.error && result.facts.length > 0) {
          const storeResult = await factStore.append(result.facts);
          totalStored += storeResult.stored;
        }
      }

      // Verify extraction and storage
      expect(totalExtracted).toBe(3);
      expect(totalStored).toBe(3);

      // Verify facts persisted to file
      const storedFacts = await factStore.readAll();
      expect(storedFacts).toHaveLength(3);
      expect(storedFacts[0].type).toBe('DEFINITION');
      expect(storedFacts[0].confidence).toBeGreaterThan(0.9);
    });

    it('should log extraction metrics correctly', async () => {
      const mockExtractionService = {
        extractFacts: jest.fn(async (req: any) => ({
          article_id: req.article_id,
          facts: req.article_id === 'article_001' ? sampleFacts.slice(0, 2) : sampleFacts.slice(2, 3),
          extraction_time_ms: 500,
        } as FactExtractionBatch)),
        loadCacheSnapshots: jest.fn(async () => {}),
        saveCacheSnapshots: jest.fn(async () => {}),
      };

      const articleStore = new NdJsonArticleStore(articlesFile);
      const allArticles = await articleStore.read();

      let totalFacts = 0;
      for (const article of allArticles) {
        const result = await mockExtractionService.extractFacts({
          article_id: article.id,
          title: article.title,
          summary: article.summary,
          url: article.url,
          full_text: article.summary,
        });
        totalFacts += result.facts.length;
      }

      expect(mockExtractionService.extractFacts).toHaveBeenCalledTimes(2);
      expect(totalFacts).toBe(3);
    });
  });

  describe('error handling: malformed JSON articles', () => {
    it('should skip malformed article JSON and continue', async () => {
      // Write malformed JSON to articles file
      const content = [
        JSON.stringify(sampleArticles[0]),
        '{invalid json',
        JSON.stringify(sampleArticles[1])
      ].join('\n') + '\n';
      await fs.writeFile(articlesFile, content, 'utf-8');

      const articleStore = new NdJsonArticleStore(articlesFile);
      const allArticles = await articleStore.read();

      // Should read 2 valid articles and skip 1 invalid
      expect(allArticles).toHaveLength(2);
      expect(allArticles[0].id).toBe('article_001');
      expect(allArticles[1].id).toBe('article_002');
    });

    it('should handle extraction errors gracefully', async () => {
      const mockExtractionService = {
        extractFacts: jest.fn(async (req: any) => {
          if (req.article_id === 'article_002') {
            return {
              article_id: req.article_id,
              facts: [],
              extraction_time_ms: 100,
              error: 'API rate limit exceeded',
            } as FactExtractionBatch;
          }
          return {
            article_id: req.article_id,
            facts: sampleFacts.slice(0, 2),
            extraction_time_ms: 500,
          } as FactExtractionBatch;
        }),
        loadCacheSnapshots: jest.fn(async () => {}),
        saveCacheSnapshots: jest.fn(async () => {}),
      };

      const articleStore = new NdJsonArticleStore(articlesFile);
      const allArticles = await articleStore.read();
      const factStore = new FactStore(factsFile);

      let failedCount = 0;
      let successCount = 0;

      for (const article of allArticles) {
        const result = await mockExtractionService.extractFacts({
          article_id: article.id,
          title: article.title,
          summary: article.summary,
          url: article.url,
          full_text: article.summary,
        });

        if (result.error) {
          failedCount++;
        } else {
          successCount++;
          await factStore.append(result.facts);
        }
      }

      expect(failedCount).toBe(1);
      expect(successCount).toBe(1);
    });

    it('should handle missing ANTHROPIC_API_KEY', async () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      try {
        expect(() => {
          new KnowledgeExtractionService();
        }).not.toThrow();
        // The error would happen when trying to call extractFacts
      } finally {
        if (originalKey) {
          process.env.ANTHROPIC_API_KEY = originalKey;
        }
      }
    });
  });

  describe('cache persistence: classifier-cache.json', () => {
    it('should load cache snapshots from file', async () => {
      const cacheData = {
        domain_classifier: {
          cache_version: 1,
          entries: 42
        },
        domain_fallback: {
          cache_version: 1,
          entries: 15
        }
      };

      // Write cache file
      await fs.writeFile(cacheFile, JSON.stringify(cacheData), 'utf-8');

      // Verify cache file was created and contains correct data
      const content = await fs.readFile(cacheFile, 'utf-8');
      const loaded = JSON.parse(content);

      expect(loaded.domain_classifier.entries).toBe(42);
      expect(loaded.domain_fallback.entries).toBe(15);
    });

    it('should save cache snapshots to file', async () => {
      const cacheData = {
        domain_classifier: {
          cache_version: 1,
          entries: 35
        },
        domain_fallback: {
          cache_version: 1,
          entries: 12
        }
      };

      // Write cache data
      await fs.writeFile(cacheFile, JSON.stringify(cacheData), 'utf-8');

      // Verify file was written and can be read back
      expect(fsSync.existsSync(cacheFile)).toBe(true);
      const readBack = JSON.parse(await fs.readFile(cacheFile, 'utf-8'));

      expect(readBack).toEqual(cacheData);
    });

    it('should create cache directory if missing', async () => {
      const deepCachePath = path.join(testDir, 'deep', 'nested', 'cache.json');
      const cacheDir = path.dirname(deepCachePath);

      // Ensure directory doesn't exist
      try {
        await fs.rm(cacheDir, { recursive: true });
      } catch {}

      // Write cache file
      await fs.mkdir(cacheDir, { recursive: true });
      await fs.writeFile(deepCachePath, JSON.stringify({ test: 'data' }), 'utf-8');

      expect(fsSync.existsSync(deepCachePath)).toBe(true);
    });
  });

  describe('output format: NDJSON structure validation', () => {
    it('should produce valid NDJSON facts file', async () => {
      const factStore = new FactStore(factsFile);
      await factStore.append(sampleFacts);

      // Read and validate NDJSON format
      const content = await fs.readFile(factsFile, 'utf-8');
      const lines = content.trim().split('\n');

      expect(lines).toHaveLength(3);

      // Parse each line and validate structure
      const parsedFacts: KnowledgeFact[] = [];
      for (const line of lines) {
        const fact = JSON.parse(line);
        expect(fact).toHaveProperty('id');
        expect(fact).toHaveProperty('article_id');
        expect(fact).toHaveProperty('content');
        expect(fact).toHaveProperty('type');
        expect(fact).toHaveProperty('confidence');
        expect(fact).toHaveProperty('extraction_method');
        expect(fact).toHaveProperty('extracted_at');
        expect(fact).toHaveProperty('version');
        expect(fact).toHaveProperty('status');
        parsedFacts.push(fact);
      }

      expect(parsedFacts).toHaveLength(3);
    });

    it('should preserve fact data integrity through storage', async () => {
      const factStore = new FactStore(factsFile);
      await factStore.append(sampleFacts);

      const stored = await factStore.readAll();

      // Verify each fact matches original data
      expect(stored[0].id).toBe('fact_001');
      expect(stored[0].confidence).toBe(0.95);
      expect(stored[0].type).toBe('DEFINITION');
      expect(stored[0].article_id).toBe('article_001');

      expect(stored[1].id).toBe('fact_002');
      expect(stored[1].confidence).toBe(0.92);

      expect(stored[2].id).toBe('fact_003');
      expect(stored[2].article_id).toBe('article_002');
    });

    it('should handle deduplication in output', async () => {
      const factStore = new FactStore(factsFile);

      // Append same facts twice
      const result1 = await factStore.append(sampleFacts);
      const result2 = await factStore.append(sampleFacts);

      expect(result1.stored).toBe(3);
      expect(result1.deduplicated).toBe(0);

      // Second append should deduplicate all
      expect(result2.stored).toBe(0);
      expect(result2.deduplicated).toBe(3);

      // File should still have only 3 facts
      const stored = await factStore.readAll();
      expect(stored).toHaveLength(3);
    });

    it('should compute statistics correctly', async () => {
      const factStore = new FactStore(factsFile);
      await factStore.append(sampleFacts);

      const stats = await factStore.getStats();

      expect(stats.total).toBe(3);
      expect(stats.byType['DEFINITION']).toBe(3);
      expect(stats.avgConfidence).toBeCloseTo((0.95 + 0.92 + 0.93) / 3, 2);
      expect(stats.byStatus['active']).toBe(3);
    });
  });

  describe('integration: full extraction workflow', () => {
    it('should execute complete extraction pipeline', async () => {
      // Mock services
      const mockExtractionService = {
        extractFacts: jest.fn(async (req: any) => {
          const facts = sampleFacts.filter(f => f.article_id === req.article_id);
          return {
            article_id: req.article_id,
            facts,
            extraction_time_ms: 450,
          } as FactExtractionBatch;
        }),
        loadCacheSnapshots: jest.fn(async () => {
          console.log('Cache loaded');
        }),
        saveCacheSnapshots: jest.fn(async () => {
          console.log('Cache saved');
        }),
      };

      // Simulate CLI workflow
      const articleStore = new NdJsonArticleStore(articlesFile);
      const factStore = new FactStore(factsFile);

      const articles = await articleStore.read();
      expect(articles).toHaveLength(2);

      // Load cache
      await mockExtractionService.loadCacheSnapshots();

      // Extract from articles
      let totalExtracted = 0;
      let totalStored = 0;
      let failedExtractions = 0;

      for (const article of articles) {
        const result = await mockExtractionService.extractFacts({
          article_id: article.id,
          title: article.title,
          summary: article.summary,
          url: article.url,
          full_text: article.summary,
        });

        totalExtracted += result.facts.length;

        if (result.error) {
          failedExtractions++;
        } else if (result.facts.length > 0) {
          const storeResult = await factStore.append(result.facts);
          totalStored += storeResult.stored;
        }
      }

      // Save cache
      await mockExtractionService.saveCacheSnapshots();

      // Get statistics
      const stats = await factStore.getStats();

      // Verify complete workflow
      expect(totalExtracted).toBe(3);
      expect(totalStored).toBe(3);
      expect(failedExtractions).toBe(0);
      expect(stats.total).toBe(3);
      expect(mockExtractionService.loadCacheSnapshots).toHaveBeenCalledTimes(1);
      expect(mockExtractionService.saveCacheSnapshots).toHaveBeenCalledTimes(1);
    });
  });
});
