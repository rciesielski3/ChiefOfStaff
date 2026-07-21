import { persistArticles } from '../../src/business-logic/persist-articles';
import { Article } from '../../src/business-logic/normalize-article';
import { ArticleStore } from '../../src/business-logic/article-store';

/**
 * Mock ArticleStore for testing CLI integration
 */
class MockArticleStore implements ArticleStore {
  private articles: Article[] = [];
  dedupAndMergeSpy = jest.fn();
  writeSpy = jest.fn();

  constructor(initial: Article[] = []) {
    this.articles = [...initial];
  }

  async read(): Promise<Article[]> {
    return [...this.articles];
  }

  async write(articles: Article[]): Promise<void> {
    this.writeSpy(articles);
    this.articles = [...articles];
  }

  async dedupAndMerge(newArticles: Article[]): Promise<Article[]> {
    this.dedupAndMergeSpy(newArticles);
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

describe('Daily Brief Article Persistence', () => {
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
      score: 90,
      ...overrides
    };
  }

  it('persists articles to store after generation', async () => {
    // This test verifies the fix for CRITICAL #1
    const mockStore = new MockArticleStore();

    const testArticles = [
      createArticle({
        id: '1',
        title: 'Test',
        summary: 'Test summary',
        url: 'https://test.com',
        source: 'test',
        category: 'test',
        score: 90
      })
    ];

    await persistArticles(testArticles, mockStore);

    expect(mockStore.dedupAndMergeSpy).toHaveBeenCalledWith(testArticles);
    expect(mockStore.writeSpy).toHaveBeenCalled();
  });

  it('persists multiple articles to store', async () => {
    const mockStore = new MockArticleStore();

    const testArticles = [
      createArticle({ id: '1', title: 'Article 1', score: 95 }),
      createArticle({ id: '2', title: 'Article 2', score: 85 }),
      createArticle({ id: '3', title: 'Article 3', score: 75 })
    ];

    await persistArticles(testArticles, mockStore);

    expect(mockStore.dedupAndMergeSpy).toHaveBeenCalledWith(testArticles);
    expect(mockStore.writeSpy).toHaveBeenCalled();
  });

  it('persists articles with score metadata', async () => {
    const mockStore = new MockArticleStore();

    const testArticles = [
      createArticle({
        id: 'scored-1',
        title: 'Scored Article',
        score: 95
      })
    ];

    await persistArticles(testArticles, mockStore);

    const passedArticles = mockStore.dedupAndMergeSpy.mock.calls[0][0];
    expect(passedArticles[0].score).toBe(95);
  });

  it('handles empty article list gracefully', async () => {
    const mockStore = new MockArticleStore();

    await persistArticles([], mockStore);

    expect(mockStore.dedupAndMergeSpy).toHaveBeenCalledWith([]);
    expect(mockStore.writeSpy).toHaveBeenCalled();
  });
});
