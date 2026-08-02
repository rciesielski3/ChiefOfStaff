# API Integration Design Specification

**Version:** 1.0  
**Date:** 2026-08-01  
**Status:** Design Phase  
**Target Milestone:** M3 Enhancement

---

## Executive Summary

This document specifies the architectural design for integrating 4 new REST API sources into the ChiefofStaff daily-brief system. The design maintains **zero breaking changes** to the existing RSS pipeline while enabling parallel fetching of both RSS feeds and API endpoints.

**Key Principles:**
- Seamless coexistence with existing RSS pipeline
- Parallel execution for performance
- Unified error handling and resilience
- Minimal modifications to core orchestration logic
- Full test coverage and dependency injection support

---

## 1. API Orchestration Flow

### 1.1 Daily Brief Execution Model

The modified `daily-brief.ts` will follow this sequence:

```
WORKFLOW START
  ├─ Load configuration (RSS + API sources)
  ├─ [PARALLEL] Fetch RSS & APIs
  │  ├─ fetchAllSources(RSS_SOURCES)     [existing RSS logic]
  │  └─ fetchAllAPIs(API_SOURCES)        [new API logic]
  ├─ [MERGE] Combine results
  │  └─ const allRawArticles = [...rssArticles, ...apiArticles]
  ├─ Normalize articles
  ├─ Score articles
  ├─ Generate brief
  ├─ Persist to canonical store
  └─ WORKFLOW COMPLETE
```

### 1.2 Orchestration Strategy: Parallel Execution

**Decision:** Fetch RSS and APIs in parallel using `Promise.all()` to minimize total wall-clock time.

```typescript
// In daily-brief.ts main()
const [rssResult, apiResult] = await Promise.all([
  fetchAllSources(RSS_SOURCES),      // existing function
  fetchAllAPIs(API_SOURCES)          // new function
]);

const allRawArticles = [
  ...rssResult.articles,
  ...apiResult.articles
];
```

**Rationale:**
- RSS sources typically take 20-30s (sequential per-source fallback retry)
- API sources typically take 10-15s (4 endpoints, ~2-3s each)
- Parallel execution achieves ~30s total vs ~45s sequential
- Timeout: 45s global for `Promise.all()` to allow RSS worst-case

### 1.3 Merge Strategy

Results from both sources merge into a single array with uniform treatment:
- Both RSS and API results produce `RawArticle[]`
- Normalization, scoring, dedup, and persistence treat both identically
- No special handling in downstream stages

### 1.4 Error Handling at Orchestration Level

```typescript
// Orchestration layer error handling pattern
interface FetchResult {
  articles: RawArticle[];
  successCount: number;
  failureCount: number;
  results: SourceFetchResult[];
}

interface SourceFetchResult {
  source: string;
  success: boolean;
  error?: string;
  articleCount?: number;
}
```

**Errors are isolated and non-blocking:**
1. Per-source failures (RSS or API) are caught inside `fetchAllSources()` and `fetchAllAPIs()`
2. Failed sources are logged but don't halt the workflow
3. Partial success is acceptable: `successCount < totalSources` logs warnings but continues
4. Only **total failure** (0 articles from all sources) exits with status 0 (not a fatal error)

---

## 2. Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      DAILY BRIEF WORKFLOW                       │
└─────────────────────────────────────────────────────────────────┘

RSS SOURCES                          API SOURCES
(RSS FEEDS)                          (REST ENDPOINTS)
    │                                    │
    ├─ Ministry of Testing              ├─ API #1
    ├─ Google Testing Blog              ├─ API #2
    ├─ InfoQ                            ├─ API #3
    ├─ Martin Fowler                    └─ API #4
    ├─ Cypress                              │
    ├─ Playwright                          │
    ├─ OpenAI                              │
    └─ Cloudflare                          │
         │                                 │
         └─ fetchAllSources()  fetchAllAPIs()
            (rss-fetch.ts)      (api-fetch.ts)
             │                  │
             └──────┬───────────┘
                    │
                    ▼
         RawArticle[] (merged)
                    │
         ┌──────────┴──────────┐
         │                     │
         ▼                     ▼
    NORMALIZATION         PER-SOURCE
    (normalize-article)   DEDUPLICATION
         │                (article-store)
         ▼                     │
    Article[]                 │
    (standard format)         │
         │                     │
         └──────────┬──────────┘
                    │
                    ▼
         DEDUP & MERGE
         (article-store.dedupAndMerge)
                    │
                    ▼
         Merged Articles
         (30-day window)
                    │
                    ▼
         SCORING & FILTERING
         (score-article)
                    │
                    ▼
         ScoredArticle[]
         (sorted by score)
                    │
                    ▼
         BRIEF GENERATION
         (generate-brief)
                    │
                    ▼
         PERSISTENCE
         (article-store)
                    │
                    ▼
         canonical_articles.ndjson
         (live data source)
```

---

## 3. Interface Contracts

### 3.1 RawArticle (Unified Interface)

```typescript
/**
 * Raw article from ANY source (RSS or API)
 * Produced by both RSS parser and API mappers
 */
export interface RawArticle {
  link: string;              // Canonical URL to article
  title: string;             // Article headline
  pubDate: string;           // ISO 8601 date string
  content: string;           // HTML or plaintext content
  source: string;            // Human-readable source name
}
```

**Constraints:**
- `link` must be absolute URL
- `pubDate` must be parseable as ISO 8601
- `content` should be ≥100 chars for meaningful summary extraction
- `source` must match a configured source name (used for dedup and scoring)

### 3.2 APISourceConfig

```typescript
/**
 * Configuration for a single REST API source
 */
export interface APISourceConfig {
  // Identity
  name: string;                    // Human-readable name (used in logs, scoring)
  enabled?: boolean;               // Default: true
  
  // Request
  endpoint: string;                // Full URL to API endpoint
  method?: 'GET' | 'POST';        // Default: GET
  headers?: Record<string, string>; // Custom headers (e.g., Authorization)
  queryParams?: Record<string, string>; // URL query parameters
  bodyTemplate?: Record<string, any>; // POST body (if method === POST)
  
  // Response mapping
  mapperModule: string;            // Path to mapper: 'api-mappers/hacker-news'
  
  // Rate limiting & timing
  rateLimit?: {
    requestsPerSecond?: number;    // Throttle requests (default: 1)
    maxRetries?: number;            // Default: 3
    retryBackoffMs?: number;        // Default: 100
  };
  
  // Timeout
  timeoutMs?: number;              // Per-request timeout (default: 10000)
  
  // Article extraction
  batchSize?: number;              // How many articles per request (default: 10)
  articleLimit?: number;           // Max articles to extract per source (default: 20)
}
```

**Example Configuration:**

```typescript
const API_SOURCES: APISourceConfig[] = [
  {
    name: 'Hacker News',
    endpoint: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    method: 'GET',
    mapperModule: 'api-mappers/hacker-news',
    timeoutMs: 10000,
    articleLimit: 15,
    rateLimit: { requestsPerSecond: 2, maxRetries: 3 }
  },
  {
    name: 'Dev.to',
    endpoint: 'https://dev.to/api/articles',
    method: 'GET',
    queryParams: { tag: 'testing', per_page: 20 },
    headers: { 'api-key': process.env.DEVTO_API_KEY || '' },
    mapperModule: 'api-mappers/devto',
    articleLimit: 20
  },
  // ... more API sources
];
```

### 3.3 APIFetchResult

```typescript
/**
 * Result of fetching from all API sources (mirrors FetchResult from RSS)
 */
export interface APIFetchResult {
  articles: RawArticle[];           // Unified raw articles
  successCount: number;              // Number of successful sources
  failureCount: number;              // Number of failed sources
  results: SourceFetchResult[];      // Per-source details
  durationMs: number;                // Total fetch time
}

interface SourceFetchResult {
  source: string;                    // Source name
  success: boolean;                  // Success flag
  articleCount?: number;             // Articles retrieved (if successful)
  error?: string;                    // Error message (if failed)
  durationMs?: number;               // Source-specific fetch time
}
```

### 3.4 Response Mapper Contract

Each API source requires a mapper module (e.g., `src/business-logic/api-mappers/hacker-news.ts`):

```typescript
/**
 * Mapper transforms API response to RawArticle[]
 * 
 * Input: Raw API response (any shape)
 * Output: RawArticle[] (standard format)
 */
export interface APIResponseMapper {
  /**
   * Transform API response to standard RawArticle array
   * 
   * @param response - Raw API response (parsed JSON)
   * @param config - Source configuration (for context/source name)
   * @returns Array of RawArticle objects
   * @throws Error if mapping fails (logged, not fatal)
   */
  map(response: any, config: APISourceConfig): RawArticle[];
}
```

**Example Hacker News Mapper:**

```typescript
// src/business-logic/api-mappers/hacker-news.ts
import { RawArticle } from '../rss-fetch';
import { APISourceConfig } from '../api-fetch';

/**
 * Map Hacker News API response (story IDs → full articles)
 */
export class HackerNewsMapper {
  async map(storyIds: number[], config: APISourceConfig): Promise<RawArticle[]> {
    const articles: RawArticle[] = [];
    
    for (const id of storyIds.slice(0, config.articleLimit || 20)) {
      try {
        const url = `https://hacker-news.firebaseio.com/v0/item/${id}.json`;
        const response = await fetch(url);
        const story = await response.json();
        
        if (story.type === 'story' && story.url && story.title) {
          articles.push({
            link: story.url,
            title: story.title,
            pubDate: new Date(story.time * 1000).toISOString(),
            content: story.text || story.title,
            source: config.name
          });
        }
      } catch (error) {
        console.warn(`Failed to fetch HN story ${id}:`, error);
      }
    }
    
    return articles;
  }
}
```

### 3.5 Error Types

```typescript
/**
 * API-specific error classes for structured error handling
 */
export class APIFetchError extends Error {
  constructor(
    public source: string,
    public statusCode?: number,
    public originalError?: Error
  ) {
    super(`API fetch failed for ${source}: ${originalError?.message || 'unknown error'}`);
    this.name = 'APIFetchError';
  }
}

export class APIMapperError extends Error {
  constructor(
    public source: string,
    public originalError?: Error
  ) {
    super(`Mapper failed for ${source}: ${originalError?.message || 'unknown error'}`);
    this.name = 'APIMapperError';
  }
}

export class APITimeoutError extends Error {
  constructor(public source: string, public timeoutMs: number) {
    super(`API request for ${source} timed out after ${timeoutMs}ms`);
    this.name = 'APITimeoutError';
  }
}
```

---

## 4. Concurrency Strategy

### 4.1 Parallel API Execution

**Within `fetchAllAPIs()`**, execute all API sources concurrently:

```typescript
export async function fetchAllAPIs(sources: APISourceConfig[]): Promise<APIFetchResult> {
  const results = await Promise.allSettled(
    sources.map(source => fetchSingleAPI(source))
  );
  
  // Process results: extract articles, aggregate errors
  const articles: RawArticle[] = [];
  const sourceResults: SourceFetchResult[] = [];
  
  for (const result of results) {
    if (result.status === 'fulfilled') {
      articles.push(...result.value.articles);
      sourceResults.push(result.value.result);
    } else {
      sourceResults.push({
        source: '(unknown)',
        success: false,
        error: result.reason?.message || 'unknown error'
      });
    }
  }
  
  return {
    articles,
    successCount: sourceResults.filter(r => r.success).length,
    failureCount: sourceResults.filter(r => !r.success).length,
    results: sourceResults,
    durationMs: Date.now() - startTime
  };
}
```

**Rationale:**
- `Promise.allSettled()` ensures all sources are attempted (no short-circuit on failure)
- Individual source timeouts + retries don't block other sources
- Failed sources emit errors to logs but continue pipeline

### 4.2 Timeout Strategy

**Three-tier timeout design:**

1. **Per-API timeout** (source-level, 10s default):
   - Individual API request fails after 10s
   - Triggers retry logic (up to 3x)
   - Per-source, doesn't block other sources

2. **Per-batch timeout** (set of related requests, 20s default):
   - Some APIs require multiple round-trips (e.g., HN story IDs → story details)
   - Batch completes or fails after 20s total
   - Doesn't block orchestration

3. **Global orchestration timeout** (45s):
   - `Promise.all([fetchAllSources(), fetchAllAPIs()])` has 45s limit
   - Protects against wedged RSS or API fetches
   - Logged as timeout error; workflow proceeds with partial data

**Configuration:**

```typescript
// In api-sources.config.ts
const API_SOURCES: APISourceConfig[] = [
  {
    name: 'Hacker News',
    endpoint: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    timeoutMs: 10000,     // Per-request timeout
    rateLimit: {
      maxRetries: 3,
      retryBackoffMs: 100 // Exponential: 100ms, 200ms, 400ms
    }
  }
];
```

### 4.3 Rate Limiting

**Per-source rate limiting to respect API quotas:**

```typescript
class APIClientRateLimiter {
  private lastRequestTime = 0;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessing = false;
  
  constructor(private requestsPerSecond: number = 1) {}
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    const minIntervalMs = 1000 / this.requestsPerSecond;
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < minIntervalMs) {
      await sleep(minIntervalMs - timeSinceLastRequest);
    }
    
    this.lastRequestTime = Date.now();
    return fn();
  }
}
```

---

## 5. State Management

### 5.1 Caching Strategy

**Decision:** No persistent caching layer; rely on in-memory state within workflow.

**Rationale:**
- Daily brief runs once per day (GitHub Actions schedule)
- RSS/API data is time-sensitive (need fresh results)
- Redis/memcached overhead not justified for daily runs
- File-based caching adds complexity (requires cache invalidation logic)

**In-memory caching (optional):**
```typescript
// Within a single workflow run only
class APIResponseCache {
  private cache = new Map<string, { data: any; expiresAt: number }>();
  
  get(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      return null;
    }
    return entry.data;
  }
  
  set(key: string, data: any, ttlMs: number = 5 * 60 * 1000): void {
    this.cache.set(key, { data, expiresAt: Date.now() + ttlMs });
  }
}
```

### 5.2 Deduplication

**Existing dedup logic in `article-store.ts` handles both RSS and API articles uniformly:**

```typescript
// In NdJsonArticleStore.dedupAndMerge()
generateDedupKey(article: Article): string {
  const titleHash = createHash('sha256')
    .update(article.title)
    .digest('hex')
    .slice(0, 12);
  return `${article.source}::${titleHash}`;
}
```

**API articles benefit from existing dedup:**
- API articles enter pipeline as `RawArticle`, normalized to `Article`
- Dedup key = `source::titleHash` (works for both RSS and API)
- Duplicates across RSS and API sources are correctly identified and merged
- Last 30 days retention applies equally to both

**No modifications required to `article-store.ts`.**

### 5.3 canonical_articles.ndjson Structure

**No modifications to file structure:**

```ndjson
{"id":"ministry-of-testing-abc123","title":"Test Automation...","source":"Ministry of Testing","publishedAt":"2026-08-01T12:00:00.000Z",...}
{"id":"hacker-news-def456","title":"New API Framework...","source":"Hacker News","publishedAt":"2026-08-01T13:00:00.000Z",...}
```

- API articles stored identically to RSS articles
- Source name identifies origin (enables scoring, filtering, analytics)
- ID format unchanged (source + link hash)
- Scoring weights apply uniformly (can be tuned per-source in `score-article.ts`)

---

## 6. Dependency Injection & Configuration

### 6.1 API Client Instantiation

**Single responsibility:** `APIClient` class handles all HTTP communication.

```typescript
// src/business-logic/api-client.ts
export class APIClient {
  private rateLimiter: APIClientRateLimiter;
  private httpClient: typeof fetch; // Testable HTTP interface
  
  constructor(
    private config: APISourceConfig,
    httpClient?: typeof fetch
  ) {
    this.rateLimiter = new APIClientRateLimiter(
      config.rateLimit?.requestsPerSecond || 1
    );
    this.httpClient = httpClient || fetch;
  }
  
  async fetch<T = any>(): Promise<T> {
    return this.rateLimiter.execute(() =>
      this.executeRequest<T>()
    );
  }
  
  private async executeRequest<T = any>(): Promise<T> {
    const url = this.buildURL();
    const options = this.buildRequestOptions();
    
    const response = await withTimeout(
      this.httpClient(url, options),
      this.config.timeoutMs || 10000,
      `Request to ${this.config.name} timed out`
    );
    
    if (!response.ok) {
      throw new APIFetchError(
        this.config.name,
        response.status,
        new Error(`HTTP ${response.status}: ${response.statusText}`)
      );
    }
    
    return response.json() as Promise<T>;
  }
  
  private buildURL(): string {
    const url = new URL(this.config.endpoint);
    if (this.config.queryParams) {
      Object.entries(this.config.queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }
    return url.toString();
  }
  
  private buildRequestOptions(): RequestInit {
    return {
      method: this.config.method || 'GET',
      headers: this.config.headers || {},
      body: this.config.method === 'POST' ? JSON.stringify(this.config.bodyTemplate) : undefined
    };
  }
}
```

### 6.2 Dependency Injection Pattern

**Constructor injection for testability:**

```typescript
// src/business-logic/api-fetch.ts
export async function fetchAllAPIs(
  sources: APISourceConfig[],
  apiClientFactory?: (config: APISourceConfig) => APIClient,
  mapperRegistry?: Map<string, APIResponseMapper>
): Promise<APIFetchResult> {
  // Use injected dependencies or defaults
  const factory = apiClientFactory || ((config) => new APIClient(config));
  const mappers = mapperRegistry || loadDefaultMappers();
  
  // Fetch concurrently with DI instances
  const results = await Promise.allSettled(
    sources.map(source => fetchSingleAPI(source, factory, mappers))
  );
  
  // ... aggregate and return
}
```

**Test usage:**

```typescript
// In tests: inject mocks
const mockApiClient = {
  fetch: async () => ({ /* mock response */ })
};

const mockMappers = new Map([
  ['api-mappers/hacker-news', {
    map: () => [{ /* mock article */ }]
  }]
]);

await fetchAllAPIs(
  API_SOURCES,
  () => mockApiClient,
  mockMappers
);
```

### 6.3 Configuration Loading

**Centralized config in `src/config/api-sources.config.ts`:**

```typescript
import { APISourceConfig } from '../business-logic/api-fetch';

export const API_SOURCES: APISourceConfig[] = [
  {
    name: 'Hacker News',
    enabled: true,
    endpoint: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    mapperModule: 'api-mappers/hacker-news',
    timeoutMs: 10000,
    articleLimit: 15,
    rateLimit: { requestsPerSecond: 2, maxRetries: 3 }
  },
  // ... more sources
];

export function getEnabledAPISources(): APISourceConfig[] {
  return API_SOURCES.filter(source => source.enabled !== false);
}
```

**Loading in daily-brief.ts:**

```typescript
import { getEnabledAPISources } from '../config/api-sources.config';

const API_SOURCES = getEnabledAPISources();
const apiResult = await fetchAllAPIs(API_SOURCES);
```

---

## 7. Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `src/business-logic/api-client.ts` with HTTPClient and rate limiting
- [ ] Create `src/business-logic/api-fetch.ts` with `fetchAllAPIs()` orchestration
- [ ] Create `src/config/api-sources.config.ts` with source definitions
- [ ] Create `src/business-logic/api-mappers/` directory

### Phase 2: API Mappers (one per source)
- [ ] Implement `hacker-news.ts` mapper
- [ ] Implement `devto.ts` mapper
- [ ] Implement `medium.ts` mapper
- [ ] Implement `producthunt.ts` mapper

### Phase 3: Integration
- [ ] Modify `src/cli/daily-brief.ts` to call `fetchAllAPIs()` in parallel
- [ ] Update logging to include API summary (success/failure counts)
- [ ] Verify dedup works across RSS + API articles

### Phase 4: Testing
- [ ] Unit tests for `APIClient` (mocked HTTP)
- [ ] Unit tests for each mapper (fixture-based)
- [ ] Integration tests for `fetchAllAPIs()` (all sources mocked)
- [ ] E2E test: daily-brief.ts with real API endpoints (slow, optional)

### Phase 5: Deployment
- [ ] Add environment variables (API keys, if needed)
- [ ] Enable API sources in `api-sources.config.ts`
- [ ] Monitor first production run; verify logging and article flow
- [ ] Adjust scoring weights if API articles underrepresented

---

## 8. Files to Create/Modify

### New Files
```
src/business-logic/api-client.ts
src/business-logic/api-fetch.ts
src/config/api-sources.config.ts
src/business-logic/api-mappers/hacker-news.ts
src/business-logic/api-mappers/devto.ts
src/business-logic/api-mappers/medium.ts
src/business-logic/api-mappers/producthunt.ts
tests/api-client.test.ts
tests/api-fetch.test.ts
tests/api-mappers/*.test.ts
```

### Modified Files
```
src/cli/daily-brief.ts                    (add fetchAllAPIs() call, merge results)
src/business-logic/rss-fetch.ts           (export RawArticle interface)
```

### No Modifications Needed
```
src/business-logic/article-store.ts       (dedup handles both RSS + API)
src/business-logic/score-article.ts       (weights apply uniformly)
src/business-logic/normalize-article.ts   (processes both uniformly)
```

---

## 9. Success Criteria

1. **Backward compatibility:** All existing RSS tests pass without modification
2. **Parallel execution:** `fetchAllAPIs()` completes in <20s (not sequential)
3. **Error isolation:** A failed API source doesn't block RSS or other APIs
4. **Deduplication:** Cross-source duplicates (RSS + API) are correctly merged
5. **Scoring:** API articles surface in brief if they match priority keywords
6. **Logging:** API summary logged alongside RSS summary with source counts
7. **Test coverage:** ≥90% coverage for new API code; all tests pass
8. **Zero breaking changes:** No changes to Article, RawArticle, or existing interfaces
