import { SourceManager, SourceConfig } from '../sources/sources';
import { RateLimiter } from './rate-limiter';
import { SourceCircuitBreaker } from './circuit-breaker';
import { fetchRSS, RawArticle } from '../business-logic/rss-fetch';

/**
 * Result of fetching from a single source
 */
export interface FetchResult {
  sourceId: string;
  status: 'success' | 'error' | 'skipped';
  articleCount?: number;
  error?: string;
  durationMs: number;
  articles?: RawArticle[]; // Actual articles from successful fetch
}

/**
 * Combined result from fetching all sources (metrics + articles)
 */
export interface FetchOrchestrationResult {
  results: FetchResult[];
  articles: RawArticle[];
}

/**
 * Interface for fetcher implementations
 */
export interface IFetcher {
  fetch(source: SourceConfig): Promise<unknown>;
}

/**
 * Default RSS fetcher implementation
 */
export class RSSFetcher implements IFetcher {
  async fetch(source: SourceConfig): Promise<RawArticle[]> {
    if (!source.url) {
      throw new Error(`RSS source ${source.id} is missing URL`);
    }
    return fetchRSS(source.url, source.name, source.timeout);
  }
}

/**
 * Default REST fetcher implementation (placeholder - to be implemented)
 */
export class RESTFetcher implements IFetcher {
  async fetch(_source: SourceConfig): Promise<unknown> {
    throw new Error('REST fetcher not yet implemented');
  }
}

/**
 * Default GraphQL fetcher implementation (placeholder - to be implemented)
 */
export class GraphQLFetcher implements IFetcher {
  async fetch(_source: SourceConfig): Promise<unknown> {
    throw new Error('GraphQL fetcher not yet implemented');
  }
}

/**
 * FetchOrchestrator coordinates fetching from all sources (RSS + REST + GraphQL)
 * with rate limiting and circuit breaking integration.
 *
 * Features:
 * - Per-source isolation: one source failure doesn't abort others
 * - Rate limit integration: respects allow/backoff/skip decisions
 * - Circuit breaker integration: skips sources when circuit is open
 * - Structured logging: JSON logs for all fetch outcomes
 * - Duration tracking: measures time for each fetch
 * - Dependency injection: can inject mocks for testing
 */
export class FetchOrchestrator {
  private sourceManager: SourceManager;
  private rateLimiter: RateLimiter;
  private circuitBreaker: SourceCircuitBreaker;
  private rssFetcher: IFetcher;
  private restFetcher: IFetcher;
  private graphqlFetcher: IFetcher;

  constructor(
    sourceManager?: SourceManager,
    rateLimiter?: RateLimiter,
    circuitBreaker?: SourceCircuitBreaker,
    rssFetcher?: IFetcher,
    restFetcher?: IFetcher,
    graphqlFetcher?: IFetcher
  ) {
    this.sourceManager = sourceManager || new SourceManager();
    this.rateLimiter = rateLimiter || new RateLimiter();
    this.circuitBreaker = circuitBreaker || new SourceCircuitBreaker();
    this.rssFetcher = rssFetcher || new RSSFetcher();
    this.restFetcher = restFetcher || new RESTFetcher();
    this.graphqlFetcher = graphqlFetcher || new GraphQLFetcher();
  }

  /**
   * Fetch from all enabled RSS sources
   * Returns: FetchOrchestrationResult with metrics and articles
   */
  async fetchRSSSources(): Promise<FetchOrchestrationResult> {
    const sources = this.sourceManager.getByType('rss').filter(s => s.enabled);
    const results: FetchResult[] = [];
    const articles: RawArticle[] = [];

    for (const source of sources) {
      const result = await this.fetchSource(source, this.rssFetcher);
      results.push(result);
      if (result.articles) {
        articles.push(...result.articles);
      }
    }

    return { results, articles };
  }

  /**
   * Fetch from all enabled REST/GraphQL sources
   * Returns: FetchOrchestrationResult with metrics and articles
   */
  async fetchAPISources(): Promise<FetchOrchestrationResult> {
    const restSources = this.sourceManager.getByType('rest').filter(s => s.enabled);
    const graphqlSources = this.sourceManager.getByType('graphql').filter(s => s.enabled);
    const allSources = [...restSources, ...graphqlSources];
    const results: FetchResult[] = [];
    const articles: RawArticle[] = [];

    for (const source of allSources) {
      const fetcher = source.type === 'rest' ? this.restFetcher : this.graphqlFetcher;
      const result = await this.fetchSource(source, fetcher);
      results.push(result);
      if (result.articles) {
        articles.push(...result.articles);
      }
    }

    return { results, articles };
  }

  /**
   * Fetch from all enabled sources (RSS + REST + GraphQL)
   * Returns: FetchOrchestrationResult with combined metrics and articles
   */
  async fetchAllSources(): Promise<FetchOrchestrationResult> {
    const rssResult = await this.fetchRSSSources();
    const apiResult = await this.fetchAPISources();
    return {
      results: [...rssResult.results, ...apiResult.results],
      articles: [...rssResult.articles, ...apiResult.articles]
    };
  }

  /**
   * Fetch from a single source with rate limiting and circuit breaker integration
   * Per-source isolation: errors don't throw, are captured in result
   */
  private async fetchSource(source: SourceConfig, fetcher: IFetcher): Promise<FetchResult> {
    const startTime = Date.now();
    const sourceId = source.id;

    try {
      // Check rate limit
      const rateLimitDecision = await this.rateLimiter.checkRateLimit(source);
      if (rateLimitDecision !== 'allow') {
        const reason = rateLimitDecision === 'backoff' ? 'rate limit (backoff)' : 'rate limit (skip)';
        console.warn(`[${sourceId}] Skipped: ${reason}`);
        const durationMs = Date.now() - startTime;
        return {
          sourceId,
          status: 'skipped',
          durationMs
        };
      }

      // Check circuit breaker
      if (!this.circuitBreaker.canFetch(sourceId)) {
        console.warn(`[${sourceId}] Skipped: circuit breaker open`);
        const durationMs = Date.now() - startTime;
        return {
          sourceId,
          status: 'skipped',
          durationMs
        };
      }

      // Fetch from source
      try {
        const result = await fetcher.fetch(source);
        this.circuitBreaker.recordSuccess(sourceId);

        // Extract and count articles in result
        let articles: RawArticle[] = [];
        let articleCount = 0;
        if (Array.isArray(result)) {
          articles = result as RawArticle[];
          articleCount = articles.length;
        }

        const durationMs = Date.now() - startTime;

        // Log success
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          stage: 'fetch',
          sourceId,
          status: 'success',
          articleCount,
          durationMs
        }));

        return {
          sourceId,
          status: 'success',
          articleCount,
          durationMs,
          articles
        };
      } catch (fetchError) {
        this.circuitBreaker.recordFailure(sourceId);

        const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
        const durationMs = Date.now() - startTime;

        // Log error
        console.warn(JSON.stringify({
          timestamp: new Date().toISOString(),
          stage: 'fetch',
          sourceId,
          status: 'error',
          error: errorMessage,
          durationMs
        }));

        return {
          sourceId,
          status: 'error',
          error: errorMessage,
          durationMs
        };
      }
    } catch (error) {
      // Fallback for unexpected errors (should not happen with proper error handling above)
      const errorMessage = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startTime;

      console.warn(JSON.stringify({
        timestamp: new Date().toISOString(),
        stage: 'fetch',
        sourceId,
        status: 'error',
        error: errorMessage,
        durationMs
      }));

      return {
        sourceId,
        status: 'error',
        error: errorMessage,
        durationMs
      };
    }
  }
}
