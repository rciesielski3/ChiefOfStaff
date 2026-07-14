import { persistArticles } from '../../src/business-logic/persist-articles';
import { ArticleStore } from '../../src/business-logic/article-store';
import { Article } from '../../src/business-logic/normalize-article';

/**
 * Mock ArticleStore for testing
 */
class MockArticleStore implements ArticleStore {
  private articles: Article[] = [];

  constructor(initial: Article[] = []) {
    this.articles = [...initial];
  }

  async read(): Promise<Article[]> {
    return [...this.articles];
  }

  async write(articles: Article[]): Promise<void> {
    this.articles = [...articles];
  }

  async dedupAndMerge(newArticles: Article[]): Promise<Article[]> {
    // Simple merge with deduplication by id
    const merged = new Map<string, Article>();

    for (const article of this.articles) {
      merged.set(article.id, article);
    }

    for (const article of newArticles) {
      merged.set(article.id, article);
    }

    const result = Array.from(merged.values());
    this.articles = result;
    return result;
  }
}

describe('persistArticles', () => {
  /**
   * Helper to create a test article
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

  it('should persist single article to empty store', async () => {
    const store = new MockArticleStore();
    const article = createArticle();

    await persistArticles([article], store);

    const stored = await store.read();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toEqual(article);
  });

  it('should merge articles with existing store', async () => {
    const existing = createArticle({ id: 'existing-1', title: 'Existing Article' });
    const store = new MockArticleStore([existing]);
    const newArticle = createArticle({ id: 'new-1', title: 'New Article' });

    await persistArticles([newArticle], store);

    const stored = await store.read();
    expect(stored).toHaveLength(2);
    expect(stored.some(a => a.id === 'existing-1')).toBe(true);
    expect(stored.some(a => a.id === 'new-1')).toBe(true);
  });

  it('should replace duplicate articles', async () => {
    const article1 = createArticle({
      id: 'duplicate-1',
      title: 'Original Title',
      publishedAt: '2026-07-13T10:00:00Z'
    });
    const store = new MockArticleStore([article1]);

    const article2 = createArticle({
      id: 'duplicate-1',
      title: 'Updated Title',
      publishedAt: '2026-07-14T10:00:00Z'
    });

    await persistArticles([article2], store);

    const stored = await store.read();
    expect(stored).toHaveLength(1);
    expect(stored[0].title).toBe('Updated Title');
    expect(stored[0].publishedAt).toBe('2026-07-14T10:00:00Z');
  });

  it('should persist multiple new articles', async () => {
    const store = new MockArticleStore();
    const articles = [
      createArticle({ id: 'article-1', title: 'Article 1' }),
      createArticle({ id: 'article-2', title: 'Article 2' }),
      createArticle({ id: 'article-3', title: 'Article 3' })
    ];

    await persistArticles(articles, store);

    const stored = await store.read();
    expect(stored).toHaveLength(3);
  });

  it('should handle empty article list', async () => {
    const existing = createArticle({ id: 'existing-1' });
    const store = new MockArticleStore([existing]);

    await persistArticles([], store);

    const stored = await store.read();
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('existing-1');
  });

  it('should preserve article metadata during persist', async () => {
    const store = new MockArticleStore();
    const article = createArticle({
      title: 'Complex Article',
      summary: 'A detailed summary with special chars: & < >',
      tags: ['typescript', 'testing', 'automation'],
      score: 85
    });

    await persistArticles([article], store);

    const stored = await store.read();
    expect(stored[0].title).toBe('Complex Article');
    expect(stored[0].summary).toBe('A detailed summary with special chars: & < >');
    expect(stored[0].tags).toEqual(['typescript', 'testing', 'automation']);
    expect(stored[0].score).toBe(85);
  });

  it('should deduplicate articles from same source with same title', async () => {
    const store = new MockArticleStore();
    const article1 = createArticle({
      id: 'source-article-1',
      source: 'Test Source',
      title: 'Breaking News'
    });
    const article2 = createArticle({
      id: 'source-article-1', // Same ID means duplicate
      source: 'Test Source',
      title: 'Breaking News'
    });

    await persistArticles([article1], store);
    await persistArticles([article2], store);

    const stored = await store.read();
    // Should have only one due to deduplication
    expect(stored).toHaveLength(1);
  });

  it('should call store methods correctly', async () => {
    const store = new MockArticleStore();
    const dedupAndMergeSpy = jest.spyOn(store, 'dedupAndMerge');
    const writeSpy = jest.spyOn(store, 'write');

    const articles = [createArticle()];
    await persistArticles(articles, store);

    expect(dedupAndMergeSpy).toHaveBeenCalledWith(articles);
    expect(writeSpy).toHaveBeenCalled();
  });

  it('should persist articles with various categories', async () => {
    const store = new MockArticleStore();
    const articles = [
      createArticle({ id: 'a1', category: 'news' }),
      createArticle({ id: 'a2', category: 'release' }),
      createArticle({ id: 'a3', category: 'article' }),
      createArticle({ id: 'a4', category: 'tutorial' })
    ];

    await persistArticles(articles, store);

    const stored = await store.read();
    expect(stored).toHaveLength(4);
    expect(stored.map(a => a.category)).toContain('news');
    expect(stored.map(a => a.category)).toContain('release');
    expect(stored.map(a => a.category)).toContain('article');
    expect(stored.map(a => a.category)).toContain('tutorial');
  });
});
