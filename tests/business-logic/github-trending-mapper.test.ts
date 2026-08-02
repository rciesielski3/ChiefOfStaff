import { mapGitHubTrendingArticles } from '../../src/business-logic/github-trending-mapper';
import { APIClient } from '../../src/utils/api-client';

jest.mock('../../src/utils/api-client');

describe('GitHub Trending Mapper', () => {
  let mockClient: jest.Mocked<APIClient>;

  beforeEach(() => {
    mockClient = new APIClient() as jest.Mocked<APIClient>;
    jest.clearAllMocks();
  });

  describe('mapGitHubTrendingArticles', () => {
    it('should fetch and map trending GitHub repositories', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce({
        items: [
          {
            id: 1,
            full_name: 'testing/framework',
            html_url: 'https://github.com/testing/framework',
            description: 'An automated testing framework',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 1000,
            topics: ['testing', 'automation']
          },
          {
            id: 2,
            full_name: 'qa/tools',
            html_url: 'https://github.com/qa/tools',
            description: 'QA testing tools for CI/CD',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 500,
            topics: ['qa', 'ci-cd']
          }
        ],
        total_count: 2
      });

      const articles = await mapGitHubTrendingArticles(mockClient);

      expect(articles).toHaveLength(2);
      expect(articles[0]).toMatchObject({
        source: 'GitHub Trending',
        title: 'testing/framework - An automated testing framework',
        link: 'https://github.com/testing/framework'
      });
      expect(articles[1]).toMatchObject({
        source: 'GitHub Trending',
        title: 'qa/tools - QA testing tools for CI/CD'
      });
    });

    it('should skip repositories without description', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce({
        items: [
          {
            id: 1,
            full_name: 'test/repo',
            html_url: 'https://github.com/test/repo',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 100,
            topics: []
          }
        ],
        total_count: 1
      });

      const articles = await mapGitHubTrendingArticles(mockClient);

      expect(articles).toHaveLength(0);
    });

    it('should skip repositories without relevant keywords', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce({
        items: [
          {
            id: 1,
            full_name: 'example/gardening',
            html_url: 'https://github.com/example/gardening',
            description: 'A repository about gardening tips',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 100,
            topics: ['gardening']
          }
        ],
        total_count: 1
      });

      const articles = await mapGitHubTrendingArticles(mockClient);

      expect(articles).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      mockClient.get = jest
        .fn()
        .mockRejectedValueOnce(new Error('GitHub API error'));

      const articles = await mapGitHubTrendingArticles(mockClient);

      expect(articles).toEqual([]);
    });

    it('should respect the limit parameter', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce({
        items: [
          {
            id: 1,
            full_name: 'test/repo1',
            html_url: 'https://github.com/test/repo1',
            description: 'testing repo 1',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 1000,
            topics: ['testing']
          },
          {
            id: 2,
            full_name: 'test/repo2',
            html_url: 'https://github.com/test/repo2',
            description: 'testing repo 2',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 500,
            topics: ['testing']
          },
          {
            id: 3,
            full_name: 'test/repo3',
            html_url: 'https://github.com/test/repo3',
            description: 'testing repo 3',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 100,
            topics: ['testing']
          }
        ],
        total_count: 3
      });

      const articles = await mapGitHubTrendingArticles(mockClient, 2);

      expect(articles).toHaveLength(2);
    });

    it('should map content from description', async () => {
      const description = 'This is a comprehensive testing framework for CI/CD';
      mockClient.get = jest.fn().mockResolvedValueOnce({
        items: [
          {
            id: 1,
            full_name: 'test/repo',
            html_url: 'https://github.com/test/repo',
            description: description,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 100,
            topics: ['testing']
          }
        ],
        total_count: 1
      });

      const articles = await mapGitHubTrendingArticles(mockClient);

      expect(articles[0].content).toBe(description);
    });
  });
});
