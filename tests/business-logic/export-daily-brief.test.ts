import { exportDailyBrief } from '../../src/business-logic/export-daily-brief';
import { Article } from '../../src/business-logic/normalize-article';
import { ArticleStore } from '../../src/business-logic/article-store';

// Mock ArticleStore
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
    category: 'test-automation',
    publishedAt: new Date().toISOString(),
    tags: ['test'],
    score: 50,
    ...overrides
  };
}

describe('export-daily-brief', () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const mockArticleToday = createArticle({
    id: 'test-1',
    title: 'Article from today',
    publishedAt: new Date(today.getTime() + 3600000).toISOString(), // 1 hour after midnight today
    score: 40
  });

  // Scores are deliberately ordered opposite to publish dates so a sort by score
  // would produce a different order than the date-based sort under test.
  const mockArticleYesterday = createArticle({
    id: 'test-2',
    title: 'Article from yesterday',
    publishedAt: new Date(yesterday.getTime() + 3600000).toISOString(),
    category: 'ai',
    score: 90
  });

  const mockArticleHighScore = createArticle({
    id: 'test-3',
    title: 'Latest article today',
    publishedAt: new Date(today.getTime() + 7200000).toISOString(), // 2 hours after midnight today
    category: 'engineering',
    score: 10
  });

  // The publish-date filter was removed on purpose (commit 8fbd72d, "export latest articles
  // instead of filtering by publish date"). The export now takes the newest N articles
  // regardless of which day they were published.
  test('exports top articles by publish time with no publish-date filter', async () => {
    const store = new MockArticleStore([mockArticleToday, mockArticleYesterday, mockArticleHighScore]);
    const result = await exportDailyBrief(store, 10);

    expect(result.items).toHaveLength(3); // Yesterday's article is included
    expect(result.items[0].id).toBe('test-3'); // Newest publishedAt first
    expect(result.items[1].id).toBe('test-1');
    expect(result.items[2].id).toBe('test-2');
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/); // YYYY-MM-DD format
    expect(result.storiesSelected).toBe(3);
  });

  test('respects limit parameter', async () => {
    const store = new MockArticleStore([mockArticleToday, mockArticleHighScore]);
    const result = await exportDailyBrief(store, 1); // Limit to 1

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('test-3'); // Highest score
  });

  test('includes articles from yesterday (no publish-date filter)', async () => {
    const store = new MockArticleStore([mockArticleYesterday]);
    const result = await exportDailyBrief(store, 10);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('test-2');
    expect(result.storiesSelected).toBe(1);
  });

  test('returns empty list for an empty store', async () => {
    const store = new MockArticleStore([]);
    const result = await exportDailyBrief(store, 10);

    expect(result.items).toHaveLength(0);
    expect(result.storiesSelected).toBe(0);
  });

  test('includes source count in metadata', async () => {
    const store = new MockArticleStore([mockArticleToday]);
    const result = await exportDailyBrief(store, 10, 25);

    expect(result.sourcesScanned).toBe(25);
  });

  test('generates lede from article categories', async () => {
    const store = new MockArticleStore([mockArticleToday, mockArticleHighScore]);
    const result = await exportDailyBrief(store, 10);

    expect(result.lede).toContain('Daily brief');
  });

  test('does not throw on articles with invalid dates', async () => {
    const invalidArticle = createArticle({
      id: 'test-invalid',
      title: 'Invalid date',
      publishedAt: 'not-a-date'
    });

    const store = new MockArticleStore([invalidArticle, mockArticleToday]);
    const result = await exportDailyBrief(store, 10);

    // No date filter, so both are exported. The sort comparator returns NaN for the
    // unparseable date, which is treated as equal, so the stable sort keeps input order.
    expect(result.items).toHaveLength(2);
    expect(result.items.map(a => a.id)).toEqual(['test-invalid', 'test-1']);
  });

  test('sets updatedAt to current timestamp', async () => {
    const store = new MockArticleStore([mockArticleToday]);
    const beforeTime = new Date();
    const result = await exportDailyBrief(store, 10);
    const afterTime = new Date();

    const updatedAtTime = new Date(result.updatedAt);
    expect(updatedAtTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(updatedAtTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
  });
});
