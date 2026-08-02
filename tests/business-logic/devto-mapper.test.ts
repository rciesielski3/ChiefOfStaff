import { mapDevToArticles } from '../../src/business-logic/devto-mapper';
import { APIClient } from '../../src/utils/api-client';

jest.mock('../../src/utils/api-client');

describe('Dev.to Mapper', () => {
  let mockClient: jest.Mocked<APIClient>;

  beforeEach(() => {
    mockClient = new APIClient() as jest.Mocked<APIClient>;
    jest.clearAllMocks();
  });

  describe('mapDevToArticles', () => {
    it('should fetch and map Dev.to articles', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce([
        {
          id: 1,
          title: 'Testing Best Practices',
          url: 'https://dev.to/user/testing-best-practices',
          description: 'A guide to testing best practices',
          published_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 2,
          title: 'QA Automation Framework',
          url: 'https://dev.to/user/qa-automation',
          description: 'Building a QA automation framework',
          published_at: '2024-01-02T00:00:00Z'
        }
      ]);

      const articles = await mapDevToArticles(mockClient);

      expect(articles).toHaveLength(2);
      expect(articles[0]).toMatchObject({
        source: 'Dev.to',
        title: 'Testing Best Practices',
        link: 'https://dev.to/user/testing-best-practices',
        content: 'A guide to testing best practices'
      });
      expect(articles[1]).toMatchObject({
        source: 'Dev.to',
        title: 'QA Automation Framework'
      });
    });

    it('should use body_markdown if description not available', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce([
        {
          id: 1,
          title: 'Testing Article',
          url: 'https://dev.to/user/testing',
          body_markdown: 'This is a very long article that should be truncated...',
          published_at: '2024-01-01T00:00:00Z'
        }
      ]);

      const articles = await mapDevToArticles(mockClient);

      expect(articles[0].content.length).toBeLessThanOrEqual(200);
      expect(articles[0].content).toBe('This is a very long article that should be truncated...');
    });

    it('should skip articles without title', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce([
        {
          id: 1,
          url: 'https://dev.to/user/article',
          description: 'An article without a title',
          published_at: '2024-01-01T00:00:00Z'
        }
      ]);

      const articles = await mapDevToArticles(mockClient);

      expect(articles).toHaveLength(0);
    });

    it('should skip articles without URL', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce([
        {
          id: 1,
          title: 'Article without URL',
          description: 'An article without a URL',
          published_at: '2024-01-01T00:00:00Z'
        }
      ]);

      const articles = await mapDevToArticles(mockClient);

      expect(articles).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      mockClient.get = jest
        .fn()
        .mockRejectedValueOnce(new Error('Dev.to API error'));

      const articles = await mapDevToArticles(mockClient);

      expect(articles).toEqual([]);
    });

    it('should respect the limit parameter', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce([
        {
          id: 1,
          title: 'Article 1',
          url: 'https://dev.to/article1',
          description: 'First article',
          published_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 2,
          title: 'Article 2',
          url: 'https://dev.to/article2',
          description: 'Second article',
          published_at: '2024-01-02T00:00:00Z'
        },
        {
          id: 3,
          title: 'Article 3',
          url: 'https://dev.to/article3',
          description: 'Third article',
          published_at: '2024-01-03T00:00:00Z'
        }
      ]);

      const articles = await mapDevToArticles(mockClient, 2);

      expect(articles).toHaveLength(2);
    });

    it('should map pubDate as published_at', async () => {
      const publishedAt = '2024-01-01T12:30:45Z';
      mockClient.get = jest.fn().mockResolvedValueOnce([
        {
          id: 1,
          title: 'Testing Article',
          url: 'https://dev.to/article',
          description: 'A testing article',
          published_at: publishedAt
        }
      ]);

      const articles = await mapDevToArticles(mockClient);

      expect(articles[0].pubDate).toBe(publishedAt);
    });

    it('should handle articles with no description or body_markdown', async () => {
      mockClient.get = jest.fn().mockResolvedValueOnce([
        {
          id: 1,
          title: 'Minimal Article',
          url: 'https://dev.to/minimal',
          published_at: '2024-01-01T00:00:00Z'
        }
      ]);

      const articles = await mapDevToArticles(mockClient);

      expect(articles).toHaveLength(1);
      expect(articles[0].content).toBe('');
    });
  });
});
