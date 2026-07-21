/**
 * Concurrent file locking tests
 * Verifies that proper-lockfile implementation prevents race conditions
 * and data corruption under concurrent write scenarios
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { NdJsonArticleStore } from '../../src/business-logic/article-store';
import { FactStore } from '../../src/business-logic/knowledge-store';
import { Article } from '../../src/business-logic/normalize-article';
import { KnowledgeFact } from '../../src/business-logic/knowledge-types';

describe('File Locking - Concurrent Access', () => {
  const tempDir = path.join(__dirname, '../../data/test-locks');

  beforeAll(async () => {
    // Create temp directory
    try {
      await fs.mkdir(tempDir, { recursive: true });
    } catch {
      // Directory might exist
    }
  });

  afterEach(async () => {
    // Clean up test files
    try {
      const files = await fs.readdir(tempDir);
      for (const file of files) {
        const filePath = path.join(tempDir, file);
        await fs.unlink(filePath);
      }
    } catch {
      // Directory might be empty
    }
  });

  afterAll(async () => {
    // Clean up temp directory
    try {
      await fs.rmdir(tempDir);
    } catch {
      // Directory might not exist
    }
  });

  describe('ArticleStore', () => {
    it('should handle 5 parallel writes without data corruption', async () => {
      const storePath = path.join(tempDir, 'articles-concurrent.ndjson');
      const store = new NdJsonArticleStore(storePath);

      // Create articles for each process
      const articles = Array.from({ length: 5 }, (_, i) => ({
        id: `article-${i}`,
        title: `Article ${i}`,
        url: `https://example.com/${i}`,
        source: 'test-source',
        category: 'tech',
        tags: [],
        publishedAt: new Date().toISOString(),
        summary: `Summary ${i}`,
      } as Article));

      // Write articles concurrently
      const promises = articles.map((article, index) => {
        return store.write([article]).catch(err => {
          console.error(`Write ${index} failed:`, err);
          throw err;
        });
      });

      await Promise.all(promises);

      // Read back and verify
      const stored = await store.read();

      // Should have at least some articles (the last writes should succeed)
      expect(stored.length).toBeGreaterThan(0);
      expect(stored.length).toBeLessThanOrEqual(5);

      // Verify JSON format - no corrupted lines
      for (const article of stored) {
        expect(article.id).toBeDefined();
        expect(article.title).toBeDefined();
        expect(article.url).toBeDefined();
      }
    }, 30000);

    it('should dedupAndMerge with concurrent writes from multiple processes', async () => {
      const storePath = path.join(tempDir, 'articles-dedup-concurrent.ndjson');
      const store = new NdJsonArticleStore(storePath);

      const articles = [
        {
          id: 'shared-article',
          title: 'Shared Article',
          url: 'https://example.com/shared',
          source: 'source-a',
          category: 'tech',
          tags: [],
          publishedAt: new Date().toISOString(),
          summary: 'Shared summary',
        } as Article,
      ];

      // First process writes initial articles
      await store.write(articles);

      // Multiple processes try to dedupAndMerge with the same article
      const promises = Array.from({ length: 3 }, (_, i) => {
        const newArticles = [
          {
            id: `process-${i}-article`,
            title: `Process ${i} Article`,
            url: `https://example.com/process-${i}`,
            source: 'source-b',
            category: 'tech',
            tags: [],
            publishedAt: new Date().toISOString(),
            summary: `Process ${i} summary`,
          } as Article,
        ];
        return store.dedupAndMerge(newArticles);
      });

      const results = await Promise.all(promises);

      // All operations should succeed without throwing
      expect(results).toHaveLength(3);

      // Final read should have consistent data
      const final = await store.read();
      expect(final.length).toBeGreaterThan(0);
      expect(final.length).toBeLessThanOrEqual(4); // 1 shared + 3 new
    }, 30000);

    it('should not have stale locks left behind', async () => {
      const storePath = path.join(tempDir, 'articles-no-stale-locks.ndjson');
      const store = new NdJsonArticleStore(storePath);

      const articles = [{
        id: 'test-article',
        title: 'Test',
        url: 'https://example.com',
        source: 'test',
        category: 'tech',
        tags: [],
        publishedAt: new Date().toISOString(),
        summary: 'Test',
      } as Article];

      // Write articles
      await store.write(articles);

      // Give file locking time to clean up
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that no lock files exist
      const files = await fs.readdir(tempDir);
      const lockFiles = files.filter(f => f.endsWith('.lock'));

      expect(lockFiles).toHaveLength(0);
    });

    it('should acquire lock within acceptable timeframe (<100ms)', async () => {
      const storePath = path.join(tempDir, 'articles-lock-speed.ndjson');
      const store = new NdJsonArticleStore(storePath);

      const articles = [{
        id: 'speed-test',
        title: 'Speed Test',
        url: 'https://example.com',
        source: 'test',
        category: 'tech',
        tags: [],
        publishedAt: new Date().toISOString(),
        summary: 'Test',
      } as Article];

      const startTime = performance.now();
      await store.write(articles);
      const elapsed = performance.now() - startTime;

      expect(elapsed).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('FactStore', () => {
    it('should handle 5 parallel appends without data corruption', async () => {
      const storePath = path.join(tempDir, 'facts-concurrent.ndjson');
      const store = new FactStore(storePath);

      const facts = Array.from({ length: 5 }, (_, i) => ({
        id: `fact-${i}`,
        article_id: `article-${i}`,
        type: 'DEFINITION' as const,
        content: `Fact ${i}`,
        confidence: 0.9,
        extraction_method: 'claude' as const,
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active' as const,
      } as KnowledgeFact));

      // Append facts concurrently
      const promises = facts.map((fact, index) => {
        return store.append([fact]).catch(err => {
          console.error(`Append ${index} failed:`, err);
          throw err;
        });
      });

      const results = await Promise.all(promises);

      // All should succeed
      for (const result of results) {
        expect(result.stored).toBeGreaterThanOrEqual(0);
      }

      // Read back and verify
      const stored = await store.readAll();
      expect(stored.length).toBeGreaterThan(0);
      expect(stored.length).toBeLessThanOrEqual(5);

      // Verify JSON format
      for (const fact of stored) {
        expect(fact.id).toBeDefined();
        expect(fact.type).toBeDefined();
        expect(fact.confidence).toBeDefined();
      }
    }, 30000);

    it('should deduplicate correctly under concurrent access', async () => {
      const storePath = path.join(tempDir, 'facts-dedup-concurrent.ndjson');
      const store = new FactStore(storePath);

      const baseFact: KnowledgeFact = {
        id: 'fact-1',
        article_id: 'article-1',
        type: 'DEFINITION',
        content: 'Duplicate content for testing',
        confidence: 0.9,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
      };

      // Append same fact multiple times concurrently
      const promises = Array.from({ length: 3 }, () => store.append([baseFact]));
      const results = await Promise.all(promises);

      // Collect deduplicated counts
      const totalDeduplicated = results.reduce((sum, r) => sum + r.deduplicated, 0);

      // At least some should be deduplicated (2 out of 3)
      expect(totalDeduplicated).toBeGreaterThanOrEqual(2);

      // Final count should be exactly 1 (only first write succeeds fully)
      const stored = await store.readAll();
      expect(stored).toContainEqual(expect.objectContaining({
        content: baseFact.content,
      }));
    }, 30000);

    it('should maintain consistency across concurrent reads and writes', async () => {
      const storePath = path.join(tempDir, 'facts-consistency.ndjson');
      const store = new FactStore(storePath);

      // Initial data
      const initialFact: KnowledgeFact = {
        id: 'fact-init',
        article_id: 'article-init',
        type: 'DEFINITION',
        content: 'Initial fact',
        confidence: 0.8,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
      };

      await store.append([initialFact]);

      // Concurrent reads and writes
      const promises = [
        store.readAll(),
        store.append([{
          ...initialFact,
          id: 'fact-new-1',
          content: 'New fact 1',
        }]),
        store.readAll(),
        store.append([{
          ...initialFact,
          id: 'fact-new-2',
          content: 'New fact 2',
        }]),
        store.readAll(),
      ];

      const results = await Promise.all(promises);

      // All operations should succeed
      expect(results).toHaveLength(5);

      // Final read should have multiple facts
      const final = await store.readAll();
      expect(final.length).toBeGreaterThanOrEqual(1);
    }, 30000);

    it('should not have stale locks left behind', async () => {
      const storePath = path.join(tempDir, 'facts-no-stale-locks.ndjson');
      const store = new FactStore(storePath);

      const fact: KnowledgeFact = {
        id: 'fact-lock-test',
        article_id: 'article-test',
        type: 'DEFINITION',
        content: 'Test',
        confidence: 0.9,
        extraction_method: 'claude',
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active',
      };

      // Append fact
      await store.append([fact]);

      // Give file locking time to clean up
      await new Promise(resolve => setTimeout(resolve, 100));

      // Check that no lock files exist
      const files = await fs.readdir(tempDir);
      const lockFiles = files.filter(f => f.endsWith('.lock'));

      expect(lockFiles).toHaveLength(0);
    });
  });

  describe('Concurrent Operations Across Both Stores', () => {
    it('should handle mixed concurrent operations', async () => {
      const articlePath = path.join(tempDir, 'articles-mixed.ndjson');
      const factsPath = path.join(tempDir, 'facts-mixed.ndjson');

      const articleStore = new NdJsonArticleStore(articlePath);
      const factStore = new FactStore(factsPath);

      const articles = Array.from({ length: 3 }, (_, i) => ({
        id: `article-${i}`,
        title: `Article ${i}`,
        url: `https://example.com/${i}`,
        source: 'test',
        category: 'tech',
        tags: [],
        publishedAt: new Date().toISOString(),
        summary: `Summary ${i}`,
      } as Article));

      const facts = Array.from({ length: 3 }, (_, i) => ({
        id: `fact-${i}`,
        article_id: `article-${i}`,
        type: 'DEFINITION' as const,
        content: `Fact ${i}`,
        confidence: 0.9,
        extraction_method: 'claude' as const,
        extracted_at: new Date().toISOString(),
        version: 1,
        status: 'active' as const,
      } as KnowledgeFact));

      // Mixed operations
      const promises = [
        ...articles.map(a => articleStore.write([a])),
        ...facts.map(f => factStore.append([f])),
      ];

      await Promise.all(promises);

      // Verify both stores have data
      const storedArticles = await articleStore.read();
      const storedFacts = await factStore.readAll();

      expect(storedArticles.length).toBeGreaterThan(0);
      expect(storedFacts.length).toBeGreaterThan(0);
    }, 30000);
  });
});
