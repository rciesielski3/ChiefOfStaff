import { isReleaseSource } from '../../src/config/rss-sources.config';
import {
  primaryQANewsCategory,
  qaNewsTags,
  withQANewsDisplayFields,
} from '../../src/business-logic/categorize-article';
import { articleToQANews } from '../../src/business-logic/export-qa-news';
import { Article, normalizeArticle } from '../../src/business-logic/normalize-article';

/**
 * Tool releases (GitHub releases.atom feeds) are kept apart from articles by
 * data only: they carry the `release` tag and the `tooling` category. No other
 * article carries the `release` tag, so the QA-News tag filter shows releases only.
 */

const article = (overrides: Partial<Article>): Article => ({
  id: 'a-1',
  title: 'Some title',
  summary: 'Some summary',
  url: 'https://example.org/a',
  source: 'InfoQ',
  category: 'news',
  publishedAt: '2026-11-15T00:00:00.000Z',
  tags: [],
  ...overrides,
});

describe('isReleaseSource', () => {
  it.each(['Playwright', 'Vitest Releases', 'Grafana k6 Releases', 'Storybook Releases'])(
    'is true for the releases.atom feed %s',
    (name) => expect(isReleaseSource(name)).toBe(true),
  );

  it.each(['InfoQ', 'Ministry of Testing', 'Cypress', 'Unknown Feed'])('is false for %s', (name) =>
    expect(isReleaseSource(name)).toBe(false),
  );
});

describe('qaNewsTags', () => {
  it('adds the release tag to a release-feed item', () => {
    expect(qaNewsTags(article({ source: 'Selenium Releases', tags: ['github'] }))).toEqual([
      'github',
      'release',
    ]);
  });

  it('does not duplicate an existing release tag', () => {
    expect(qaNewsTags(article({ source: 'Playwright', tags: ['release', 'playwright'] }))).toEqual([
      'playwright',
      'release',
    ]);
  });

  it('removes the release tag from articles that are not from a release feed', () => {
    expect(qaNewsTags(article({ source: 'InfoQ', tags: ['ai', 'release', 'testing'] }))).toEqual([
      'ai',
      'testing',
    ]);
  });

  it('copes with missing tags', () => {
    expect(qaNewsTags(article({ source: 'Jest Releases', tags: undefined as any }))).toEqual([
      'release',
    ]);
  });
});

describe('primaryQANewsCategory for releases', () => {
  it('puts release-feed items in tooling even when keywords point elsewhere', () => {
    const item = article({
      source: 'Vitest Releases',
      title: 'v4.0.0: test automation, flaky test retries and LLM agents',
      summary: 'Unit test runner release',
    });
    expect(primaryQANewsCategory(item)).toBe('tooling');
  });

  it('leaves other articles to the keyword rules', () => {
    const item = article({
      title: 'Flaky test automation in CI',
      summary: 'Playwright end-to-end tests',
    });
    expect(primaryQANewsCategory(item)).not.toBe('tooling');
  });
});

describe('withQANewsDisplayFields', () => {
  it('sets the display category and tags, keeping the other fields', () => {
    const item = article({ source: 'Storybook Releases', tags: ['react'], category: 'release' });
    expect(withQANewsDisplayFields(item)).toEqual({
      ...item,
      category: 'tooling',
      tags: ['react', 'release'],
    });
  });
});

describe('articleToQANews', () => {
  it('exports release tag and tooling category for release-feed items', () => {
    const result = articleToQANews(article({ source: 'WebdriverIO Releases', tags: [] }));
    expect(result.category).toBe('tooling');
    expect(result.tags).toEqual(['release']);
  });
});

describe('normalizeArticle release tag', () => {
  const raw = {
    link: 'https://github.com/vitest-dev/vitest/releases/tag/v4.0.0',
    title: 'v4.0.0',
    pubDate: 'Sun, 15 Nov 2026 10:00:00 GMT',
    content: 'Bug fixes',
    source: 'Vitest Releases',
  };

  it('tags items from a release feed', () => {
    expect(normalizeArticle(raw).tags).toContain('release');
  });

  it('does not tag an article that only mentions a release', () => {
    const tags = normalizeArticle({
      ...raw,
      source: 'InfoQ',
      link: 'https://www.infoq.com/news/x',
      title: 'Team released a new testing guide',
    }).tags;
    expect(tags).not.toContain('release');
  });
});
