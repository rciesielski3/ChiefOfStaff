import { normalizeArticle, truncateDescription, buildArticleId, assertUniqueArticleIds } from '../../src/business-logic/normalize-article';
import { RawArticle } from '../../src/business-logic/rss-fetch';

describe('buildArticleId', () => {
  it('gives different URLs with the same host different IDs', () => {
    const a = buildArticleId('Cloudflare', 'https://blog.cloudflare.com/post-a/');
    const b = buildArticleId('Cloudflare', 'https://blog.cloudflare.com/post-b/');
    expect(a).not.toEqual(b);
  });

  it('gives the same URL a stable ID with the source-slug prefix', () => {
    const url = 'https://blog.cloudflare.com/post-a/';
    expect(buildArticleId('Cloudflare', url)).toEqual(buildArticleId('Cloudflare', url));
    expect(buildArticleId('Cloudflare', url)).toMatch(/^cloudflare-[0-9a-f]{16}$/);
  });
});

describe('assertUniqueArticleIds', () => {
  it('passes when IDs are distinct', () => {
    expect(() => assertUniqueArticleIds([
      { id: 'a', url: 'https://x.test/1' },
      { id: 'b', url: 'https://x.test/2' }
    ])).not.toThrow();
  });

  it('allows the same URL to appear twice', () => {
    expect(() => assertUniqueArticleIds([
      { id: 'a', url: 'https://x.test/1' },
      { id: 'a', url: 'https://x.test/1' }
    ])).not.toThrow();
  });

  it('throws when two different URLs share one ID', () => {
    expect(() => assertUniqueArticleIds([
      { id: 'a', url: 'https://x.test/1' },
      { id: 'a', url: 'https://x.test/2' }
    ])).toThrow(/Article ID collision: "a"/);
  });
});

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

  it('should generate distinct IDs for different links on the same host', () => {
    const first = normalizeArticle({ ...mockRawArticle, link: 'https://www.infoq.com/news/2026/10/a/' });
    const second = normalizeArticle({ ...mockRawArticle, link: 'https://www.infoq.com/news/2026/10/b/' });

    expect(first.id).not.toEqual(second.id);
  });

  it('should generate the same ID for the same link', () => {
    const first = normalizeArticle(mockRawArticle);
    const second = normalizeArticle({ ...mockRawArticle });

    expect(first.id).toEqual(second.id);
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

describe('normalizeArticle description', () => {
  const base: RawArticle = {
    link: 'https://example.com/desc',
    title: 'Description Article',
    pubDate: '2026-07-11T10:00:00Z',
    content: '',
    source: 'Test Blog'
  };

  it('strips HTML and entities from description', () => {
    const normalized = normalizeArticle({
      ...base,
      content: '<p>First <strong>bold</strong> &amp; clear.</p>'
    });

    expect(normalized.description).toBe('First bold & clear.');
    expect(normalized.description).not.toContain('<');
  });

  it('omits description when cleaned content is empty', () => {
    const normalized = normalizeArticle({ ...base, content: '  <p> </p>  ' });

    expect(normalized.description).toBeUndefined();
    expect('description' in normalized).toBe(false);
  });

  it('equals cleaned text for short content', () => {
    const normalized = normalizeArticle({ ...base, content: 'Short <em>content</em> here.' });

    expect(normalized.description).toBe('Short content here.');
  });

  it('keeps description within 400 chars and ends on a sentence boundary or ellipsis', () => {
    const sentence = 'This is a sentence about testing. ';
    const normalized = normalizeArticle({ ...base, content: sentence.repeat(30) });

    expect(normalized.description!.length).toBeLessThanOrEqual(400);
    expect(normalized.description!.endsWith('.')).toBe(true);
  });

  it('keeps summary output unchanged for an existing fixture', () => {
    const normalized = normalizeArticle({
      ...base,
      content: 'A'.repeat(500)
    });

    expect(normalized.summary).toBe('A'.repeat(200) + '...');
  });

  it('keeps summary output unchanged for short HTML content', () => {
    const normalized = normalizeArticle({
      ...base,
      content: '<p>Hello &amp; welcome</p>'
    });

    expect(normalized.summary).toBe('Hello & welcome');
  });
});

describe('truncateDescription', () => {
  it('returns text unchanged when within the limit', () => {
    expect(truncateDescription('Short text.')).toBe('Short text.');
  });

  it('returns text unchanged at exactly the limit', () => {
    const text = 'a'.repeat(400);
    expect(truncateDescription(text)).toBe(text);
  });

  it('cuts at the last sentence end that fits', () => {
    // Final sentence end sits past the half-length mark (200), so it is eligible.
    const text = 'First sentence. ' + 'word '.repeat(40) + 'Third sentence? ' + 'x'.repeat(400);
    const result = truncateDescription(text);

    expect(result).toBe('First sentence. ' + 'word '.repeat(40) + 'Third sentence?');
    expect(result.length).toBeLessThanOrEqual(400);
  });

  it('does not collapse to an early sentence end before half the limit', () => {
    const result = truncateDescription('Breaking. ' + 'word '.repeat(150));

    expect(result.length).toBeGreaterThan(200);
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(400);
  });

  it('returns a prefix of text when maxLength is smaller than the ellipsis', () => {
    expect(truncateDescription('Hello world', 2)).toBe('He');
    expect(truncateDescription('Hello world', 0)).toBe('');
  });

  it('keeps output within maxLength of 3', () => {
    const result = truncateDescription('Hello world again', 3);

    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('does not leave a lone high surrogate on a hard cut', () => {
    // Emoji (surrogate pair) straddles the cut index; no whitespace available.
    const text = 'a'.repeat(396) + '😀' + 'a'.repeat(100);
    const result = truncateDescription(text);
    const body = result.slice(0, -3);

    expect(result.endsWith('...')).toBe(true);
    const last = body.charCodeAt(body.length - 1);
    expect(last >= 0xd800 && last <= 0xdbff).toBe(false);
    expect(result.length).toBeLessThanOrEqual(400);
  });

  it('ignores sentence-like punctuation not followed by whitespace', () => {
    const text = 'Version 3.14 ' + 'word '.repeat(100);
    const result = truncateDescription(text);

    expect(result).toContain('3.14');
    expect(result.endsWith('...')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(400);
  });

  it('falls back to last whitespace plus ellipsis when no sentence end fits', () => {
    const text = 'word '.repeat(200).trim();
    const result = truncateDescription(text);

    expect(result.endsWith('word...')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(400);
  });

  it('hard cuts with ellipsis when there is no whitespace at all', () => {
    const text = 'a'.repeat(1000);
    const result = truncateDescription(text);

    expect(result).toBe('a'.repeat(397) + '...');
    expect(result.length).toBe(400);
  });

  it('respects a custom max length', () => {
    const result = truncateDescription('One two three four five six seven', 15);

    expect(result.length).toBeLessThanOrEqual(15);
    expect(result).toBe('One two...');
  });
});
