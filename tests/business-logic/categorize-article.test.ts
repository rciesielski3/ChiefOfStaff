import { categorizeForQANews } from '../../src/business-logic/categorize-article';
import { Article } from '../../src/business-logic/normalize-article';

describe('categorizeForQANews', () => {
  const mockArticle = (title: string, summary: string, source: string): Article => ({
    id: 'test-1',
    title,
    summary,
    url: 'https://example.com/test',
    source,
    category: 'tooling',
    publishedAt: new Date().toISOString(),
    tags: []
  });

  it('should categorize Jest releases as test-automation using keywords', () => {
    const article = mockArticle(
      'Jest 30.0 Released',
      'Jest reaches feature parity with test runners',
      'Some Source'
    );
    const categories = categorizeForQANews(article);
    expect(categories).toContain('test-automation');
  });

  it('should categorize Vitest as test-automation using source match', () => {
    const article = mockArticle(
      'New release available',
      'Check the latest updates',
      'Vitest Releases'
    );
    const categories = categorizeForQANews(article);
    expect(categories).toContain('test-automation');
  });

  it('should categorize security articles as qa-practice using keywords', () => {
    const article = mockArticle(
      'Vulnerability in Testing',
      'OWASP Top 10 and best practice guidelines',
      'Security Blog'
    );
    const categories = categorizeForQANews(article);
    expect(categories).toContain('qa-practice');
  });

  it('should categorize engineering articles as engineering', () => {
    const article = mockArticle(
      'Architecture Patterns',
      'Engineering practices for scalable systems',
      'Tech Blog'
    );
    const categories = categorizeForQANews(article);
    expect(categories).toContain('engineering');
  });

  it('should use fallback category when no match found', () => {
    const article = mockArticle(
      'Random Article',
      'About unrelated topics',
      'Unknown Source'
    );
    const categories = categorizeForQANews(article);
    expect(categories).toContain('engineering');
  });
});
