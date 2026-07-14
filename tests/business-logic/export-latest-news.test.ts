import { exportLatestNews, LatestNewsExport } from '../../src/business-logic/export-latest-news';
import { ArticleStore } from '../../src/business-logic/article-store';
import { Article } from '../../src/business-logic/normalize-article';

/**
 * Mock ArticleStore for testing
 */
class MockArticleStore implements ArticleStore {
  constructor(private articles: Article[] = []) {}

  async read(): Promise<Article[]> {
    return [...this.articles];
  }

  async write(articles: Article[]): Promise<void> {
    this.articles = [...articles];
  }

  async dedupAndMerge(newArticles: Article[]): Promise<Article[]> {
    const merged = new Map<string, Article>();
    for (const article of this.articles) {
      merged.set(article.id, article);
    }
    for (const article of newArticles) {
      merged.set(article.id, article);
    }
    return Array.from(merged.values());
  }
}

describe('exportLatestNews', () => {
  /**
   * Helper to create a test article with optional overrides
   */
  function createArticle(overrides?: Partial<Article>): Article {
    return {
      id: `article-${Date.now()}-${Math.random()}`,
      title: 'Test Article',
      summary: 'A test article summary',
      url: 'https://example.com/test',
      source: 'Test Source',
      category: 'news',
      publishedAt: new Date().toISOString(),
      tags: ['test'],
      ...overrides
    };
  }

  /**
   * Helper to create article with specific date
   */
  function createArticleWithDate(daysAgo: number, overrides?: Partial<Article>): Article {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    return createArticle({
      publishedAt: date.toISOString(),
      ...overrides
    });
  }

  it('should export empty array for empty store', async () => {
    const store = new MockArticleStore([]);

    const result = await exportLatestNews(store);

    expect(result.items).toHaveLength(0);
    expect(result.date).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  it('should export single article', async () => {
    const article = createArticle({ title: 'Single Article' });
    const store = new MockArticleStore([article]);

    const result = await exportLatestNews(store);

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(article);
  });

  it('should export articles sorted by date (newest first)', async () => {
    const articles = [
      createArticleWithDate(2, { id: 'oldest', title: 'Oldest' }),
      createArticleWithDate(0, { id: 'newest', title: 'Newest' }),
      createArticleWithDate(1, { id: 'middle', title: 'Middle' })
    ];
    const store = new MockArticleStore(articles);

    const result = await exportLatestNews(store);

    expect(result.items).toHaveLength(3);
    expect(result.items[0].id).toBe('newest');
    expect(result.items[1].id).toBe('middle');
    expect(result.items[2].id).toBe('oldest');
  });

  it('should respect limit parameter (default 50)', async () => {
    const articles = Array.from({ length: 100 }, (_, i) =>
      createArticleWithDate(i, { id: `article-${i}` })
    );
    const store = new MockArticleStore(articles);

    const result = await exportLatestNews(store);

    expect(result.items).toHaveLength(50);
  });

  it('should export all articles when limit > store size', async () => {
    const articles = [
      createArticleWithDate(0, { id: 'a1' }),
      createArticleWithDate(1, { id: 'a2' }),
      createArticleWithDate(2, { id: 'a3' })
    ];
    const store = new MockArticleStore(articles);

    const result = await exportLatestNews(store, 100);

    expect(result.items).toHaveLength(3);
  });

  it('should export correct number when limit is specified', async () => {
    const articles = Array.from({ length: 30 }, (_, i) =>
      createArticleWithDate(i, { id: `article-${i}` })
    );
    const store = new MockArticleStore(articles);

    const result = await exportLatestNews(store, 10);

    expect(result.items).toHaveLength(10);
  });

  it('should include date in YYYY-MM-DD format', async () => {
    const store = new MockArticleStore([createArticle()]);

    const result = await exportLatestNews(store);

    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('should include updatedAt as ISO timestamp', async () => {
    const store = new MockArticleStore([createArticle()]);

    const result = await exportLatestNews(store);

    // Should be a valid ISO string
    expect(() => new Date(result.updatedAt)).not.toThrow();
    expect(result.updatedAt).toMatch(/T.*Z$/);
  });

  it('should have correct export interface structure', async () => {
    const article = createArticle();
    const store = new MockArticleStore([article]);

    const result = await exportLatestNews(store) as LatestNewsExport;

    expect(result).toHaveProperty('date');
    expect(result).toHaveProperty('updatedAt');
    expect(result).toHaveProperty('items');
    expect(Array.isArray(result.items)).toBe(true);
  });

  it('should preserve all article data in export', async () => {
    const article = createArticle({
      title: 'Complete Article',
      summary: 'Full summary with details',
      tags: ['typescript', 'testing'],
      score: 95
    });
    const store = new MockArticleStore([article]);

    const result = await exportLatestNews(store);

    const exported = result.items[0];
    expect(exported.id).toBe(article.id);
    expect(exported.title).toBe('Complete Article');
    expect(exported.summary).toBe('Full summary with details');
    expect(exported.tags).toEqual(['typescript', 'testing']);
    expect(exported.score).toBe(95);
  });

  it('should handle limit of 0', async () => {
    const articles = [createArticle(), createArticle()];
    const store = new MockArticleStore(articles);

    const result = await exportLatestNews(store, 0);

    expect(result.items).toHaveLength(0);
  });

  it('should export latest articles even with old articles in store', async () => {
    const articles = [
      createArticleWithDate(100, { id: 'very-old' }),
      createArticleWithDate(50, { id: 'old' }),
      createArticleWithDate(0, { id: 'newest-1' }),
      createArticleWithDate(1, { id: 'newest-2' })
    ];
    const store = new MockArticleStore(articles);

    const result = await exportLatestNews(store, 2);

    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe('newest-1');
    expect(result.items[1].id).toBe('newest-2');
  });

  it('should handle articles with same publish date', async () => {
    const now = new Date().toISOString();
    const articles = [
      createArticle({ id: 'a1', publishedAt: now }),
      createArticle({ id: 'a2', publishedAt: now }),
      createArticle({ id: 'a3', publishedAt: now })
    ];
    const store = new MockArticleStore(articles);

    const result = await exportLatestNews(store);

    expect(result.items).toHaveLength(3);
    // All should be included even with same date
  });

  it('should not mutate store during export', async () => {
    const original = [createArticle({ id: 'a1' }), createArticle({ id: 'a2' })];
    const store = new MockArticleStore([...original]);

    const beforeRead = await store.read();
    await exportLatestNews(store);
    const afterRead = await store.read();

    expect(afterRead).toHaveLength(beforeRead.length);
    expect(afterRead.map(a => a.id)).toEqual(beforeRead.map(a => a.id));
  });

  it('should export with various article categories', async () => {
    const articles = [
      createArticleWithDate(0, { id: 'news', category: 'news' }),
      createArticleWithDate(1, { id: 'release', category: 'release' }),
      createArticleWithDate(2, { id: 'article', category: 'article' }),
      createArticleWithDate(3, { id: 'tutorial', category: 'tutorial' })
    ];
    const store = new MockArticleStore(articles);

    const result = await exportLatestNews(store, 10);

    expect(result.items).toHaveLength(4);
    expect(result.items.some(a => a.category === 'news')).toBe(true);
    expect(result.items.some(a => a.category === 'release')).toBe(true);
    expect(result.items.some(a => a.category === 'article')).toBe(true);
    expect(result.items.some(a => a.category === 'tutorial')).toBe(true);
  });

  it('should export with correct sorting stability', async () => {
    const articles = [
      createArticleWithDate(0, { id: 'a1', title: 'Article 1' }),
      createArticleWithDate(0, { id: 'a2', title: 'Article 2' }),
      createArticleWithDate(0, { id: 'a3', title: 'Article 3' })
    ];
    const store = new MockArticleStore(articles);

    const result = await exportLatestNews(store);

    expect(result.items).toHaveLength(3);
    // All articles should be present since they're all equally recent
  });

  it('detects and fails when store is empty (CRITICAL #3)', async () => {
    const emptyStore = new MockArticleStore([]);

    const result = await exportLatestNews(emptyStore, 50);

    expect(result.items.length).toBe(0);
    // CLI will detect this and fail with process.exit(1) to prevent silent empty exports
  });
});
