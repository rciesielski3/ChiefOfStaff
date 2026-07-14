import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { NdJsonArticleStore, ArticleStore } from '../../src/business-logic/article-store';
import { Article } from '../../src/business-logic/normalize-article';

describe('NdJsonArticleStore', () => {
  const testDir = '/tmp/article-store-tests';
  let testFile: string;

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    testFile = path.join(testDir, `test-${Date.now()}.ndjson`);
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('read()', () => {
    it('should return empty array for non-existent file', async () => {
      const store = new NdJsonArticleStore(testFile);
      const articles = await store.read();

      expect(articles).toEqual([]);
    });

    it('should return empty array for empty file', async () => {
      await fs.writeFile(testFile, '', 'utf-8');
      const store = new NdJsonArticleStore(testFile);
      const articles = await store.read();

      expect(articles).toEqual([]);
    });

    it('should read single article from NDJSON file', async () => {
      const article: Article = {
        id: 'test-1',
        title: 'Test Article',
        summary: 'A test article',
        url: 'https://example.com/test',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-14T10:00:00Z',
        tags: ['test']
      };

      await fs.writeFile(testFile, JSON.stringify(article) + '\n', 'utf-8');
      const store = new NdJsonArticleStore(testFile);
      const articles = await store.read();

      expect(articles).toHaveLength(1);
      expect(articles[0]).toEqual(article);
    });

    it('should read multiple articles from NDJSON file', async () => {
      const articles: Article[] = [
        {
          id: 'test-1',
          title: 'Article 1',
          summary: 'First article',
          url: 'https://example.com/1',
          source: 'Source A',
          category: 'news',
          publishedAt: '2026-07-14T10:00:00Z',
          tags: []
        },
        {
          id: 'test-2',
          title: 'Article 2',
          summary: 'Second article',
          url: 'https://example.com/2',
          source: 'Source B',
          category: 'article',
          publishedAt: '2026-07-13T10:00:00Z',
          tags: []
        }
      ];

      const content = articles.map(a => JSON.stringify(a)).join('\n') + '\n';
      await fs.writeFile(testFile, content, 'utf-8');
      const store = new NdJsonArticleStore(testFile);
      const read = await store.read();

      expect(read).toHaveLength(2);
      expect(read[0]).toEqual(articles[0]);
      expect(read[1]).toEqual(articles[1]);
    });

    it('should skip malformed JSON lines', async () => {
      const validArticle: Article = {
        id: 'test-1',
        title: 'Valid Article',
        summary: 'Valid',
        url: 'https://example.com/1',
        source: 'Source A',
        category: 'news',
        publishedAt: '2026-07-14T10:00:00Z',
        tags: []
      };

      const content = [
        JSON.stringify(validArticle),
        '{invalid json}',
        JSON.stringify(validArticle)
      ].join('\n') + '\n';

      await fs.writeFile(testFile, content, 'utf-8');
      const store = new NdJsonArticleStore(testFile);
      const articles = await store.read();

      expect(articles).toHaveLength(2);
      expect(articles[0]).toEqual(validArticle);
      expect(articles[1]).toEqual(validArticle);
    });
  });

  describe('write()', () => {
    it('should write empty array as empty file', async () => {
      const store = new NdJsonArticleStore(testFile);
      await store.write([]);

      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('');
    });

    it('should write single article to NDJSON file', async () => {
      const article: Article = {
        id: 'test-1',
        title: 'Test Article',
        summary: 'A test article',
        url: 'https://example.com/test',
        source: 'Test Source',
        category: 'news',
        publishedAt: '2026-07-14T10:00:00Z',
        tags: ['test']
      };

      const store = new NdJsonArticleStore(testFile);
      await store.write([article]);

      const content = await fs.readFile(testFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      expect(lines).toHaveLength(1);
      expect(JSON.parse(lines[0])).toEqual(article);
    });

    it('should write multiple articles to NDJSON file', async () => {
      const articles: Article[] = [
        {
          id: 'test-1',
          title: 'Article 1',
          summary: 'First',
          url: 'https://example.com/1',
          source: 'Source A',
          category: 'news',
          publishedAt: '2026-07-14T10:00:00Z',
          tags: []
        },
        {
          id: 'test-2',
          title: 'Article 2',
          summary: 'Second',
          url: 'https://example.com/2',
          source: 'Source B',
          category: 'article',
          publishedAt: '2026-07-13T10:00:00Z',
          tags: []
        }
      ];

      const store = new NdJsonArticleStore(testFile);
      await store.write(articles);

      const content = await fs.readFile(testFile, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());
      expect(lines).toHaveLength(2);
      expect(JSON.parse(lines[0])).toEqual(articles[0]);
      expect(JSON.parse(lines[1])).toEqual(articles[1]);
    });

    it('should create lock file during write', async () => {
      const article: Article = {
        id: 'test-1',
        title: 'Test',
        summary: 'Test',
        url: 'https://example.com/test',
        source: 'Source',
        category: 'news',
        publishedAt: '2026-07-14T10:00:00Z',
        tags: []
      };

      const store = new NdJsonArticleStore(testFile);

      // Check that lock doesn't exist before write
      let lockExists = fsSync.existsSync(`${testFile}.lock`);
      expect(lockExists).toBe(false);

      // Write articles
      await store.write([article]);

      // Check that lock doesn't exist after write (released)
      lockExists = fsSync.existsSync(`${testFile}.lock`);
      expect(lockExists).toBe(false);
    });
  });

  describe('dedupAndMerge()', () => {
    it('should deduplicate articles by source + title hash', async () => {
      const article1: Article = {
        id: 'test-1-v1',
        title: 'Test Article',
        summary: 'Version 1',
        url: 'https://example.com/test-v1',
        source: 'Reddit',
        category: 'news',
        publishedAt: '2026-07-14T10:00:00Z',
        tags: []
      };

      const article2: Article = {
        id: 'test-1-v2',
        title: 'Test Article', // Same title, same source
        summary: 'Version 2',
        url: 'https://example.com/test-v2',
        source: 'Reddit',
        category: 'news',
        publishedAt: '2026-07-14T11:00:00Z',
        tags: ['updated']
      };

      const store = new NdJsonArticleStore(testFile);
      await store.write([article1]);
      const merged = await store.dedupAndMerge([article2]);

      expect(merged).toHaveLength(1);
      expect(merged[0].url).toBe('https://example.com/test-v2'); // Should be the newer version
    });

    it('should keep articles with different titles from same source', async () => {
      const article1: Article = {
        id: 'test-1',
        title: 'Article 1',
        summary: 'First',
        url: 'https://example.com/1',
        source: 'Tech News',
        category: 'news',
        publishedAt: '2026-07-14T10:00:00Z',
        tags: []
      };

      const article2: Article = {
        id: 'test-2',
        title: 'Article 2', // Different title
        summary: 'Second',
        url: 'https://example.com/2',
        source: 'Tech News', // Same source
        category: 'news',
        publishedAt: '2026-07-14T11:00:00Z',
        tags: []
      };

      const store = new NdJsonArticleStore(testFile);
      await store.write([article1]);
      const merged = await store.dedupAndMerge([article2]);

      expect(merged).toHaveLength(2);
    });

    it('should keep articles with same title from different sources', async () => {
      const article1: Article = {
        id: 'test-1',
        title: 'Breaking News',
        summary: 'From source A',
        url: 'https://example.com/a',
        source: 'BBC',
        category: 'news',
        publishedAt: '2026-07-14T10:00:00Z',
        tags: []
      };

      const article2: Article = {
        id: 'test-2',
        title: 'Breaking News', // Same title
        summary: 'From source B',
        url: 'https://example.com/b',
        source: 'CNN', // Different source
        category: 'news',
        publishedAt: '2026-07-14T11:00:00Z',
        tags: []
      };

      const store = new NdJsonArticleStore(testFile);
      await store.write([article1]);
      const merged = await store.dedupAndMerge([article2]);

      expect(merged).toHaveLength(2);
    });

    it('should merge existing and new articles', async () => {
      const existing: Article = {
        id: 'existing-1',
        title: 'Existing Article',
        summary: 'Old',
        url: 'https://example.com/existing',
        source: 'Source A',
        category: 'news',
        publishedAt: '2026-07-13T10:00:00Z',
        tags: []
      };

      const newArticle: Article = {
        id: 'new-1',
        title: 'New Article',
        summary: 'New',
        url: 'https://example.com/new',
        source: 'Source B',
        category: 'article',
        publishedAt: '2026-07-14T10:00:00Z',
        tags: []
      };

      const store = new NdJsonArticleStore(testFile);
      await store.write([existing]);
      const merged = await store.dedupAndMerge([newArticle]);

      expect(merged).toHaveLength(2);
      expect(merged.some(a => a.id === 'existing-1')).toBe(true);
      expect(merged.some(a => a.id === 'new-1')).toBe(true);
    });

    it('should filter out articles older than 30 days', async () => {
      const now = new Date();
      const thirtyOneDaysAgo = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000);
      const twentyNineDaysAgo = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000);

      const oldArticle: Article = {
        id: 'old-1',
        title: 'Old Article',
        summary: 'Very old',
        url: 'https://example.com/old',
        source: 'Source A',
        category: 'news',
        publishedAt: thirtyOneDaysAgo.toISOString(),
        tags: []
      };

      const recentArticle: Article = {
        id: 'recent-1',
        title: 'Recent Article',
        summary: 'Recent',
        url: 'https://example.com/recent',
        source: 'Source B',
        category: 'news',
        publishedAt: twentyNineDaysAgo.toISOString(),
        tags: []
      };

      const store = new NdJsonArticleStore(testFile);
      await store.write([oldArticle, recentArticle]);
      const merged = await store.dedupAndMerge([]);

      expect(merged).toHaveLength(1);
      expect(merged[0].id).toBe('recent-1');
    });

    it('should sort articles by published date (newest first)', async () => {
      const articles: Article[] = [
        {
          id: 'test-1',
          title: 'Article 1',
          summary: 'First',
          url: 'https://example.com/1',
          source: 'Source A',
          category: 'news',
          publishedAt: '2026-07-11T10:00:00Z',
          tags: []
        },
        {
          id: 'test-2',
          title: 'Article 2',
          summary: 'Second',
          url: 'https://example.com/2',
          source: 'Source B',
          category: 'news',
          publishedAt: '2026-07-14T10:00:00Z',
          tags: []
        },
        {
          id: 'test-3',
          title: 'Article 3',
          summary: 'Third',
          url: 'https://example.com/3',
          source: 'Source C',
          category: 'news',
          publishedAt: '2026-07-12T10:00:00Z',
          tags: []
        }
      ];

      const store = new NdJsonArticleStore(testFile);
      const merged = await store.dedupAndMerge(articles);

      expect(merged).toHaveLength(3);
      expect(merged[0].id).toBe('test-2'); // Newest
      expect(merged[1].id).toBe('test-3'); // Middle
      expect(merged[2].id).toBe('test-1'); // Oldest
    });

    it('should persist merged articles to file', async () => {
      const article1: Article = {
        id: 'test-1',
        title: 'Article 1',
        summary: 'First',
        url: 'https://example.com/1',
        source: 'Source A',
        category: 'news',
        publishedAt: '2026-07-14T10:00:00Z',
        tags: []
      };

      const article2: Article = {
        id: 'test-2',
        title: 'Article 2',
        summary: 'Second',
        url: 'https://example.com/2',
        source: 'Source B',
        category: 'news',
        publishedAt: '2026-07-14T11:00:00Z',
        tags: []
      };

      const store = new NdJsonArticleStore(testFile);
      await store.write([article1]);
      await store.dedupAndMerge([article2]);

      // Read back from file
      const readBack = await store.read();
      expect(readBack).toHaveLength(2);
    });

    it('should handle empty new articles list', async () => {
      const article: Article = {
        id: 'test-1',
        title: 'Existing',
        summary: 'Test',
        url: 'https://example.com/test',
        source: 'Source',
        category: 'news',
        publishedAt: '2026-07-14T10:00:00Z',
        tags: []
      };

      const store = new NdJsonArticleStore(testFile);
      await store.write([article]);
      const merged = await store.dedupAndMerge([]);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual(article);
    });

    it('should handle empty existing articles', async () => {
      const newArticle: Article = {
        id: 'new-1',
        title: 'New',
        summary: 'Test',
        url: 'https://example.com/test',
        source: 'Source',
        category: 'news',
        publishedAt: '2026-07-14T10:00:00Z',
        tags: []
      };

      const store = new NdJsonArticleStore(testFile);
      const merged = await store.dedupAndMerge([newArticle]);

      expect(merged).toHaveLength(1);
      expect(merged[0]).toEqual(newArticle);
    });

    it('should handle all duplicate articles', async () => {
      const article1: Article = {
        id: 'test-1-v1',
        title: 'Duplicate Article',
        summary: 'Version 1',
        url: 'https://example.com/v1',
        source: 'Source A',
        category: 'news',
        publishedAt: '2026-07-14T10:00:00Z',
        tags: []
      };

      const article2: Article = {
        id: 'test-1-v2',
        title: 'Duplicate Article', // Same title
        summary: 'Version 2',
        url: 'https://example.com/v2',
        source: 'Source A', // Same source
        category: 'news',
        publishedAt: '2026-07-14T11:00:00Z',
        tags: []
      };

      const article3: Article = {
        id: 'test-1-v3',
        title: 'Duplicate Article', // Same title
        summary: 'Version 3',
        url: 'https://example.com/v3',
        source: 'Source A', // Same source
        category: 'news',
        publishedAt: '2026-07-14T12:00:00Z',
        tags: []
      };

      const store = new NdJsonArticleStore(testFile);
      await store.write([article1]);
      const merged = await store.dedupAndMerge([article2, article3]);

      expect(merged).toHaveLength(1);
      expect(merged[0].url).toBe('https://example.com/v3'); // Should be latest
    });

    it('should handle mixed scenario: dedup, merge, retain', async () => {
      const now = new Date();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const existing1: Article = {
        id: 'exist-1',
        title: 'Existing Article 1',
        summary: 'Exists',
        url: 'https://example.com/exist1',
        source: 'Source A',
        category: 'news',
        publishedAt: thirtyDaysAgo.toISOString(),
        tags: []
      };

      const existing2: Article = {
        id: 'exist-2',
        title: 'Duplicate With New',
        summary: 'Version 1',
        url: 'https://example.com/exist2',
        source: 'Source B',
        category: 'news',
        publishedAt: '2026-07-13T10:00:00Z',
        tags: []
      };

      const new1: Article = {
        id: 'new-1',
        title: 'New Article',
        summary: 'New',
        url: 'https://example.com/new1',
        source: 'Source C',
        category: 'news',
        publishedAt: '2026-07-14T10:00:00Z',
        tags: []
      };

      const new2: Article = {
        id: 'exist-2-v2',
        title: 'Duplicate With New', // Duplicate with existing2
        summary: 'Version 2',
        url: 'https://example.com/exist2-v2',
        source: 'Source B', // Same source
        category: 'news',
        publishedAt: '2026-07-14T11:00:00Z',
        tags: []
      };

      const store = new NdJsonArticleStore(testFile);
      await store.write([existing1, existing2]);
      const merged = await store.dedupAndMerge([new1, new2]);

      // Should have: new1 (new), new2 (merged/deduped), existing1 (old/filtered)
      expect(merged).toHaveLength(2);
      expect(merged.some(a => a.url === 'https://example.com/new1')).toBe(true);
      expect(merged.some(a => a.url === 'https://example.com/exist2-v2')).toBe(true);
      expect(merged.some(a => a.url === 'https://example.com/exist1')).toBe(false);
    });
  });

  describe('interface compliance', () => {
    it('should implement ArticleStore interface', async () => {
      const store: ArticleStore = new NdJsonArticleStore(testFile);

      expect(typeof store.read).toBe('function');
      expect(typeof store.write).toBe('function');
      expect(typeof store.dedupAndMerge).toBe('function');
    });
  });
});
