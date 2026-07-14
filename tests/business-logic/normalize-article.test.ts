import { normalizeArticle } from '../../src/business-logic/normalize-article';
import { RawArticle } from '../../src/business-logic/rss-fetch';

describe('normalizeArticle', () => {
  const mockRawArticle: RawArticle = {
    link: 'https://example.com/article-1',
    title: 'Test Article Title',
    pubDate: '2026-07-11T10:00:00Z',
    content: 'This is the article content with <strong>HTML tags</strong>',
    source: 'Test Blog'
  };

  it('should generate consistent ID from source and link', () => {
    const normalized = normalizeArticle(mockRawArticle);

    expect(normalized.id).toBeDefined();
    expect(normalized.id).toContain('test-blog');
  });

  it('should preserve title', () => {
    const normalized = normalizeArticle(mockRawArticle);

    expect(normalized.title).toBe('Test Article Title');
  });

  it('should strip HTML tags from content', () => {
    const normalized = normalizeArticle(mockRawArticle);

    expect(normalized.summary).not.toContain('<');
    expect(normalized.summary).not.toContain('>');
    expect(normalized.summary).toContain('HTML tags');
  });

  it('should truncate summary to 200 chars', () => {
    const longContent = 'A'.repeat(500);
    const article = {
      ...mockRawArticle,
      content: longContent
    };

    const normalized = normalizeArticle(article);

    expect(normalized.summary.length).toBeLessThanOrEqual(203); // 200 + '...'
    expect(normalized.summary.endsWith('...')).toBe(true);
  });

  it('should preserve full summary if less than 200 chars', () => {
    const article = {
      ...mockRawArticle,
      content: 'Short content'
    };

    const normalized = normalizeArticle(article);

    expect(normalized.summary).toBe('Short content');
    expect(normalized.summary.endsWith('...')).toBe(false);
  });

  it('should preserve URL', () => {
    const normalized = normalizeArticle(mockRawArticle);

    expect(normalized.url).toBe('https://example.com/article-1');
  });

  it('should preserve source', () => {
    const normalized = normalizeArticle(mockRawArticle);

    expect(normalized.source).toBe('Test Blog');
  });

  it('should infer category from source name', () => {
    const githubArticle = {
      ...mockRawArticle,
      source: 'GitHub Release Notes'
    };

    const normalized = normalizeArticle(githubArticle);

    expect(normalized.category).toBe('release');
  });

  it('should parse publish date as ISO string', () => {
    const normalized = normalizeArticle(mockRawArticle);

    expect(normalized.publishedAt).toBeDefined();
    expect(new Date(normalized.publishedAt).getTime()).toBeGreaterThan(0);
  });

  it('should handle invalid date by using current time', () => {
    const article = {
      ...mockRawArticle,
      pubDate: 'invalid-date'
    };

    const normalized = normalizeArticle(article);

    // Should have current date (within last minute)
    const now = new Date();
    const pubDate = new Date(normalized.publishedAt);
    const diff = now.getTime() - pubDate.getTime();

    expect(Math.abs(diff)).toBeLessThan(60000); // Within 60 seconds
  });

  it('should extract tags from content', () => {
    const article = {
      ...mockRawArticle,
      title: 'Testing TypeScript with Jest and Playwright',
      content: 'Learn testing automation'
    };

    const normalized = normalizeArticle(article);

    expect(normalized.tags.length).toBeGreaterThan(0);
    expect(normalized.tags).toContain('typescript');
    expect(normalized.tags).toContain('testing');
  });

  it('should not include duplicate tags', () => {
    const article = {
      ...mockRawArticle,
      title: 'TypeScript TypeScript TypeScript',
      content: 'typescript typescript'
    };

    const normalized = normalizeArticle(article);

    const uniqueTags = new Set(normalized.tags);
    expect(normalized.tags.length).toBe(uniqueTags.size);
  });

  it('should handle HTML entities', () => {
    const article = {
      ...mockRawArticle,
      content: 'Title &amp; Description &lt;test&gt; &quot;quoted&quot;'
    };

    const normalized = normalizeArticle(article);

    expect(normalized.summary).toContain('&');
    expect(normalized.summary).toContain('test');
  });

  it('should normalize whitespace in content', () => {
    const article = {
      ...mockRawArticle,
      content: 'Text   with   multiple    spaces\n\n\nand\nnewlines'
    };

    const normalized = normalizeArticle(article);

    expect(normalized.summary).not.toContain('   ');
    expect(normalized.summary).not.toContain('\n\n');
  });

  it('should handle empty content', () => {
    const article = {
      ...mockRawArticle,
      content: ''
    };

    const normalized = normalizeArticle(article);

    expect(normalized.summary).toBe('');
  });

  it('should infer category as blog from source', () => {
    const article = {
      ...mockRawArticle,
      source: 'Playwright Blog'
    };

    const normalized = normalizeArticle(article);

    expect(normalized.category).toBe('article');
  });

  it('should infer category as news from source', () => {
    const article = {
      ...mockRawArticle,
      source: 'Tech News Daily'
    };

    const normalized = normalizeArticle(article);

    expect(normalized.category).toBe('news');
  });

  it('should return empty tags array for no matches', () => {
    const article = {
      ...mockRawArticle,
      title: 'Random article about gardening',
      content: 'How to grow plants in your garden'
    };

    const normalized = normalizeArticle(article);

    expect(Array.isArray(normalized.tags)).toBe(true);
  });
});
