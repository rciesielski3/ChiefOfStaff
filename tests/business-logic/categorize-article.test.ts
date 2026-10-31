import { categorizeForQANews, primaryQANewsCategory } from '../../src/business-logic/categorize-article';
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

describe('primaryQANewsCategory', () => {
  const mockArticle = (title: string, summary: string, source: string): Article => ({
    id: 'test-1',
    title,
    summary,
    url: 'https://example.com/test',
    source,
    category: 'news',
    publishedAt: new Date().toISOString(),
    tags: []
  });

  it('should prefer content keywords over a source name match', () => {
    const article = mockArticle(
      'OpenAI ships a new model for embedding search',
      'Embedding and prompt improvements for the LLM API',
      'Ministry of Testing'
    );
    expect(primaryQANewsCategory(article)).toBe('ai');
  });

  it('should pick the category with the most keyword hits', () => {
    const article = mockArticle(
      'Playwright and Jest test suite tips',
      'Writing a faster e2e test runner setup',
      'Some Source'
    );
    expect(primaryQANewsCategory(article)).toBe('test-automation');
  });

  it('should fall back to the source match when no keyword matches', () => {
    const article = mockArticle(
      'Weekly roundup',
      'A short list of links',
      'Ministry of Testing'
    );
    expect(primaryQANewsCategory(article)).toBe('test-automation');
  });

  it('should use the engineering fallback when nothing matches', () => {
    const article = mockArticle(
      'Random Article',
      'About unrelated topics',
      'Unknown Source'
    );
    expect(primaryQANewsCategory(article)).toBe('engineering');
  });
});

describe('source matching uses whole words', () => {
  const mockArticle = (title: string, summary: string, source: string): Article => ({
    id: 'test-source-1',
    title,
    summary,
    url: 'https://example.com/source-test',
    source,
    category: 'tooling',
    publishedAt: new Date().toISOString(),
    tags: []
  });

  it('does not match the "AI" source rule inside "Email Weekly"', () => {
    const article = mockArticle('Weekly roundup', 'A short list of links', 'Email Weekly');
    expect(categorizeForQANews(article)).not.toContain('ai');
    expect(primaryQANewsCategory(article)).not.toBe('ai');
  });

  it('does not match the "AI" source rule inside "Maintainers Weekly"', () => {
    const article = mockArticle('Weekly roundup', 'A short list of links', 'Maintainers Weekly');
    expect(categorizeForQANews(article)).not.toContain('ai');
    expect(primaryQANewsCategory(article)).not.toBe('ai');
  });

  it('still matches the "AI" source rule for "AI Weekly"', () => {
    const article = mockArticle('Weekly roundup', 'A short list of links', 'AI Weekly');
    expect(categorizeForQANews(article)).toContain('ai');
    expect(primaryQANewsCategory(article)).toBe('ai');
  });
});
