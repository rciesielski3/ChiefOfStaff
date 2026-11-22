import { exportLatestNews } from '../../src/business-logic/export-latest-news';
import { exportDailyBrief } from '../../src/business-logic/export-daily-brief';
import { Article, buildLegacyArticleId } from '../../src/business-logic/normalize-article';
import { ArticleStore } from '../../src/business-logic/article-store';

// Legacy rows: same host, IDs built with the old formula, which collides per host.
const now = new Date().toISOString();
const legacyArticle = (title: string, url: string): Article => ({
  id: buildLegacyArticleId('InfoQ', url),
  title,
  summary: 'summary',
  url,
  source: 'InfoQ',
  category: 'news',
  publishedAt: now,
  tags: [],
  score: 50,
});

const legacyRows = [
  legacyArticle('First', 'https://www.infoq.com/news/a/'),
  legacyArticle('Second', 'https://www.infoq.com/news/b/'),
  legacyArticle('Third', 'https://www.infoq.com/news/c/'),
];

const fakeStore = {
  read: async () => legacyRows.map((a) => ({ ...a })),
} as unknown as ArticleStore;

describe('exporters emit distinct IDs for legacy-colliding articles', () => {
  it('exportLatestNews (live latest.json)', async () => {
    const result = await exportLatestNews(fakeStore, 50);
    const ids = result.items.map((a) => a.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('exportDailyBrief (live daily.json)', async () => {
    const result = await exportDailyBrief(fakeStore, 10, 1);
    const ids = result.items.map((a) => a.id);
    expect(new Set(ids).size).toBe(3);
  });

  it('does not mutate the stored articles', async () => {
    await exportLatestNews(fakeStore, 50);
    expect(legacyRows[0].id).toBe(buildLegacyArticleId('InfoQ', legacyRows[0].url));
  });
});

describe('latest and daily exports fail loudly on an ID collision', () => {
  // Non-legacy IDs are kept as stored, so two different URLs sharing one ID must throw.
  const clashing = (url: string): Article => ({
    id: 'infoq-0000000000000000',
    title: url,
    summary: 'summary',
    url,
    source: 'InfoQ',
    category: 'news',
    publishedAt: now,
    tags: [],
    score: 50,
  });
  const clashStore = {
    read: async () => [
      clashing('https://www.infoq.com/news/x/'),
      clashing('https://www.infoq.com/news/y/'),
    ],
  } as unknown as ArticleStore;

  it('exportLatestNews throws', async () => {
    await expect(exportLatestNews(clashStore, 50)).rejects.toThrow(/Article ID collision/);
  });

  it('exportDailyBrief throws', async () => {
    await expect(exportDailyBrief(clashStore, 10, 1)).rejects.toThrow(/Article ID collision/);
  });
});
