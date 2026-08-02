import { fetchAllAPIs } from '../../src/business-logic/api-fetch';
import { SourceConfig } from '../../src/sources/sources';
import * as HNMapper from '../../src/business-logic/hacker-news-mapper';
import * as GHTrendingMapper from '../../src/business-logic/github-trending-mapper';
import * as DevToMapper from '../../src/business-logic/devto-mapper';
import * as GHAIMapper from '../../src/business-logic/github-ai-mapper';

jest.mock('../../src/business-logic/hacker-news-mapper');
jest.mock('../../src/business-logic/github-trending-mapper');
jest.mock('../../src/business-logic/devto-mapper');
jest.mock('../../src/business-logic/github-ai-mapper');

describe('API Fetch Orchestrator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchAllAPIs', () => {
    it('should fetch from all enabled API sources', async () => {
      const configs: SourceConfig[] = [
        { id: 'hn', name: 'Hacker News', type: 'rest', enabled: true, timeout: 30000, maxRetries: 3, mapper: 'hacker-news' },
        { id: 'gh-trending', name: 'GitHub Trending', type: 'rest', enabled: true, timeout: 30000, maxRetries: 3, mapper: 'github-trending' },
        { id: 'devto', name: 'Dev.to', type: 'rest', enabled: true, timeout: 30000, maxRetries: 3, mapper: 'devto' },
        { id: 'gh-ai', name: 'GitHub AI Projects', type: 'rest', enabled: true, timeout: 30000, maxRetries: 3, mapper: 'github-ai' }
      ];

      jest.spyOn(HNMapper, 'mapHackerNewsArticles').mockResolvedValueOnce([
        { link: 'https://hn.com/1', title: 'HN Article', pubDate: '2024-01-01T00:00:00Z', content: '', source: 'Hacker News' }
      ]);
      jest.spyOn(GHTrendingMapper, 'mapGitHubTrendingArticles').mockResolvedValueOnce([
        { link: 'https://gh.com/1', title: 'GitHub Trending Repo', pubDate: '2024-01-01T00:00:00Z', content: '', source: 'GitHub Trending' }
      ]);
      jest.spyOn(DevToMapper, 'mapDevToArticles').mockResolvedValueOnce([
        { link: 'https://dev.to/1', title: 'DevTo Article', pubDate: '2024-01-01T00:00:00Z', content: '', source: 'Dev.to' }
      ]);
      jest.spyOn(GHAIMapper, 'mapGitHubAIArticles').mockResolvedValueOnce([
        { link: 'https://gh.com/ai/1', title: 'GitHub AI Repo', pubDate: '2024-01-01T00:00:00Z', content: '', source: 'GitHub AI Projects' }
      ]);

      const result = await fetchAllAPIs(configs);

      expect(result.articles).toHaveLength(4);
      expect(result.successCount).toBe(4);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(4);
      expect(result.results.every(r => r.success)).toBe(true);
    });

    it('should skip disabled API sources', async () => {
      const configs: SourceConfig[] = [
        { id: 'hn', name: 'Hacker News', type: 'rest', enabled: true, timeout: 30000, maxRetries: 3, mapper: 'hacker-news' },
        { id: 'gh-trending', name: 'GitHub Trending', type: 'rest', enabled: false, timeout: 30000, maxRetries: 3, mapper: 'github-trending' }
      ];

      jest.spyOn(HNMapper, 'mapHackerNewsArticles').mockResolvedValueOnce([
        { link: 'https://hn.com/1', title: 'HN Article', pubDate: '2024-01-01T00:00:00Z', content: '', source: 'Hacker News' }
      ]);

      const result = await fetchAllAPIs(configs);

      expect(result.articles).toHaveLength(1);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(0);
      expect(result.results).toHaveLength(1);
    });

    it('should handle API failures gracefully', async () => {
      const configs: SourceConfig[] = [
        { id: 'hn', name: 'Hacker News', type: 'rest', enabled: true, timeout: 30000, maxRetries: 3, mapper: 'hacker-news' },
        { id: 'gh-trending', name: 'GitHub Trending', type: 'rest', enabled: true, timeout: 30000, maxRetries: 3, mapper: 'github-trending' }
      ];

      jest.spyOn(HNMapper, 'mapHackerNewsArticles').mockResolvedValueOnce([
        { link: 'https://hn.com/1', title: 'HN Article', pubDate: '2024-01-01T00:00:00Z', content: '', source: 'Hacker News' }
      ]);
      jest.spyOn(GHTrendingMapper, 'mapGitHubTrendingArticles').mockRejectedValueOnce(new Error('GitHub API error'));

      const result = await fetchAllAPIs(configs);

      expect(result.articles).toHaveLength(1);
      expect(result.successCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.results).toHaveLength(2);

      const failureResult = result.results.find(r => !r.success);
      expect(failureResult).toBeDefined();
      expect(failureResult?.error).toBe('GitHub API error');
    });

    it('should combine articles from multiple sources', async () => {
      const configs: SourceConfig[] = [
        { id: 'hn', name: 'Hacker News', type: 'rest', enabled: true, timeout: 30000, maxRetries: 3, mapper: 'hacker-news' },
        { id: 'devto', name: 'Dev.to', type: 'rest', enabled: true, timeout: 30000, maxRetries: 3, mapper: 'devto' }
      ];

      jest.spyOn(HNMapper, 'mapHackerNewsArticles').mockResolvedValueOnce([
        { link: 'https://hn.com/1', title: 'HN Article 1', pubDate: '2024-01-01T00:00:00Z', content: '', source: 'Hacker News' },
        { link: 'https://hn.com/2', title: 'HN Article 2', pubDate: '2024-01-02T00:00:00Z', content: '', source: 'Hacker News' }
      ]);
      jest.spyOn(DevToMapper, 'mapDevToArticles').mockResolvedValueOnce([
        { link: 'https://dev.to/1', title: 'DevTo Article 1', pubDate: '2024-01-01T00:00:00Z', content: '', source: 'Dev.to' },
        { link: 'https://dev.to/2', title: 'DevTo Article 2', pubDate: '2024-01-02T00:00:00Z', content: '', source: 'Dev.to' }
      ]);

      const result = await fetchAllAPIs(configs);

      expect(result.articles).toHaveLength(4);
      expect(result.articles.map(a => a.source)).toEqual(['Hacker News', 'Hacker News', 'Dev.to', 'Dev.to']);
    });

    it('should track per-source success/failure', async () => {
      const configs: SourceConfig[] = [
        { id: 'hn', name: 'Hacker News', type: 'rest', enabled: true, timeout: 30000, maxRetries: 3, mapper: 'hacker-news' },
        { id: 'gh-trending', name: 'GitHub Trending', type: 'rest', enabled: true, timeout: 30000, maxRetries: 3, mapper: 'github-trending' },
        { id: 'devto', name: 'Dev.to', type: 'rest', enabled: true, timeout: 30000, maxRetries: 3, mapper: 'devto' }
      ];

      jest.spyOn(HNMapper, 'mapHackerNewsArticles').mockResolvedValueOnce([]);
      jest.spyOn(GHTrendingMapper, 'mapGitHubTrendingArticles').mockRejectedValueOnce(new Error('Network timeout'));
      jest.spyOn(DevToMapper, 'mapDevToArticles').mockResolvedValueOnce([
        { link: 'https://dev.to/1', title: 'DevTo Article', pubDate: '2024-01-01T00:00:00Z', content: '', source: 'Dev.to' }
      ]);

      const result = await fetchAllAPIs(configs);

      expect(result.results).toHaveLength(3);
      expect(result.results[0]).toMatchObject({ source: 'Hacker News', success: true, count: 0 });
      expect(result.results[1]).toMatchObject({ source: 'GitHub Trending', success: false, error: 'Network timeout' });
      expect(result.results[2]).toMatchObject({ source: 'Dev.to', success: true, count: 1 });
    });

    it('should return empty arrays when all sources are disabled', async () => {
      const configs: SourceConfig[] = [
        { id: 'hn', name: 'Hacker News', type: 'rest', enabled: false, timeout: 30000, maxRetries: 3, mapper: 'hacker-news' }
      ];

      const result = await fetchAllAPIs(configs);

      expect(result.articles).toHaveLength(0);
      expect(result.results).toHaveLength(0);
      expect(result.successCount).toBe(0);
      expect(result.failureCount).toBe(0);
    });

    it('should handle unknown API types gracefully', async () => {
      const configs: any[] = [
        { name: 'Unknown API', type: 'unknown-type', enabled: true, timeout: 30000, maxRetries: 3 }
      ];

      const result = await fetchAllAPIs(configs);

      expect(result.articles).toHaveLength(0);
      expect(result.failureCount).toBe(1);
      expect(result.results[0].error).toContain('Unknown API source type');
    });
  });
});
