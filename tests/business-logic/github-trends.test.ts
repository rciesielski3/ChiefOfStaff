import {
  buildTrendQuery,
  dedupeByUrl,
  fetchGitHubTrends,
  formatSearchDate,
  GitHubRepo,
  GITHUB_TREND_MIN_STARS,
  GITHUB_TREND_TOPICS,
  hasDescription,
  repoToArticle,
  windowStart,
  FetchLike,
} from '../../src/business-logic/github-trends';
import { buildArticleId } from '../../src/business-logic/normalize-article';

function makeRepo(overrides: Partial<GitHubRepo> = {}): GitHubRepo {
  return {
    name: 'widget',
    html_url: 'https://github.com/acme/widget',
    description: 'A test tool',
    created_at: '2026-11-01T10:00:00Z',
    stargazers_count: 120,
    owner: { login: 'acme' },
    ...overrides,
  };
}

describe('repoToArticle', () => {
  it('maps repository fields to an Article', () => {
    const article = repoToArticle(makeRepo(), 'test-automation');
    expect(article).toEqual({
      id: buildArticleId('GitHub', 'https://github.com/acme/widget'),
      title: 'acme/widget',
      summary: 'A test tool',
      description: 'A test tool',
      url: 'https://github.com/acme/widget',
      source: 'GitHub',
      category: 'test-automation',
      publishedAt: '2026-11-01T10:00:00Z',
      tags: ['test-automation'],
      stars: 120,
    });
  });

  it('uses an empty summary and omits description when the repo has none', () => {
    const article = repoToArticle(makeRepo({ description: null }), 'ai-testing');
    expect(article.summary).toBe('');
    expect(article.description).toBeUndefined();
  });

  it('assigns category ai to the ai-testing topic and exposes stars as a number', () => {
    const article = repoToArticle(makeRepo({ stargazers_count: 948 }), 'ai-testing');
    expect(article.category).toBe('ai');
    expect(article.tags).toEqual(['ai-testing']);
    expect(article.stars).toBe(948);
  });

  it('assigns category test-automation to the e2e-testing topic', () => {
    expect(repoToArticle(makeRepo(), 'e2e-testing').category).toBe('test-automation');
  });
});

describe('hasDescription', () => {
  it('is false for null or whitespace-only descriptions', () => {
    expect(hasDescription(makeRepo({ description: null }))).toBe(false);
    expect(hasDescription(makeRepo({ description: '  ' }))).toBe(false);
    expect(hasDescription(makeRepo())).toBe(true);
  });
});

describe('dedupeByUrl', () => {
  it('keeps the first article per URL across topics', () => {
    const repo = makeRepo();
    const articles = [
      repoToArticle(repo, 'test-automation'),
      repoToArticle(repo, 'ai-testing'),
      repoToArticle(
        makeRepo({ html_url: 'https://github.com/acme/other', name: 'other' }),
        'ai-testing',
      ),
    ];
    const result = dedupeByUrl(articles);
    expect(result.map((a) => a.url)).toEqual([
      'https://github.com/acme/widget',
      'https://github.com/acme/other',
    ]);
    expect(result[0].category).toBe('test-automation');
  });
});

describe('date window and query', () => {
  it('formats dates as YYYY-MM-DD in UTC', () => {
    expect(formatSearchDate(new Date('2026-11-10T23:59:59Z'))).toBe('2026-11-10');
  });

  it('starts the window 60 days before now', () => {
    const now = new Date('2026-11-10T12:00:00Z');
    expect(formatSearchDate(windowStart(now))).toBe('2026-09-11');
  });

  it('builds the topic, date and star threshold query', () => {
    const since = new Date('2026-09-11T00:00:00Z');
    expect(buildTrendQuery('test-automation', since)).toBe(
      'topic:test-automation created:>2026-09-11 stars:>=50 fork:false archived:false',
    );
    expect(GITHUB_TREND_MIN_STARS).toBe(50);
  });
});

describe('fetchGitHubTrends', () => {
  const now = new Date('2026-11-10T12:00:00Z');

  function mockFetch(itemsByTopic: Record<string, GitHubRepo[]>, incompleteTopics: string[] = []) {
    return jest.fn<ReturnType<FetchLike>, Parameters<FetchLike>>(async (url: string) => {
      const topic = new URL(url).searchParams.get('q')!.match(/topic:([\w-]+)/)![1];
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          items: itemsByTopic[topic] ?? [],
          incomplete_results: incompleteTopics.includes(topic),
        }),
      };
    });
  }

  it('queries each topic with the required params and headers, without network access', async () => {
    const fetchImpl = mockFetch({});
    await fetchGitHubTrends({ now, fetchImpl, token: 'secret-token' });

    expect(fetchImpl).toHaveBeenCalledTimes(GITHUB_TREND_TOPICS.length);
    const queries = fetchImpl.mock.calls.map(([u]) => new URL(u).searchParams.get('q'));
    expect(queries).toEqual(
      GITHUB_TREND_TOPICS.map(
        (t) => `topic:${t} created:>2026-09-11 stars:>=50 fork:false archived:false`,
      ),
    );
    const [url, init] = fetchImpl.mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe('https://api.github.com/search/repositories');
    expect(parsed.searchParams.get('sort')).toBe('stars');
    expect(parsed.searchParams.get('per_page')).toBe('20');
    expect(init?.headers?.['User-Agent']).toBe('qa-news-trends/1.0');
    expect(init?.headers?.Authorization).toBe('Bearer secret-token');
  });

  it('omits Authorization when no token is given', async () => {
    const fetchImpl = mockFetch({});
    await fetchGitHubTrends({ now, fetchImpl });
    expect(fetchImpl.mock.calls[0][1]?.headers?.Authorization).toBeUndefined();
  });

  it('drops repositories without a description', async () => {
    const fetchImpl = mockFetch({
      'test-automation': [
        makeRepo({ description: null }),
        makeRepo({ html_url: 'https://github.com/acme/blank', name: 'blank', description: '   ' }),
        makeRepo(),
      ],
    });
    const items = await fetchGitHubTrends({ now, fetchImpl });
    expect(items.map((i) => i.url)).toEqual(['https://github.com/acme/widget']);
  });

  it('combines topics and dedupes repeated URLs', async () => {
    const shared = makeRepo({ html_url: 'https://github.com/acme/shared', name: 'shared' });
    const fetchImpl = mockFetch({
      'test-automation': [makeRepo(), shared],
      'ai-testing': [shared],
    });
    const items = await fetchGitHubTrends({ now, fetchImpl });
    expect(items.map((i) => i.url)).toEqual([
      'https://github.com/acme/widget',
      'https://github.com/acme/shared',
    ]);
  });

  it('keeps the category of the first topic in GITHUB_TREND_TOPICS order for repeated repos', async () => {
    expect(GITHUB_TREND_TOPICS).toEqual(['test-automation', 'e2e-testing', 'ai-testing']);
    const shared = makeRepo({ html_url: 'https://github.com/acme/shared', name: 'shared' });
    const fetchImpl = mockFetch({ 'ai-testing': [shared], 'e2e-testing': [shared] });
    const items = await fetchGitHubTrends({ now, fetchImpl });
    expect(items).toHaveLength(1);
    expect(items[0].category).toBe('test-automation');
    expect(items[0].tags).toEqual(['e2e-testing']);
  });

  it('keeps items and warns when GitHub reports incomplete results', async () => {
    const warn = jest.fn();
    const fetchImpl = mockFetch({ 'e2e-testing': [makeRepo()] }, ['e2e-testing']);
    const items = await fetchGitHubTrends({ now, fetchImpl, warn });
    expect(items.map((i) => i.url)).toEqual(['https://github.com/acme/widget']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      'GitHub search for topic "e2e-testing" returned incomplete results',
    );
  });

  it('does not warn when results are complete', async () => {
    const warn = jest.fn();
    await fetchGitHubTrends({
      now,
      fetchImpl: mockFetch({ 'test-automation': [makeRepo()] }),
      warn,
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('throws with the HTTP status and never the token on failure', async () => {
    const fetchImpl: FetchLike = async () => ({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
      json: async () => ({}),
    });
    const error = await fetchGitHubTrends({ now, fetchImpl, token: 'secret-token' }).then(
      () => new Error('expected rejection'),
      (e: Error) => e,
    );
    expect(error.message).toBe(
      'GitHub search failed for topic "test-automation": HTTP 403 Forbidden',
    );
    expect(error.message).not.toContain('secret-token');
  });
});
