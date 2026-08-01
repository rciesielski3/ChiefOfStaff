# JSON-Driven Pipeline Architecture Design

**Date:** 2026-08-01  
**Status:** ✅ APPROVED FOR IMPLEMENTATION  
**Readiness:** 9/10  
**Next Step:** Implementation Planning

---

## Executive Summary

This design replaces the generic `src/business-logic/` folder with a clear **pipeline architecture** organized by data flow: `sources/` → `fetch/` → `transform/` → `enrich/` → `publish/`.

**Key Innovation:** All data sources (RSS feeds, REST APIs, GraphQL endpoints) are defined in a single **`src/sources/config.json`** file. Adding a new source requires a JSON edit only—no TypeScript code changes.

**Critical Design Decisions:**
1. ✅ Configuration-driven source management (JSON, not code)
2. ✅ Authentication support (Bearer, API Key, Basic auth, OAuth2)
3. ✅ Separated filter semantics (RSS keywords vs API query params)
4. ✅ Strategy pattern for mappers (one per source type)
5. ✅ Graceful error handling (startup fail-hard, fetch partial-success)
6. ✅ Per-source rate limiting (token bucket + circuit breaker)
7. ✅ Testable via dependency injection

---

## 1. Folder Structure & Naming

**Problem:** Current `src/business-logic/` mixes data fetching, transformation, classification, export, and storage—33 files with unclear purpose.

**Solution:** Organize by **pipeline stage**, not by technical layer.

```
src/
├── sources/                  # Source definitions & management
│   ├── config.json           # Master registry (all RSS + APIs)
│   └── sources.ts            # SourceManager (load, validate, enable/disable)
│
├── fetch/                    # Data acquisition layer (I/O boundary)
│   ├── fetchers/
│   │   ├── rss-fetcher.ts    # Generic RSS feed fetcher
│   │   ├── rest-fetcher.ts   # Generic REST API client
│   │   └── graphql-fetcher.ts # Generic GraphQL client
│   ├── rate-limiter.ts       # Token bucket + circuit breaker per-source
│   └── orchestrator.ts       # Coordinate RSS + API fetching, error handling
│
├── transform/               # Data normalization & mapping (I/O → Business Logic)
│   ├── mappers/
│   │   ├── rss-mapper.ts           # RSS feed → RawArticle (generic)
│   │   ├── papers-with-code.ts     # Papers API → RawArticle (specific)
│   │   ├── github-trending.ts      # GitHub REST → RawArticle (specific)
│   │   ├── product-hunt.ts         # Product Hunt GraphQL → RawArticle (specific)
│   │   └── ... (one per source)
│   ├── normalizer.ts        # Unified Article interface
│   └── deduplicator.ts      # Remove duplicates across sources
│
├── enrich/                  # Knowledge layer (existing M6 features)
│   ├── classifier.ts        # Domain classification
│   ├── knowledge-store.ts   # Fact extraction & storage
│   └── insights.ts          # Insight generation
│
├── publish/                 # Export & distribution
│   ├── exporters/
│   │   ├── latest-news.ts
│   │   ├── weekly-highlights.ts
│   │   ├── monthly-recap.ts
│   │   └── qa-news.ts
│   ├── store.ts             # Article storage (NDJSON)
│   └── telegram.ts          # Notification delivery
│
└── cli/
    └── daily-brief.ts       # Orchestrate: fetch → transform → enrich → publish
```

**Benefits:**
- 🎯 **Self-documenting:** Folder name describes purpose
- 🔗 **Pipeline clarity:** Data flows left-to-right
- 🧩 **Easy to extend:** Add new fetcher? Goes in `fetch/`. New mapper? Goes in `transform/`.
- 🧪 **Testable boundaries:** Each stage isolated

---

## 2. JSON Source Configuration Format

**Problem:** Sources defined in TypeScript code (rss-sources.config.ts, api-sources.config.ts) require code changes to add/modify sources.

**Solution:** Single JSON registry with schema supporting all source types.

### Config Location
`src/sources/config.json`

### Schema & Examples

```json
{
  "version": "1.0",
  "sources": [
    {
      "id": "browserstack-blog",
      "name": "BrowserStack Blog",
      "type": "rss",
      "category": "testing",
      "enabled": true,
      "url": "https://www.browserstack.com/blog/feed",
      "auth": null,
      "filters": {
        "includeKeywords": ["test", "automation", "qa"],
        "excludeKeywords": ["sponsorship"],
        "daysBack": 30
      },
      "timeout": 30000,
      "maxRetries": 3,
      "mapper": "rss",
      "metadata": {
        "frequency": "2-3x/week",
        "quality_rating": 5,
        "priority": "HIGH"
      }
    },
    {
      "id": "papers-with-code",
      "name": "Papers with Code",
      "type": "rest",
      "category": "ai",
      "enabled": true,
      "endpoint": "https://paperswithcode.com/api/v1/papers/",
      "method": "GET",
      "auth": {
        "type": "apiKey",
        "headers": {
          "Authorization": "Bearer ${PAPERS_API_KEY}"
        }
      },
      "filters": {
        "queryParams": {
          "ordering": "-published"
        },
        "keywordFilter": ["ai", "testing", "evaluation"],
        "daysBack": 7,
        "limit": 20
      },
      "rateLimit": {
        "requestsPerHour": 100,
        "delayMs": 50
      },
      "timeout": 30000,
      "maxRetries": 3,
      "mapper": "papers-with-code",
      "metadata": {
        "frequency": "daily",
        "quality_rating": 5,
        "priority": "HIGH"
      }
    },
    {
      "id": "github-graphql",
      "name": "GitHub Search (GraphQL)",
      "type": "graphql",
      "category": "tools",
      "enabled": true,
      "endpoint": "https://api.github.com/graphql",
      "auth": {
        "type": "bearer",
        "headers": {
          "Authorization": "Bearer ${GITHUB_TOKEN}"
        }
      },
      "query": "query($first: Int!) { search(query: \"created:>2024-07-25\", type: REPOSITORY, first: $first) { nodes { ... } } }",
      "variables": {
        "first": 20
      },
      "filters": {
        "keywordFilter": ["test", "automation", "qa"],
        "limit": 20
      },
      "rateLimit": {
        "requestsPerHour": 60,
        "delayMs": 100
      },
      "timeout": 30000,
      "maxRetries": 3,
      "mapper": "github-trending",
      "metadata": {
        "frequency": "daily",
        "quality_rating": 5,
        "priority": "HIGH"
      }
    }
  ]
}
```

### Key Fields Explained

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `id` | string | ✅ | Unique identifier (kebab-case, used in logs) |
| `name` | string | ✅ | Display name for humans |
| `type` | enum | ✅ | `rss` \| `rest` \| `graphql` |
| `enabled` | boolean | ✅ | Toggle source on/off (no code change) |
| `url` | string | RSS only | RSS feed URL |
| `endpoint` | string | REST/GraphQL | API endpoint |
| `method` | enum | REST only | `GET` \| `POST` |
| `query` | string | GraphQL only | GraphQL query with `$variables` |
| `auth` | object | optional | Authentication config (see below) |
| `filters` | object | optional | Source-specific filtering (see below) |
| `rateLimit` | object | optional | Throttling per-source |
| `timeout` | number | ✅ | Per-request timeout (ms) |
| `maxRetries` | number | ✅ | Retry attempts on transient errors |
| `mapper` | string | ✅ | Strategy name: `rss`, `papers-with-code`, `github-trending`, etc |
| `metadata` | object | optional | Priority, quality rating, frequency (for sorting/monitoring) |

### Authentication Schema

**Supported Types:** `apiKey`, `bearer`, `basic`, `oauth2`

```json
{
  "auth": {
    "type": "bearer",
    "headers": {
      "Authorization": "Bearer ${ENV_VAR_NAME}"
    }
  }
}
```

**Environment Variable Substitution:**
- Syntax: `${VAR_NAME}` (uppercase, underscores)
- Substituted at startup by SourceManager
- Missing var → startup error (fail-hard)
- Example: `${GITHUB_TOKEN}` → reads from `process.env.GITHUB_TOKEN`

### Filter Semantics (RSS vs API)

**RSS Filters** (applied post-fetch by mapper)
```json
{
  "type": "rss",
  "filters": {
    "includeKeywords": ["ai", "test"],
    "excludeKeywords": ["sponsorship"],
    "daysBack": 30
  }
}
```
→ Fetcher returns full feed, mapper filters by keyword/date

**REST/GraphQL Filters** (applied pre-fetch by fetcher)
```json
{
  "type": "rest",
  "filters": {
    "queryParams": {
      "ordering": "-published",
      "tags": "ai,testing"
    },
    "keywordFilter": ["ai"],
    "limit": 20
  }
}
```
→ Fetcher sends query params to endpoint

---

## 3. Source Manager & Loader

**Purpose:** Load config.json, validate, substitute env vars, provide runtime API.

**File:** `src/sources/sources.ts`

### SourceManager Class

```typescript
export class SourceManager {
  private registry: SourceRegistry;
  private substitutedAuthCache: Map<string, AuthConfig> = new Map();

  constructor(configPath: string = 'src/sources/config.json') {
    this.registry = this.loadAndValidate(configPath);
  }

  /**
   * Get all enabled sources
   */
  getEnabled(): SourceConfig[] {
    return this.registry.sources.filter(s => s.enabled);
  }

  /**
   * Get sources by type
   */
  getByType(type: 'rss' | 'rest' | 'graphql'): SourceConfig[] {
    return this.registry.sources.filter(s => s.enabled && s.type === type);
  }

  /**
   * Get source by ID
   */
  getById(id: string): SourceConfig | undefined {
    return this.registry.sources.find(s => s.id === id);
  }

  /**
   * Get authentication headers with environment variables substituted
   * THROWS if required env var is missing
   */
  getAuthHeaders(sourceId: string): Record<string, string> {
    const source = this.getById(sourceId);
    if (!source?.auth) return {};

    if (this.substitutedAuthCache.has(sourceId)) {
      return this.substitutedAuthCache.get(sourceId)!.headers || {};
    }

    const headers = this.substituteEnvVars(source.auth.headers || {});
    this.substitutedAuthCache.set(sourceId, { ...source.auth, headers });
    return headers;
  }

  private loadAndValidate(configPath: string): SourceRegistry {
    // Load JSON, validate schema, substitute env vars
    // THROWS if config invalid or env vars missing
    // Logs: "✅ Loaded config: N sources (M enabled)"
  }

  private validateSource(source: SourceConfig): void {
    // Validate required fields per source type
    // Validate auth env vars exist
    // THROWS SourceValidationError on failure
  }

  private substituteEnvVars(obj: Record<string, string>): Record<string, string> {
    // Replace ${VAR_NAME} with process.env.VAR_NAME
    // THROWS if var missing
  }
}

export class SourceValidationError extends Error {
  constructor(message: string, public sourceId: string, public details: unknown) {
    super(`[${sourceId}] ${message}`);
  }
}
```

### Usage in Daily Brief

```typescript
const sourceManager = new SourceManager();
const rssSources = sourceManager.getByType('rss');
const apiSources = sourceManager.getByType('rest').concat(
  sourceManager.getByType('graphql')
);

// Fetch from all enabled sources
const rssArticles = await fetchRSS(rssSources);
const apiArticles = await fetchAPIs(apiSources);
```

### Startup Validation

At app startup, SourceManager:
- ✅ Parses JSON syntax
- ✅ Validates schema (required fields, type-specific rules)
- ✅ Checks auth (env vars exist)
- ❌ **FAILS HARD** if any error

Result: Ops sees error immediately, not mid-workflow.

```
❌ Failed to load sources config:
  [papers-with-code] Missing environment variable: PAPERS_API_KEY
App exits with code 1
```

---

## 4. Error Handling Strategy

**Principle:** Fail gracefully at each layer.

### Startup (SourceManager)
- **Behavior:** Validate config.json, throw if invalid
- **Outcome:** App doesn't start with broken config
- **Responsibility:** SourceManager
- **Recovery:** Fix config.json or env vars, restart

### Fetch Layer (Per-Source Isolation)
- **Behavior:** Fetch each source independently
- **Outcome:** One source fails ≠ abort all
- **Responsibility:** fetch/orchestrator.ts
- **Recovery:** Log error, continue to next source

```typescript
for (const source of sources) {
  try {
    const articles = await fetcher.fetch(source);
    results.push({ sourceId: source.id, status: 'success', count: articles.length });
  } catch (error) {
    results.push({ sourceId: source.id, status: 'error', error: error.message });
    console.warn(`[${source.id}] Fetch failed: ${error}`);
  }
}
// Return partial success—articles from successful sources only
```

### Transform Layer (Per-Article Resilience)
- **Behavior:** Map each article independently
- **Outcome:** One article fails ≠ abort feed
- **Responsibility:** transform/mappers/*.ts
- **Recovery:** Skip article, log warning, continue

```typescript
const results: RawArticle[] = [];
for (const item of response.data) {
  try {
    const article = mapper.map(item);
    results.push(article);
  } catch (error) {
    console.warn(`Failed to map article: ${error}`);
    // Skip this article, continue
  }
}
```

### Logging Strategy
- **Format:** Structured JSON + human-readable text
- **Includes:** timestamp, stage, source ID, status, error, duration
- **Never logs:** Raw config (contains secrets)

```typescript
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  stage: 'fetch',
  sourceId: 'papers-with-code',
  status: 'success',
  articleCount: 20,
  durationMs: 1234
}));

console.warn(JSON.stringify({
  timestamp: new Date().toISOString(),
  stage: 'fetch',
  sourceId: 'product-hunt',
  status: 'error',
  error: 'HTTP 429: Too Many Requests',
  durationMs: 50
}));
```

---

## 5. Rate Limiting & Resilience

**Purpose:** Prevent overwhelming external APIs, handle cascading failures gracefully.

### Rate Limiter (Token Bucket per Source)

**File:** `src/fetch/rate-limiter.ts`

```typescript
export class RateLimiter {
  private tokens: Map<string, number> = new Map();
  private lastRefillTime: Map<string, number> = new Map();

  /**
   * Check if source can make a request.
   * Returns: 'allow' (proceed) | 'backoff' (wait 1-5s) | 'skip' (retry next run)
   */
  async checkRateLimit(source: SourceConfig): Promise<'allow' | 'backoff' | 'skip'> {
    if (!source.rateLimit) return 'allow';

    const tokensPerSecond = source.rateLimit.requestsPerHour / 3600;
    const msPerToken = 1000 / tokensPerSecond;

    // Refill tokens based on time passed
    const now = Date.now();
    const lastRefill = this.lastRefillTime.get(source.id) || now;
    let tokens = (this.tokens.get(source.id) || 0) + ((now - lastRefill) / msPerToken);
    tokens = Math.min(source.rateLimit.requestsPerHour, tokens);

    this.tokens.set(source.id, tokens);
    this.lastRefillTime.set(source.id, now);

    if (tokens >= 1) {
      this.tokens.set(source.id, tokens - 1);
      return 'allow';
    } else {
      const waitMs = Math.ceil(msPerToken - tokens * msPerToken);
      return waitMs < 5000 ? 'backoff' : 'skip';
    }
  }
}
```

**Algorithm:** Token Bucket
- Tokens refill at configured rate (e.g., 100 req/hr = 1 token per 36 sec)
- Each request costs 1 token
- If no tokens available, decide: wait (backoff) or retry later (skip)

### Circuit Breaker (Cascade Protection)

```typescript
export class SourceCircuitBreaker {
  private failureCount: Map<string, number> = new Map();
  private lastFailureTime: Map<string, number> = new Map();

  canFetch(sourceId: string): boolean {
    const failures = this.failureCount.get(sourceId) || 0;
    const lastFailure = this.lastFailureTime.get(sourceId);

    // If 3+ consecutive failures AND last failure < 1 hour ago → skip
    if (failures >= 3 && lastFailure && Date.now() - lastFailure < 3600_000) {
      console.warn(`[${sourceId}] Circuit open (${failures} consecutive failures)`);
      return false;  // Skip this source, try again later
    }

    return true;
  }

  recordSuccess(sourceId: string): void {
    this.failureCount.set(sourceId, 0);
  }

  recordFailure(sourceId: string): void {
    const failures = (this.failureCount.get(sourceId) || 0) + 1;
    this.failureCount.set(sourceId, failures);
    this.lastFailureTime.set(sourceId, Date.now());
  }
}
```

**Strategy:**
- After 3 consecutive failures, temporarily disable source for 1 hour
- Prevents cascading failures (broken API doesn't poison daily brief)
- Automatic recovery after cool-off period

---

## 6. Mapper & Fetcher Pattern (Strategy)

**Problem:** Each source has unique response format. Can't use one-size-fits-all mapper.

**Solution:** Strategy pattern—one mapper per source, referenced by config.

### Fetcher Pattern (Generic by Type)

**File:** `src/fetch/fetchers/rest-fetcher.ts`

```typescript
export class RESTFetcher {
  /**
   * Generic REST API fetcher
   * Applies auth headers, makes request, validates response
   */
  async fetch(source: SourceConfig): Promise<unknown> {
    const headers = getAuthHeaders(source);
    const url = this.buildURL(source);
    
    const response = await fetch(url, {
      method: source.method || 'GET',
      headers
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  private buildURL(source: SourceConfig): string {
    // Add query params from source.filters.queryParams
  }
}
```

**Fetcher Types:**
- `rss-fetcher.ts` — Generic RSS/Atom feed parser
- `rest-fetcher.ts` — Generic REST API client
- `graphql-fetcher.ts` — Generic GraphQL executor

### Mapper Pattern (Source-Specific)

**File:** `src/transform/mappers/papers-with-code.ts`

```typescript
export async function mapPapersWithCodeArticles(
  rawResponse: unknown,
  filters: APIFilters
): Promise<RawArticle[]> {
  const response = rawResponse as PapersAPIResponse;

  return response.data
    .filter(paper => {
      // Apply filters from config
      const age = daysSince(paper.published);
      return age <= (filters.daysBack || 7);
    })
    .map(paper => ({
      link: paper.arxiv_url || paper.url,
      title: paper.title,
      pubDate: paper.published,
      content: paper.summary.slice(0, 200),
      source: 'Papers with Code'
    }));
}
```

**One mapper per source:**
- `rss-mapper.ts` — RSS feed → Article (generic, all RSS feeds)
- `papers-with-code.ts` — Papers API → Article
- `github-trending.ts` — GitHub REST → Article
- `product-hunt.ts` — Product Hunt GraphQL → Article
- ... (one per source)

### Data Flow

```
config.json specifies: type='rest', endpoint='...', mapper='papers-with-code'
  ↓
Fetch orchestrator loads SourceManager, gets source by ID
  ↓
Fetcher layer calls: RESTFetcher.fetch(source)
  ↓
Returns raw JSON response
  ↓
Transform layer calls: mapPapersWithCodeArticles(response, config.filters)
  ↓
Returns standardized RawArticle[]
```

**Benefits:**
- ✅ Fetchers are generic (reusable across sources)
- ✅ Mappers are source-specific (no sprawling if-statements)
- ✅ Adding new source: Create 1 mapper file + add JSON entry
- ✅ No hardcoding; everything in config

---

## 7. Testing Approach

### Dependency Injection

**File:** `src/cli/daily-brief.ts`

```typescript
export interface DailyBriefDependencies {
  sourceManager?: SourceManager;
  rssFetcher?: RSSFetcher;
  restFetcher?: RESTFetcher;
  graphqlFetcher?: GraphQLFetcher;
}

export async function runDailyBrief(deps?: DailyBriefDependencies) {
  const sm = deps?.sourceManager || new SourceManager();
  const rssFetcher = deps?.rssFetcher || new RSSFetcher();
  const restFetcher = deps?.restFetcher || new RESTFetcher();
  const graphqlFetcher = deps?.graphqlFetcher || new GraphQLFetcher();

  // ... proceed with fetch → transform → enrich → publish
}
```

**Benefits:**
- ✅ Tests can inject mocks
- ✅ No need to mock external APIs in tests
- ✅ Each component testable independently

### Test Fixture Config

**File:** `tests/sources/config.test.json`

```json
{
  "version": "1.0",
  "sources": [
    {
      "id": "test-rss",
      "name": "Test RSS Feed",
      "type": "rss",
      "enabled": true,
      "url": "http://localhost:3000/test-feed.xml",
      "mapper": "rss",
      "timeout": 30000,
      "maxRetries": 1
    }
  ]
}
```

### Test Examples

```typescript
// tests/cli/daily-brief.test.ts
it('should fetch from all enabled sources', async () => {
  const sm = new SourceManager('tests/sources/config.test.json');
  const rssFetcher = new MockRSSFetcher();

  await runDailyBrief({ sourceManager: sm, rssFetcher });

  expect(rssFetcher.fetchCalls).toHaveLength(1);
  expect(rssFetcher.fetchCalls[0].id).toBe('test-rss');
});

// Run with subset of sources
it('should fetch only RSS sources', async () => {
  const sm = new SourceManager();
  const rssSources = sm.getByType('rss');

  const articles = await fetchAllSources(rssSources);

  expect(articles.length).toBeGreaterThan(0);
});
```

---

## 8. Phase 1 Implementation Scope

This design enables Phase 1 (Week 1): **7 RSS feeds + Papers with Code API**

### Files to Create

```
src/sources/
  ├── config.json
  └── sources.ts

src/fetch/
  ├── fetchers/
  │   ├── rss-fetcher.ts
  │   └── rest-fetcher.ts
  ├── rate-limiter.ts
  ├── circuit-breaker.ts
  └── orchestrator.ts

src/transform/
  ├── mappers/
  │   ├── rss-mapper.ts
  │   └── papers-with-code.ts
  └── deduplicator.ts (update existing)

tests/
  ├── sources/
  │   └── config.test.json
  └── fetch/
      ├── rate-limiter.test.ts
      └── orchestrator.test.ts
```

### Files to Refactor

- Move existing mappers from `business-logic/` to `transform/mappers/`
- Update `daily-brief.ts` to use SourceManager + new fetch orchestrator
- Delete old config files (rss-sources.config.ts, api-sources.config.ts)

---

## 9. Success Criteria

| Criteria | Target | Verification |
|----------|--------|--------------|
| All sources in JSON config | 100% | `config.json` has 15+ sources |
| Add new source (JSON only) | < 1 minute | Time to edit config.json + verify |
| Enable/disable source | 1 flag change | No code changes required |
| Error handling | Partial success | One source fails ≠ abort pipeline |
| Rate limiting | No 429 errors | Monitor logs for rate limit hits |
| Tests passing | 50+ tests | Existing + new test suites pass |
| Startup validation | Fail hard | Missing env var → immediate error |

---

## 10. Known Limitations & Future Work

### Phase 2 (Not in Scope)
- [ ] Config hot-reload (currently requires restart)
- [ ] Mapper validation (verify `mapper` field exists)
- [ ] Auth header caching TTL (currently infinite)
- [ ] Monitoring dashboard (per-source metrics)
- [ ] UI for source management (currently JSON edit only)

### Design Assumptions
- Env vars are static (not refreshed during runtime)
- One restart required per config change
- Secrets managed via environment variables (not encrypted)
- Sources are publicly accessible (no VPN/firewall context passed)

---

## References

- **Project:** ChiefofStaff M3 Daily Brief
- **Issue:** Replace `business-logic/` with clearer structure; enable JSON-based source config
- **Previous Review:** Critical Design Review (2026-08-01) identified auth, filters, mapper gaps—all resolved
- **Status:** ✅ Ready for Implementation Planning

---

**Approval:** ✅ Design reviewed and approved for implementation.

**Next Step:** Invoke writing-plans skill for detailed implementation roadmap (Phase 1: Week 1).
