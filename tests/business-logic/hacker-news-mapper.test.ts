import { mapHackerNewsArticles } from '../../src/business-logic/hacker-news-mapper';
import { APIClient } from '../../src/utils/api-client';

jest.mock('../../src/utils/api-client');

describe('Hacker News Mapper', () => {
  let mockClient: jest.Mocked<APIClient>;

  beforeEach(() => {
    mockClient = new APIClient() as jest.Mocked<APIClient>;
    jest.clearAllMocks();
  });

  describe('mapHackerNewsArticles', () => {
    it('should fetch and map top Hacker News stories', async () => {
      const storyIds = [1, 2, 3];
      mockClient.get = jest
        .fn()
        .mockResolvedValueOnce(storyIds) // First call: story IDs
        .mockResolvedValueOnce({
          id: 1,
          title: 'Testing Best Practices',
          url: 'https://example.com/testing',
          text: 'This is about testing automation',
          time: Math.floor(Date.now() / 1000),
          type: 'story'
        }) // Story 1
        .mockResolvedValueOnce({
          id: 2,
          title: 'Photography Tips',
          url: 'https://example.com/photo',
          text: 'Tips for better photography',
          time: Math.floor(Date.now() / 1000),
          type: 'story'
        }) // Story 2 (not relevant)
        .mockResolvedValueOnce({
          id: 3,
          title: 'Python QA Framework',
          url: 'https://example.com/qa',
          text: 'Testing framework for python',
          time: Math.floor(Date.now() / 1000),
          type: 'story'
        }); // Story 3

      const articles = await mapHackerNewsArticles(mockClient, 3);

      expect(articles).toHaveLength(2); // Only stories 1 and 3 are relevant (2 is not)
      expect(articles[0]).toMatchObject({
        source: 'Hacker News',
        title: 'Testing Best Practices',
        link: 'https://example.com/testing',
        content: 'This is about testing automation'
      });
      expect(articles[1]).toMatchObject({
        source: 'Hacker News',
        title: 'Python QA Framework'
      });
    });

    it('should use HN comment link when no URL provided', async () => {
      mockClient.get = jest
        .fn()
        .mockResolvedValueOnce([1])
        .mockResolvedValueOnce({
          id: 1,
          title: 'Testing Article',
          text: 'testing content',
          time: Math.floor(Date.now() / 1000),
          type: 'story'
        });

      const articles = await mapHackerNewsArticles(mockClient, 1);

      expect(articles[0].link).toBe('https://news.ycombinator.com/item?id=1');
    });

    it('should skip non-relevant stories', async () => {
      mockClient.get = jest
        .fn()
        .mockResolvedValueOnce([1, 2])
        .mockResolvedValueOnce({
          id: 1,
          title: 'Random HN Story',
          url: 'https://example.com/random',
          text: 'This is about gardening',
          time: Math.floor(Date.now() / 1000),
          type: 'story'
        })
        .mockResolvedValueOnce({
          id: 2,
          title: 'Another Random Story',
          text: 'More gardening content',
          time: Math.floor(Date.now() / 1000),
          type: 'story'
        });

      const articles = await mapHackerNewsArticles(mockClient, 2);

      expect(articles).toHaveLength(0);
    });

    it('should skip stories without title', async () => {
      mockClient.get = jest
        .fn()
        .mockResolvedValueOnce([1])
        .mockResolvedValueOnce({
          id: 1,
          url: 'https://example.com/test',
          text: 'testing content',
          time: Math.floor(Date.now() / 1000),
          type: 'story'
        });

      const articles = await mapHackerNewsArticles(mockClient, 1);

      expect(articles).toHaveLength(0);
    });

    it('should handle API errors gracefully', async () => {
      mockClient.get = jest
        .fn()
        .mockRejectedValueOnce(new Error('Network error'));

      const articles = await mapHackerNewsArticles(mockClient);

      expect(articles).toEqual([]);
    });

    it('should skip individual story fetch failures', async () => {
      mockClient.get = jest
        .fn()
        .mockResolvedValueOnce([1, 2, 3])
        .mockResolvedValueOnce({
          id: 1,
          title: 'Testing Article',
          text: 'testing content',
          time: Math.floor(Date.now() / 1000),
          type: 'story'
        })
        .mockRejectedValueOnce(new Error('Story 2 fetch failed'))
        .mockResolvedValueOnce({
          id: 3,
          title: 'QA Testing',
          text: 'qa testing automation',
          time: Math.floor(Date.now() / 1000),
          type: 'story'
        });

      const articles = await mapHackerNewsArticles(mockClient, 3);

      expect(articles).toHaveLength(2);
      expect(articles[0].title).toBe('Testing Article');
      expect(articles[1].title).toBe('QA Testing');
    });

    it('should map pubDate as ISO string', async () => {
      const unixTime = Math.floor(Date.now() / 1000);
      mockClient.get = jest
        .fn()
        .mockResolvedValueOnce([1])
        .mockResolvedValueOnce({
          id: 1,
          title: 'Testing Article',
          text: 'testing content',
          time: unixTime,
          type: 'story'
        });

      const articles = await mapHackerNewsArticles(mockClient, 1);

      expect(articles[0].pubDate).toBe(new Date(unixTime * 1000).toISOString());
    });
  });
});
