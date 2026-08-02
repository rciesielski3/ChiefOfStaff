import { FetchOrchestrator, RSSFetcher, RESTFetcher, GraphQLFetcher, type FetchResult, type IFetcher } from '../../src/fetch/orchestrator';
import { SourceManager, SourceConfig } from '../../src/sources/sources';
import { RateLimiter } from '../../src/fetch/rate-limiter';
import { SourceCircuitBreaker } from '../../src/fetch/circuit-breaker';
import { RawArticle } from '../../src/business-logic/rss-fetch';

/**
 * Mock fetcher for testing
 */
class MockFetcher implements IFetcher {
  constructor(
    private shouldFail: boolean = false,
    private articlesToReturn: number = 5,
    private delayMs: number = 0
  ) {}

  async fetch(_source: SourceConfig): Promise<RawArticle[]> {
    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs));
    }

    if (this.shouldFail) {
      throw new Error('Mock fetch failed');
    }

    return Array.from({ length: this.articlesToReturn }, (_, i) => ({
      link: `http://example.com/article-${i}`,
      title: `Article ${i}`,
      pubDate: new Date().toISOString(),
      content: `Content ${i}`,
      source: 'mock-source'
    }));
  }
}

/**
 * Mock SourceManager for testing
 */
class MockSourceManager extends SourceManager {
  constructor(private mockSources: SourceConfig[] = []) {
    super(); // Will fail to load config, we override
  }

  override getByType(type: 'rss' | 'rest' | 'graphql'): SourceConfig[] {
    return this.mockSources.filter(s => s.type === type);
  }

  override getEnabled(): SourceConfig[] {
    return this.mockSources.filter(s => s.enabled);
  }

  override getById(id: string): SourceConfig | undefined {
    return this.mockSources.find(s => s.id === id);
  }

  override getAuthHeaders(_sourceId: string): Record<string, string> {
    return {};
  }
}

describe('FetchOrchestrator', () => {
  let orchestrator: FetchOrchestrator;
  let mockSourceManager: MockSourceManager;
  let rateLimiter: RateLimiter;
  let circuitBreaker: SourceCircuitBreaker;
  let mockRssFetcher: MockFetcher;
  let mockRestFetcher: MockFetcher;
  let mockGraphqlFetcher: MockFetcher;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
    circuitBreaker = new SourceCircuitBreaker();
    mockRssFetcher = new MockFetcher(false, 5);
    mockRestFetcher = new MockFetcher(false, 3);
    mockGraphqlFetcher = new MockFetcher(false, 4);
  });

  describe('constructor', () => {
    it('should create default instances when dependencies not provided', () => {
      const orch = new FetchOrchestrator();
      expect(orch).toBeInstanceOf(FetchOrchestrator);
    });

    it('should use injected dependencies', () => {
      mockSourceManager = new MockSourceManager();
      const orch = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        mockRssFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );
      expect(orch).toBeInstanceOf(FetchOrchestrator);
    });
  });

  describe('fetchRSSSources', () => {
    beforeEach(() => {
      const rssSource: SourceConfig = {
        id: 'test-rss-1',
        name: 'Test RSS 1',
        type: 'rss',
        enabled: true,
        url: 'http://example.com/feed',
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss'
      };

      mockSourceManager = new MockSourceManager([rssSource]);
      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        mockRssFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );
    });

    it('should return results for all enabled RSS sources', async () => {
      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('success');
      expect(results[0].articleCount).toBe(5);
      expect(articles).toHaveLength(5);
    });

    it('should return empty array when no RSS sources enabled', async () => {
      mockSourceManager = new MockSourceManager([]);
      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        mockRssFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );

      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results).toHaveLength(0);
      expect(articles).toHaveLength(0);
    });

    it('should skip disabled sources', async () => {
      mockSourceManager = new MockSourceManager([
        {
          id: 'enabled-rss',
          name: 'Enabled RSS',
          type: 'rss',
          enabled: true,
          url: 'http://example.com/feed1',
          timeout: 30000,
          maxRetries: 3,
          mapper: 'rss'
        },
        {
          id: 'disabled-rss',
          name: 'Disabled RSS',
          type: 'rss',
          enabled: false,
          url: 'http://example.com/feed2',
          timeout: 30000,
          maxRetries: 3,
          mapper: 'rss'
        }
      ]);

      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        mockRssFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );

      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results).toHaveLength(1);
      expect(results[0].sourceId).toBe('enabled-rss');
      expect(articles).toHaveLength(5);
    });

    it('should record duration for each fetch', async () => {
      const { results } = await orchestrator.fetchRSSSources();
      expect(results[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(typeof results[0].durationMs).toBe('number');
    });

    it('should handle fetch errors without throwing', async () => {
      const failingFetcher = new MockFetcher(true);
      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        failingFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );

      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('error');
      expect(results[0].error).toBe('Mock fetch failed');
      expect(results[0].articleCount).toBeUndefined();
    });

    it('should record circuit breaker failure on fetch error', async () => {
      const failingFetcher = new MockFetcher(true);
      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        failingFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );

      await orchestrator.fetchRSSSources();
      const failureCount = circuitBreaker.getFailureCount('test-rss-1');
      expect(failureCount).toBe(1);
    });

    it('should record circuit breaker success on fetch success', async () => {
      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results[0].status).toBe('success');

      const failureCount = circuitBreaker.getFailureCount('test-rss-1');
      expect(failureCount).toBe(0);
    });
  });

  describe('fetchAPISources', () => {
    beforeEach(() => {
      mockSourceManager = new MockSourceManager([
        {
          id: 'test-rest-1',
          name: 'Test REST 1',
          type: 'rest',
          enabled: true,
          endpoint: 'http://example.com/api/data',
          timeout: 30000,
          maxRetries: 3,
          mapper: 'rest'
        },
        {
          id: 'test-graphql-1',
          name: 'Test GraphQL 1',
          type: 'graphql',
          enabled: true,
          endpoint: 'http://example.com/graphql',
          timeout: 30000,
          maxRetries: 3,
          mapper: 'graphql'
        }
      ]);

      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        mockRssFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );
    });

    it('should return results for all enabled REST/GraphQL sources', async () => {
      const { results, articles } = await orchestrator.fetchAPISources();
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('success');
      expect(results[1].status).toBe('success');
    });

    it('should use correct fetcher for REST sources', async () => {
      const { results, articles } = await orchestrator.fetchAPISources();
      const restResult = results.find(r => r.sourceId === 'test-rest-1');
      expect(restResult?.status).toBe('success');
      expect(restResult?.articleCount).toBe(3); // MockFetcher for REST returns 3
    });

    it('should use correct fetcher for GraphQL sources', async () => {
      const { results, articles } = await orchestrator.fetchAPISources();
      const graphqlResult = results.find(r => r.sourceId === 'test-graphql-1');
      expect(graphqlResult?.status).toBe('success');
      expect(graphqlResult?.articleCount).toBe(4); // MockFetcher for GraphQL returns 4
    });

    it('should return empty array when no API sources enabled', async () => {
      mockSourceManager = new MockSourceManager([]);
      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        mockRssFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );

      const { results, articles } = await orchestrator.fetchAPISources();
      expect(results).toHaveLength(0);
    });
  });

  describe('fetchAllSources', () => {
    beforeEach(() => {
      mockSourceManager = new MockSourceManager([
        {
          id: 'rss-1',
          name: 'RSS 1',
          type: 'rss',
          enabled: true,
          url: 'http://example.com/feed',
          timeout: 30000,
          maxRetries: 3,
          mapper: 'rss'
        },
        {
          id: 'rest-1',
          name: 'REST 1',
          type: 'rest',
          enabled: true,
          endpoint: 'http://example.com/api',
          timeout: 30000,
          maxRetries: 3,
          mapper: 'rest'
        }
      ]);

      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        mockRssFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );
    });

    it('should combine RSS and API results', async () => {
      const { results, articles } = await orchestrator.fetchAllSources();
      expect(results).toHaveLength(2);
      expect(results.map(r => r.sourceId)).toContain('rss-1');
      expect(results.map(r => r.sourceId)).toContain('rest-1');
    });

    it('should maintain order: RSS first, then API', async () => {
      const { results, articles } = await orchestrator.fetchAllSources();
      expect(results[0].sourceId).toBe('rss-1');
      expect(results[1].sourceId).toBe('rest-1');
    });
  });

  describe('rate limiting integration', () => {
    let rssSource: SourceConfig;

    beforeEach(() => {
      rssSource = {
        id: 'rate-limited-source',
        name: 'Rate Limited Source',
        type: 'rss',
        enabled: true,
        url: 'http://example.com/feed',
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: {
          requestsPerHour: 1
        }
      };

      mockSourceManager = new MockSourceManager([rssSource]);
      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        mockRssFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );
    });

    it('should fetch when rate limit decision is allow', async () => {
      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results[0].status).toBe('success');
    });

    it('should skip when rate limit decision is backoff', async () => {
      // First fetch consumes the token
      await orchestrator.fetchRSSSources();

      // Second fetch should be rate limited
      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results[0].status).toBe('skipped');
      expect(results[0].durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should record skip decision in result without error', async () => {
      // Exhaust rate limit
      await orchestrator.fetchRSSSources();

      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results[0].status).toBe('skipped');
      expect(results[0].error).toBeUndefined();
      expect(results[0].articleCount).toBeUndefined();
    });
  });

  describe('circuit breaker integration', () => {
    let source: SourceConfig;

    beforeEach(() => {
      source = {
        id: 'circuit-breaker-source',
        name: 'Circuit Breaker Source',
        type: 'rss',
        enabled: true,
        url: 'http://example.com/feed',
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss'
      };

      mockSourceManager = new MockSourceManager([source]);
    });

    it('should skip fetching when circuit breaker is open', async () => {
      // Simulate 3 failures to open the circuit
      circuitBreaker.recordFailure('circuit-breaker-source');
      circuitBreaker.recordFailure('circuit-breaker-source');
      circuitBreaker.recordFailure('circuit-breaker-source');

      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        mockRssFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );

      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results[0].status).toBe('skipped');
      expect(results[0].error).toBeUndefined();
    });

    it('should record skip result with durationMs when circuit breaker is open', async () => {
      circuitBreaker.recordFailure('circuit-breaker-source');
      circuitBreaker.recordFailure('circuit-breaker-source');
      circuitBreaker.recordFailure('circuit-breaker-source');

      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        mockRssFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );

      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results[0].durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('partial failure handling', () => {
    it('should fetch remaining sources when one fails', async () => {
      const sources: SourceConfig[] = [
        {
          id: 'failing-source',
          name: 'Failing Source',
          type: 'rss',
          enabled: true,
          url: 'http://example.com/feed1',
          timeout: 30000,
          maxRetries: 3,
          mapper: 'rss'
        },
        {
          id: 'success-source',
          name: 'Success Source',
          type: 'rss',
          enabled: true,
          url: 'http://example.com/feed2',
          timeout: 30000,
          maxRetries: 3,
          mapper: 'rss'
        }
      ];

      mockSourceManager = new MockSourceManager(sources);

      // Use different fetchers for different sources via orchestrator
      // We'll use a mock fetcher that checks sourceId to determine behavior
      class MultiSourceMockFetcher implements IFetcher {
        async fetch(source: SourceConfig): Promise<RawArticle[]> {
          if (source.id === 'failing-source') {
            throw new Error('Source failed');
          }
          return Array.from({ length: 5 }, (_, i) => ({
            link: `http://example.com/article-${i}`,
            title: `Article ${i}`,
            pubDate: new Date().toISOString(),
            content: `Content ${i}`,
            source: 'mock-source'
          }));
        }
      }

      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        new MultiSourceMockFetcher(),
        mockRestFetcher,
        mockGraphqlFetcher
      );

      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('error');
      expect(results[1].status).toBe('success');
    });

    it('should return partial results when some sources fail', async () => {
      const sources: SourceConfig[] = [
        {
          id: 'source1',
          name: 'Source 1',
          type: 'rss',
          enabled: true,
          url: 'http://example.com/feed1',
          timeout: 30000,
          maxRetries: 3,
          mapper: 'rss'
        },
        {
          id: 'source2',
          name: 'Source 2',
          type: 'rss',
          enabled: true,
          url: 'http://example.com/feed2',
          timeout: 30000,
          maxRetries: 3,
          mapper: 'rss'
        }
      ];

      mockSourceManager = new MockSourceManager(sources);

      class PartialFailureFetcher implements IFetcher {
        constructor(private failureCount: number = 1) {}

        private attemptCount = 0;

        async fetch(_source: SourceConfig): Promise<RawArticle[]> {
          this.attemptCount++;
          if (this.attemptCount <= this.failureCount) {
            throw new Error('Temporary failure');
          }
          return Array.from({ length: 3 }, (_, i) => ({
            link: `http://example.com/article-${i}`,
            title: `Article ${i}`,
            pubDate: new Date().toISOString(),
            content: `Content ${i}`,
            source: 'mock-source'
          }));
        }
      }

      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        new PartialFailureFetcher(1),
        mockRestFetcher,
        mockGraphqlFetcher
      );

      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results).toHaveLength(2);
      const successCount = results.filter(r => r.status === 'success').length;
      const errorCount = results.filter(r => r.status === 'error').length;
      expect(successCount + errorCount).toBe(2);
    });
  });

  describe('logging', () => {
    let logSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;

    beforeEach(() => {
      logSpy = jest.spyOn(console, 'log').mockImplementation();
      warnSpy = jest.spyOn(console, 'warn').mockImplementation();

      mockSourceManager = new MockSourceManager([
        {
          id: 'log-test-source',
          name: 'Log Test Source',
          type: 'rss',
          enabled: true,
          url: 'http://example.com/feed',
          timeout: 30000,
          maxRetries: 3,
          mapper: 'rss'
        }
      ]);

      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        mockRssFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );
    });

    afterEach(() => {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    });

    it('should log structured JSON on success', async () => {
      await orchestrator.fetchRSSSources();

      const successLog = logSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"stage":"fetch"')
      );

      expect(successLog).toBeDefined();
      const logData = JSON.parse(successLog![0] as string);
      expect(logData.timestamp).toBeDefined();
      expect(logData.stage).toBe('fetch');
      expect(logData.sourceId).toBe('log-test-source');
      expect(logData.status).toBe('success');
      expect(logData.articleCount).toBe(5);
      expect(logData.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should log structured JSON on error', async () => {
      const failingFetcher = new MockFetcher(true);
      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        failingFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );

      await orchestrator.fetchRSSSources();

      const errorLog = warnSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('"status":"error"')
      );

      expect(errorLog).toBeDefined();
      const logData = JSON.parse(errorLog![0] as string);
      expect(logData.timestamp).toBeDefined();
      expect(logData.stage).toBe('fetch');
      expect(logData.sourceId).toBe('log-test-source');
      expect(logData.status).toBe('error');
      expect(logData.error).toBe('Mock fetch failed');
      expect(logData.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should log skip warning when rate limited', async () => {
      const rateLimitedSource: SourceConfig = {
        id: 'rate-limited',
        name: 'Rate Limited',
        type: 'rss',
        enabled: true,
        url: 'http://example.com/feed',
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: {
          requestsPerHour: 1
        }
      };

      mockSourceManager = new MockSourceManager([rateLimitedSource]);
      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        mockRssFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );

      // First fetch
      await orchestrator.fetchRSSSources();

      // Clear logs from first fetch
      warnSpy.mockClear();

      // Second fetch (rate limited)
      await orchestrator.fetchRSSSources();

      const skipLog = warnSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('Skipped:')
      );

      expect(skipLog).toBeDefined();
      expect(skipLog![0]).toContain('rate-limited');
    });

    it('should log circuit breaker skip warning', async () => {
      const source: SourceConfig = {
        id: 'cb-test',
        name: 'CB Test',
        type: 'rss',
        enabled: true,
        url: 'http://example.com/feed',
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss'
      };

      mockSourceManager = new MockSourceManager([source]);

      // Open the circuit breaker
      circuitBreaker.recordFailure('cb-test');
      circuitBreaker.recordFailure('cb-test');
      circuitBreaker.recordFailure('cb-test');

      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        mockRssFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );

      await orchestrator.fetchRSSSources();

      const cbLog = warnSpy.mock.calls.find(call =>
        typeof call[0] === 'string' && call[0].includes('circuit breaker')
      );

      expect(cbLog).toBeDefined();
    });
  });

  describe('duration tracking', () => {
    it('should record accurate duration for successful fetch', async () => {
      const source: SourceConfig = {
        id: 'duration-test',
        name: 'Duration Test',
        type: 'rss',
        enabled: true,
        url: 'http://example.com/feed',
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss'
      };

      mockSourceManager = new MockSourceManager([source]);
      const delayMs = 50;
      const delayedFetcher = new MockFetcher(false, 5, delayMs);

      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        delayedFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );

      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results[0].durationMs).toBeGreaterThanOrEqual(delayMs);
    });

    it('should record duration even on error', async () => {
      const source: SourceConfig = {
        id: 'error-duration-test',
        name: 'Error Duration Test',
        type: 'rss',
        enabled: true,
        url: 'http://example.com/feed',
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss'
      };

      mockSourceManager = new MockSourceManager([source]);
      const failingFetcher = new MockFetcher(true);

      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        failingFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );

      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(results[0].status).toBe('error');
    });

    it('should record duration even when skipped', async () => {
      const source: SourceConfig = {
        id: 'skip-duration-test',
        name: 'Skip Duration Test',
        type: 'rss',
        enabled: true,
        url: 'http://example.com/feed',
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss',
        rateLimit: {
          requestsPerHour: 1
        }
      };

      mockSourceManager = new MockSourceManager([source]);
      const rateLimiter2 = new RateLimiter();

      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter2,
        circuitBreaker,
        mockRssFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );

      // First fetch
      await orchestrator.fetchRSSSources();

      // Second fetch (rate limited)
      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results[0].durationMs).toBeGreaterThanOrEqual(0);
      expect(results[0].status).toBe('skipped');
    });
  });

  describe('default fetcher implementations', () => {
    it('RSSFetcher should throw when URL is missing', async () => {
      const source: SourceConfig = {
        id: 'no-url-source',
        name: 'No URL Source',
        type: 'rss',
        enabled: true,
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss'
      };

      const fetcher = new RSSFetcher();
      await expect(fetcher.fetch(source)).rejects.toThrow('missing URL');
    });

    it('RESTFetcher should throw not implemented', async () => {
      const source: SourceConfig = {
        id: 'rest-source',
        name: 'REST Source',
        type: 'rest',
        enabled: true,
        endpoint: 'http://example.com/api',
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rest'
      };

      const fetcher = new RESTFetcher();
      await expect(fetcher.fetch(source)).rejects.toThrow('not yet implemented');
    });

    it('GraphQLFetcher should throw not implemented', async () => {
      const source: SourceConfig = {
        id: 'graphql-source',
        name: 'GraphQL Source',
        type: 'graphql',
        enabled: true,
        endpoint: 'http://example.com/graphql',
        timeout: 30000,
        maxRetries: 3,
        mapper: 'graphql'
      };

      const fetcher = new GraphQLFetcher();
      await expect(fetcher.fetch(source)).rejects.toThrow('not yet implemented');
    });
  });

  describe('edge cases', () => {
    it('should handle empty source list', async () => {
      mockSourceManager = new MockSourceManager([]);
      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        mockRssFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );

      const { results, articles } = await orchestrator.fetchAllSources();
      expect(results).toHaveLength(0);
    });

    it('should handle sources with zero articles returned', async () => {
      const source: SourceConfig = {
        id: 'empty-source',
        name: 'Empty Source',
        type: 'rss',
        enabled: true,
        url: 'http://example.com/feed',
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss'
      };

      mockSourceManager = new MockSourceManager([source]);
      const emptyFetcher = new MockFetcher(false, 0);

      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        emptyFetcher,
        mockRestFetcher,
        mockGraphqlFetcher
      );

      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results[0].status).toBe('success');
      expect(results[0].articleCount).toBe(0);
    });

    it('should handle non-array return values from fetcher', async () => {
      const source: SourceConfig = {
        id: 'non-array-source',
        name: 'Non-Array Source',
        type: 'rss',
        enabled: true,
        url: 'http://example.com/feed',
        timeout: 30000,
        maxRetries: 3,
        mapper: 'rss'
      };

      mockSourceManager = new MockSourceManager([source]);

      class NonArrayFetcher implements IFetcher {
        async fetch(_source: SourceConfig): Promise<unknown> {
          return { articles: [] }; // Returns object, not array
        }
      }

      orchestrator = new FetchOrchestrator(
        mockSourceManager,
        rateLimiter,
        circuitBreaker,
        new NonArrayFetcher(),
        mockRestFetcher,
        mockGraphqlFetcher
      );

      const { results, articles } = await orchestrator.fetchRSSSources();
      expect(results[0].status).toBe('success');
      expect(results[0].articleCount).toBe(0); // Non-array counts as 0
    });
  });
});
