import { mapGitHubAIArticles } from '../../src/business-logic/github-ai-mapper';
import { APIClient } from '../../src/utils/api-client';

jest.mock('../../src/utils/api-client');

describe('GitHub AI Mapper', () => {
  let mockClient: jest.Mocked<APIClient>;

  beforeEach(() => {
    mockClient = new APIClient() as jest.Mocked<APIClient>;
    jest.clearAllMocks();
  });

  describe('mapGitHubAIArticles', () => {
    it('should fetch and map AI-related GitHub repositories', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce({
        items: [
          {
            id: 1,
            full_name: 'org/ai-testing-framework',
            html_url: 'https://github.com/org/ai-testing-framework',
            description: 'Testing and evaluation framework for AI models',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 5000,
            topics: ['ai', 'testing', 'evaluation']
          },
          {
            id: 2,
            full_name: 'org/llm-validator',
            html_url: 'https://github.com/org/llm-validator',
            description: 'Quality validation tools for LLM outputs',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 3000,
            topics: ['llm', 'quality', 'validation']
          }
        ],
        total_count: 2
      });

      const articles = await mapGitHubAIArticles(mockClient);

      expect(articles).toHaveLength(2);
      expect(articles[0]).toMatchObject({
        source: 'GitHub AI Projects',
        title: 'org/ai-testing-framework - AI Project',
        link: 'https://github.com/org/ai-testing-framework'
      });
      expect(articles[1]).toMatchObject({
        source: 'GitHub AI Projects',
        title: 'org/llm-validator - AI Project'
      });
    });

    it('should skip AI repositories without description', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce({
        items: [
          {
            id: 1,
            full_name: 'org/ai-repo',
            html_url: 'https://github.com/org/ai-repo',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 100,
            topics: ['ai']
          }
        ],
        total_count: 1
      });

      const articles = await mapGitHubAIArticles(mockClient);

      expect(articles).toHaveLength(0);
    });

    it('should skip repositories without relevant keywords', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce({
        items: [
          {
            id: 1,
            full_name: 'org/ai-education',
            html_url: 'https://github.com/org/ai-education',
            description: 'Educational resources for machine learning',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 100,
            topics: ['ai', 'machine-learning']
          }
        ],
        total_count: 1
      });

      const articles = await mapGitHubAIArticles(mockClient);

      expect(articles).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      mockClient.get = jest
        .fn()
        .mockRejectedValueOnce(new Error('GitHub API error'));

      const articles = await mapGitHubAIArticles(mockClient);

      expect(articles).toEqual([]);
    });

    it('should respect the limit parameter', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce({
        items: [
          {
            id: 1,
            full_name: 'org/ai-test-1',
            html_url: 'https://github.com/org/ai-test-1',
            description: 'AI testing tool 1',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 1000,
            topics: ['ai', 'testing']
          },
          {
            id: 2,
            full_name: 'org/ai-test-2',
            html_url: 'https://github.com/org/ai-test-2',
            description: 'AI testing tool 2',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 500,
            topics: ['ai', 'testing']
          },
          {
            id: 3,
            full_name: 'org/ai-test-3',
            html_url: 'https://github.com/org/ai-test-3',
            description: 'AI testing tool 3',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 100,
            topics: ['ai', 'testing']
          }
        ],
        total_count: 3
      });

      const articles = await mapGitHubAIArticles(mockClient, 2);

      expect(articles).toHaveLength(2);
    });

    it('should map content from description', async () => {
      const description = 'A comprehensive testing and validation framework for AI models';
      mockClient.get = jest.fn().mockResolvedValueOnce({
        items: [
          {
            id: 1,
            full_name: 'org/ai-framework',
            html_url: 'https://github.com/org/ai-framework',
            description: description,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 1000,
            topics: ['ai', 'testing']
          }
        ],
        total_count: 1
      });

      const articles = await mapGitHubAIArticles(mockClient);

      expect(articles[0].content).toBe(description);
    });

    it('should filter by multiple relevant keywords', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce({
        items: [
          {
            id: 1,
            full_name: 'org/ai-eval',
            html_url: 'https://github.com/org/ai-eval',
            description: 'Evaluation framework for AI and ML models with quality assessment',
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-02T00:00:00Z',
            stargazers_count: 1000,
            topics: ['ai', 'evaluation']
          }
        ],
        total_count: 1
      });

      const articles = await mapGitHubAIArticles(mockClient);

      expect(articles).toHaveLength(1);
      expect(articles[0].title).toContain('AI Project');
    });
  });
});
