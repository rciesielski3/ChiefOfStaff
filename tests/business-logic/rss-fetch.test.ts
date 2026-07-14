import { fetchRSS, fetchWithRetry, RawArticle } from '../../src/business-logic/rss-fetch';
import Parser from 'rss-parser';

// Mock the rss-parser module
jest.mock('rss-parser');

describe('fetchRSS', () => {
  const mockSourceUrl = 'https://example.com/feed.xml';
  const mockSourceName = 'Example Blog';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch and parse RSS feed successfully', async () => {
    const mockFeedItems = [
      {
        link: 'https://example.com/article-1',
        title: 'Article 1',
        pubDate: '2026-07-14T10:00:00Z',
        contentSnippet: 'This is article 1 content',
        description: 'Article 1 description'
      },
      {
        link: 'https://example.com/article-2',
        title: 'Article 2',
        pubDate: '2026-07-13T10:00:00Z',
        contentSnippet: 'This is article 2 content',
        description: 'Article 2 description'
      }
    ];

    const mockParserInstance = {
      parseURL: jest.fn().mockResolvedValue({
        items: mockFeedItems
      })
    };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    const result = await fetchRSS(mockSourceUrl, mockSourceName);

    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Article 1');
    expect(result[0].source).toBe('Example Blog');
    expect(result[1].title).toBe('Article 2');
  });

  it('should extract content from content:encoded field when available', async () => {
    const mockFeedItems = [
      {
        link: 'https://example.com/article-1',
        title: 'Article with encoded content',
        pubDate: '2026-07-14T10:00:00Z',
        content: 'This is encoded content'
      }
    ];

    const mockParserInstance = {
      parseURL: jest.fn().mockResolvedValue({
        items: mockFeedItems
      })
    };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    const result = await fetchRSS(mockSourceUrl, mockSourceName);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('This is encoded content');
  });

  it('should fallback to contentSnippet when content is missing', async () => {
    const mockFeedItems = [
      {
        link: 'https://example.com/article-1',
        title: 'Article with snippet',
        pubDate: '2026-07-14T10:00:00Z',
        contentSnippet: 'This is the snippet'
      }
    ];

    const mockParserInstance = {
      parseURL: jest.fn().mockResolvedValue({
        items: mockFeedItems
      })
    };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    const result = await fetchRSS(mockSourceUrl, mockSourceName);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('This is the snippet');
  });

  it('should fallback to description when content and contentSnippet are missing', async () => {
    const mockFeedItems = [
      {
        link: 'https://example.com/article-1',
        title: 'Article with description',
        pubDate: '2026-07-14T10:00:00Z',
        description: 'This is the description'
      }
    ];

    const mockParserInstance = {
      parseURL: jest.fn().mockResolvedValue({
        items: mockFeedItems
      })
    };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    const result = await fetchRSS(mockSourceUrl, mockSourceName);

    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('This is the description');
  });

  it('should handle missing link field gracefully', async () => {
    const mockFeedItems = [
      {
        title: 'Article without link',
        pubDate: '2026-07-14T10:00:00Z',
        contentSnippet: 'Some content'
      }
    ];

    const mockParserInstance = {
      parseURL: jest.fn().mockResolvedValue({
        items: mockFeedItems
      })
    };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    const result = await fetchRSS(mockSourceUrl, mockSourceName);

    expect(result).toHaveLength(1);
    expect(result[0].link).toBe('');
  });

  it('should handle missing title field gracefully', async () => {
    const mockFeedItems = [
      {
        link: 'https://example.com/article-1',
        pubDate: '2026-07-14T10:00:00Z',
        contentSnippet: 'Some content'
      }
    ];

    const mockParserInstance = {
      parseURL: jest.fn().mockResolvedValue({
        items: mockFeedItems
      })
    };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    const result = await fetchRSS(mockSourceUrl, mockSourceName);

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('');
  });

  it('should use current date when pubDate is missing', async () => {
    const beforeTime = new Date();
    const mockFeedItems = [
      {
        link: 'https://example.com/article-1',
        title: 'Article without pubDate',
        contentSnippet: 'Some content'
      }
    ];

    const mockParserInstance = {
      parseURL: jest.fn().mockResolvedValue({
        items: mockFeedItems
      })
    };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    const result = await fetchRSS(mockSourceUrl, mockSourceName);
    const afterTime = new Date();

    expect(result).toHaveLength(1);
    const parsedDate = new Date(result[0].pubDate);
    expect(parsedDate.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
    expect(parsedDate.getTime()).toBeLessThanOrEqual(afterTime.getTime() + 1000);
  });

  it('should handle feed with no items', async () => {
    const mockParserInstance = {
      parseURL: jest.fn().mockResolvedValue({
        items: []
      })
    };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    const result = await fetchRSS(mockSourceUrl, mockSourceName);

    expect(result).toEqual([]);
  });

  it('should handle feed with null items', async () => {
    const mockParserInstance = {
      parseURL: jest.fn().mockResolvedValue({
        items: null
      })
    };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    const result = await fetchRSS(mockSourceUrl, mockSourceName);

    expect(result).toEqual([]);
  });

  it('should handle feed with undefined items', async () => {
    const mockParserInstance = {
      parseURL: jest.fn().mockResolvedValue({
        items: undefined
      })
    };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    const result = await fetchRSS(mockSourceUrl, mockSourceName);

    expect(result).toEqual([]);
  });

  it('should throw error when parser throws', async () => {
    const mockError = new Error('Failed to parse feed');

    const mockParserInstance = {
      parseURL: jest.fn().mockRejectedValue(mockError)
    };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    await expect(fetchRSS(mockSourceUrl, mockSourceName)).rejects.toThrow(
      'Failed to parse feed'
    );
  });

  it('should throw error on network timeout', async () => {
    const mockError = new Error('Network timeout');

    const mockParserInstance = {
      parseURL: jest.fn().mockRejectedValue(mockError)
    };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    await expect(fetchRSS(mockSourceUrl, mockSourceName)).rejects.toThrow(
      'Network timeout'
    );
  });

  it('should assign source name to all articles', async () => {
    const mockFeedItems = [
      {
        link: 'https://example.com/article-1',
        title: 'Article 1',
        pubDate: '2026-07-14T10:00:00Z',
        contentSnippet: 'Content 1'
      },
      {
        link: 'https://example.com/article-2',
        title: 'Article 2',
        pubDate: '2026-07-13T10:00:00Z',
        contentSnippet: 'Content 2'
      }
    ];

    const mockParserInstance = {
      parseURL: jest.fn().mockResolvedValue({
        items: mockFeedItems
      })
    };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    const result = await fetchRSS(mockSourceUrl, mockSourceName);

    result.forEach(article => {
      expect(article.source).toBe(mockSourceName);
    });
  });

  it('should handle feed items with all fields populated', async () => {
    const mockFeedItems = [
      {
        link: 'https://example.com/full-article',
        title: 'Complete Article',
        pubDate: '2026-07-14T10:00:00Z',
        description: 'Description text',
        contentSnippet: 'Snippet text',
        content: 'Full encoded content'
      }
    ];

    const mockParserInstance = {
      parseURL: jest.fn().mockResolvedValue({
        items: mockFeedItems
      })
    };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    const result = await fetchRSS(mockSourceUrl, mockSourceName);

    const article = result[0];
    expect(article.link).toBe('https://example.com/full-article');
    expect(article.title).toBe('Complete Article');
    expect(article.pubDate).toBe('2026-07-14T10:00:00Z');
    expect(article.content).toBe('Full encoded content');
    expect(article.source).toBe(mockSourceName);
  });

  it('should succeed after transient failures via retry', async () => {
    const mockFeedItems = [
      {
        link: 'https://example.com/article-1',
        title: 'Article 1',
        pubDate: '2026-07-14T10:00:00Z',
        contentSnippet: 'Recovered content'
      }
    ];

    const mockParseURL = jest.fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockResolvedValueOnce({ items: mockFeedItems });

    const mockParserInstance = { parseURL: mockParseURL };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    const result = await fetchRSS(mockSourceUrl, mockSourceName);

    expect(mockParseURL).toHaveBeenCalledTimes(3);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe('Recovered content');
  });

  it('should throw the last error after exhausting all retry attempts', async () => {
    const mockError = new Error('Persistent network failure');
    const mockParseURL = jest.fn().mockRejectedValue(mockError);

    const mockParserInstance = { parseURL: mockParseURL };

    (Parser as jest.MockedClass<typeof Parser>).mockImplementation(
      () => mockParserInstance as any
    );

    await expect(fetchRSS(mockSourceUrl, mockSourceName)).rejects.toThrow(
      'Persistent network failure'
    );
    expect(mockParseURL).toHaveBeenCalledTimes(3);
  });
});

describe('fetchWithRetry', () => {
  it('should return the result immediately on first success without retrying', async () => {
    const fn = jest.fn().mockResolvedValue('success');

    const result = await fetchWithRetry(fn);

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and succeed once the operation recovers', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValueOnce('recovered');

    const result = await fetchWithRetry(fn, { baseDelayMs: 1 });

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should stop after maxAttempts and throw the last error', async () => {
    const error1 = new Error('fail 1');
    const error2 = new Error('fail 2');
    const error3 = new Error('final failure');
    const fn = jest.fn()
      .mockRejectedValueOnce(error1)
      .mockRejectedValueOnce(error2)
      .mockRejectedValueOnce(error3);

    await expect(fetchWithRetry(fn, { baseDelayMs: 1 })).rejects.toThrow('final failure');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should respect a custom maxAttempts value', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));

    await expect(
      fetchWithRetry(fn, { maxAttempts: 5, baseDelayMs: 1 })
    ).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(5);
  });

  it('should default to 3 attempts when no options are provided', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('always fails'));

    await expect(fetchWithRetry(fn)).rejects.toThrow('always fails');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should apply exponential backoff delays between attempts', async () => {
    jest.useFakeTimers();
    try {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('fail 1'))
        .mockRejectedValueOnce(new Error('fail 2'))
        .mockResolvedValueOnce('done');

      const promise = fetchWithRetry(fn, { baseDelayMs: 100 });

      // Let the first attempt run and fail synchronously.
      await Promise.resolve();
      await Promise.resolve();
      expect(fn).toHaveBeenCalledTimes(1);

      // First retry delay: 100ms * 2^0 = 100ms
      await jest.advanceTimersByTimeAsync(100);
      expect(fn).toHaveBeenCalledTimes(2);

      // Second retry delay: 100ms * 2^1 = 200ms
      await jest.advanceTimersByTimeAsync(200);
      expect(fn).toHaveBeenCalledTimes(3);

      const result = await promise;
      expect(result).toBe('done');
    } finally {
      jest.useRealTimers();
    }
  });
});
