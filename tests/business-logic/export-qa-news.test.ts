import { exportQANews, articleToQANews } from '../../src/business-logic/export-qa-news';
import { Article } from '../../src/business-logic/normalize-article';

describe('exportQANews', () => {
  const mockArticle = (id: string, title: string, url: string, source: string): Article => ({
    id,
    title,
    summary: 'Test summary',
    url,
    source,
    category: 'tooling',
    publishedAt: new Date('2026-07-16T12:00:00Z').toISOString(),
    tags: ['test', 'automation']
  });

  it('should filter out placeholder URLs', () => {
    const articles = [
      mockArticle('1', 'Real Article', 'https://vitest.dev/release/2.1', 'Vitest'),
      mockArticle('2', 'Placeholder Article', 'https://example.com/fake', 'Fake')
    ];

    const result = exportQANews(articles);
    expect(result.articles).toHaveLength(1);
    expect(result.articles[0].id).toBe('1');
  });

  it('should sort by publishedAt descending', () => {
    const articles = [
      { ...mockArticle('1', 'Old', 'https://a.com/1', 'A'), publishedAt: '2026-07-14T12:00:00Z' },
      { ...mockArticle('2', 'New', 'https://b.com/2', 'B'), publishedAt: '2026-07-16T12:00:00Z' },
      { ...mockArticle('3', 'Newest', 'https://c.com/3', 'C'), publishedAt: '2026-07-17T12:00:00Z' }
    ];

    const result = exportQANews(articles);
    expect(result.articles[0].id).toBe('3');
    expect(result.articles[1].id).toBe('2');
    expect(result.articles[2].id).toBe('1');
  });

  it('should limit to N articles', () => {
    const articles = Array.from({ length: 100 }, (_, i) =>
      mockArticle(`${i}`, `Article ${i}`, `https://a.com/${i}`, 'Source')
    );

    const result = exportQANews(articles, 30);
    expect(result.articles).toHaveLength(30);
  });

  it('should map article fields to QA-News format via articleToQANews', () => {
    const article = mockArticle('42', 'Playwright 2.0 Released', 'https://playwright.dev/release/2.0', 'Playwright');
    const result = articleToQANews(article);

    expect(result.id).toBe('42');
    expect(result.title).toBe('Playwright 2.0 Released');
    expect(result.url).toBe('https://playwright.dev/release/2.0');
    expect(result.source).toBe('Playwright');
    expect(result.tags).toEqual(['test', 'automation']);
    expect(typeof result.category).toBe('string');
    expect(result.category.length).toBeGreaterThan(0);
  });
});
