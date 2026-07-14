# PATH 1 Implementation: GitHub Actions + TypeScript + NDJSON

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate PAIOS from VPS+Docker+n8n+PostgreSQL to GitHub Actions+TypeScript+NDJSON while keeping n8n as an optional orchestration layer, reducing cost to 0 PLN and moving parts from 4 to 1.

**Architecture:** Three-layer architecture: (Layer 1) Pure TypeScript business logic, (Layer 2) Execution adapters (GitHub Actions primary, CLI, Docker, n8n optional), (Layer 3) State management via NDJSON+git. Business logic portable across all execution platforms.

**Tech Stack:** TypeScript/Node.js (business logic), GitHub Actions (scheduling), NDJSON (state), CLI (local execution), Docker (future VPS), n8n (optional)

## Global Constraints

- Business logic must NOT depend on execution platform
- Code must be executable from CLI, GitHub Actions, Docker, and optionally n8n without modification
- State management via NDJSON files (git-committed), no external database until 100k+ rows
- All changes must be backwards-compatible (n8n workflows remain intact but optional)
- Zero infrastructure cost (use free GitHub Actions)
- Preserve 100% of current functionality (users see no difference)

---

## PHASE 0-1: M3 + M4 Business Logic Migration & Parallel Verification

Extract business logic from n8n Code nodes into TypeScript modules. Create GitHub Actions workflows. Verify parity with legacy n8n. Keep both systems running in parallel during transition.

### Task 1: Extract M3 (Daily Brief) Business Logic

**Files:**
- Create: `src/business-logic/rss-fetch.ts`
- Create: `src/business-logic/normalize-article.ts`
- Create: `src/business-logic/score-article.ts`
- Create: `src/business-logic/generate-brief.ts`
- Create: `src/business-logic/telegram.ts`
- Create: `src/cli/daily-brief.ts`
- Create: `tests/business-logic/generate-brief.test.ts`

**Interfaces:**
- Consumes: Existing n8n Daily Brief workflow logic (as reference)
- Produces: Pure TypeScript functions that can execute independently, CLI entry point

**Deliverable:** Complete M3 business logic as TypeScript modules, executable via `npx ts-node src/cli/daily-brief.ts`.

- [ ] **Step 1: Read n8n Daily Brief workflow and extract business logic**

Read: `workflows/daily-brief.json` (or local n8n export) to understand the exact logic:
- RSS fetch from configured sources
- Article normalization (fields, cleaning)
- Scoring logic (keywords, freshness, etc.)
- Brief generation (summary, formatting)
- Telegram publishing

Document the exact algorithm in comments.

- [ ] **Step 2: Create rss-fetch.ts**

```typescript
// src/business-logic/rss-fetch.ts
import Parser from 'rss-parser';

export interface RawArticle {
  link: string;
  title: string;
  pubDate: string;
  content: string;
  source: string;
}

export async function fetchRSS(sourceUrl: string, sourceName: string): Promise<RawArticle[]> {
  const parser = new Parser();
  const feed = await parser.parseURL(sourceUrl);
  return (feed.items || []).map(item => ({
    link: item.link || '',
    title: item.title || '',
    pubDate: item.pubDate || new Date().toISOString(),
    content: item.content || item.description || '',
    source: sourceName
  }));
}
```

- [ ] **Step 3: Create normalize-article.ts**

Extract normalization logic from n8n (field mapping, cleaning, type coercion):

```typescript
// src/business-logic/normalize-article.ts
export interface Article {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: string;
  publishedAt: string;
  tags: string[];
}

export function normalizeArticle(raw: RawArticle): Article {
  // Extract exact logic from n8n Code node
  // Return normalized Article shape
}
```

- [ ] **Step 4: Create score-article.ts**

Extract scoring logic (keyword matching, freshness, source credibility):

```typescript
// src/business-logic/score-article.ts
export function scoreArticle(article: Article, keywords: string[]): number {
  let score = 0;
  // Exact logic from n8n scoring node
  return score;
}
```

- [ ] **Step 5: Create generate-brief.ts**

Logic for selecting top articles and formatting brief:

```typescript
// src/business-logic/generate-brief.ts
export function generateBrief(articles: Article[], count: number = 10): string {
  // Select top N by score
  // Format markdown
  // Return formatted string
}
```

- [ ] **Step 6: Create telegram.ts**

```typescript
// src/business-logic/telegram.ts
export async function sendTelegram(message: string, botToken: string, chatId: string): Promise<void> {
  // Send to Telegram API
}
```

- [ ] **Step 7: Create CLI entry point**

```typescript
// src/cli/daily-brief.ts
import { fetchRSS } from '../business-logic/rss-fetch';
import { normalizeArticle } from '../business-logic/normalize-article';
import { scoreArticle } from '../business-logic/score-article';
import { generateBrief } from '../business-logic/generate-brief';
import { sendTelegram } from '../business-logic/telegram';

async function main() {
  const sources = [/* from config */];
  const articles = [];
  for (const source of sources) {
    const raw = await fetchRSS(source.url, source.name);
    articles.push(...raw.map(normalizeArticle));
  }
  const keywords = [/* from config */];
  articles.forEach(a => a.score = scoreArticle(a, keywords));
  articles.sort((a, b) => b.score - a.score);
  const brief = generateBrief(articles, 10);
  await sendTelegram(brief, process.env.TELEGRAM_BOT_TOKEN!, process.env.TELEGRAM_CHAT_ID!);
}

main().catch(console.error);
```

- [ ] **Step 8: Write tests**

```typescript
// tests/business-logic/generate-brief.test.ts
describe('generateBrief', () => {
  it('selects top N articles by score', () => {
    const articles = [
      { score: 100, title: 'Article 1' },
      { score: 50, title: 'Article 2' },
      { score: 80, title: 'Article 3' },
    ];
    const brief = generateBrief(articles, 2);
    expect(brief).toContain('Article 1');
    expect(brief).toContain('Article 3');
    expect(brief).not.toContain('Article 2');
  });
});
```

- [ ] **Step 9: Test CLI locally**

```bash
npm run build
npx ts-node src/cli/daily-brief.ts
# Expected: Daily brief generated and sent to Telegram (or logged if test mode)
```

- [ ] **Step 10: Commit**

```bash
git add src/business-logic/ src/cli/daily-brief.ts tests/business-logic/
git commit -m "feat(M3): Extract Daily Brief business logic to TypeScript

- rss-fetch: Fetch articles from RSS sources
- normalize-article: Normalize article shape
- score-article: Score articles by keywords/freshness
- generate-brief: Select top articles and format markdown
- telegram: Send to Telegram API
- CLI entry point: npx ts-node src/cli/daily-brief.ts

Executable independently from n8n. Ready for GitHub Actions.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 2: Create ArticleStore (NDJSON-based State Management)

**Files:**
- Create: `src/business-logic/article-store.ts`
- Create: `data/canonical_articles.ndjson` (empty)
- Create: `tests/business-logic/article-store.test.ts`

**Interfaces:**
- Consumes: Normalized Article type
- Produces: ArticleStore interface with dedup logic

**Deliverable:** Pure TypeScript module for reading/writing NDJSON article state with dedup and concurrency guards.

- [ ] **Step 1: Design ArticleStore interface**

```typescript
// src/business-logic/article-store.ts
export interface ArticleStore {
  read(): Promise<Article[]>;
  write(articles: Article[]): Promise<void>;
  dedupAndMerge(newArticles: Article[]): Promise<Article[]>;
}

export class NdJsonArticleStore implements ArticleStore {
  constructor(private filePath: string) {}
  
  async read(): Promise<Article[]> {
    // Read NDJSON, parse each line, return Article[]
  }
  
  async write(articles: Article[]): Promise<void> {
    // Write Article[] as NDJSON (one per line)
  }
  
  async dedupAndMerge(newArticles: Article[]): Promise<Article[]> {
    // Read existing
    // Dedup by source + title hash
    // Merge with new
    // Keep only last 30 days
    // Return merged
  }
}
```

- [ ] **Step 2: Implement read()**

Read NDJSON file, parse each line as JSON, return Article[].

- [ ] **Step 3: Implement write()**

Write Article[] to NDJSON (one article per line, no outer array).

- [ ] **Step 4: Implement dedupAndMerge()**

Dedup logic:
- Create Map<dedupKey, Article> from existing
- For each new article, check dedupKey
- If exists: update seenCount, score
- If new: add to map
- Remove articles older than 30 days
- Write merged back to file

- [ ] **Step 5: Add concurrency guard**

Use file locking (or git lock pattern) to prevent simultaneous writes:

```typescript
async write(articles: Article[]): Promise<void> {
  const lockFile = this.filePath + '.lock';
  // Acquire lock (fail if exists and older than 5 min)
  // Write articles
  // Release lock
}
```

- [ ] **Step 6: Write tests**

```typescript
describe('NdJsonArticleStore', () => {
  it('deduplicates articles by source + title', async () => {
    const store = new NdJsonArticleStore('./test.ndjson');
    const articles1 = [{ source: 'reddit', title: 'Test', score: 50 }];
    const articles2 = [{ source: 'reddit', title: 'Test', score: 100 }];
    await store.write(articles1);
    const merged = await store.dedupAndMerge(articles2);
    expect(merged.length).toBe(1);
    expect(merged[0].seenCount).toBe(2);
  });
});
```

- [ ] **Step 7: Commit**

```bash
git add src/business-logic/article-store.ts data/canonical_articles.ndjson tests/
git commit -m "feat: Add ArticleStore for NDJSON-based state management

- Read/write NDJSON article storage
- Dedup logic (source + title hash)
- Concurrency guard (file locking)
- 30-day retention window
- Replace PostgreSQL for MVP stage

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 3: Extract M4 (Knowledge Layer) Business Logic

**Files:**
- Create: `src/business-logic/persist-articles.ts`
- Create: `src/business-logic/export-latest-news.ts`
- Create: `src/cli/export-latest-news.ts`
- Create: `tests/business-logic/export-latest-news.test.ts`

**Interfaces:**
- Consumes: Article type, ArticleStore
- Produces: Functions to persist articles and export JSON

**Deliverable:** M4 logic (persist, export) as TypeScript, executable via CLI.

- [ ] **Step 1: Create persist-articles.ts**

```typescript
// src/business-logic/persist-articles.ts
export async function persistArticles(articles: Article[], store: ArticleStore): Promise<void> {
  // Deduplicate and merge with existing
  const merged = await store.dedupAndMerge(articles);
  // Write back to store
  await store.write(merged);
}
```

- [ ] **Step 2: Create export-latest-news.ts**

```typescript
// src/business-logic/export-latest-news.ts
export interface LatestNewsExport {
  date: string;
  updatedAt: string;
  items: Article[];
}

export async function exportLatestNews(store: ArticleStore, limit: number = 50): Promise<LatestNewsExport> {
  const articles = await store.read();
  const sorted = articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
  return {
    date: new Date().toISOString().split('T')[0],
    updatedAt: new Date().toISOString(),
    items: sorted.slice(0, limit)
  };
}
```

- [ ] **Step 3: Create CLI for export**

```typescript
// src/cli/export-latest-news.ts
import { exportLatestNews } from '../business-logic/export-latest-news';
import { NdJsonArticleStore } from '../business-logic/article-store';
import * as fs from 'fs/promises';

async function main() {
  const store = new NdJsonArticleStore('./data/canonical_articles.ndjson');
  const latest = await exportLatestNews(store, 50);
  const outputPath = './qa-news/public/latest.json';
  await fs.writeFile(outputPath, JSON.stringify(latest, null, 2));
  console.log(`Exported ${latest.items.length} articles to ${outputPath}`);
}

main().catch(console.error);
```

- [ ] **Step 4: Write tests and commit**

```bash
git add src/business-logic/persist-articles.ts src/business-logic/export-latest-news.ts src/cli/export-latest-news.ts tests/
git commit -m "feat(M4): Extract Knowledge Layer logic to TypeScript

- persist-articles: Deduplicate and merge articles into canonical store
- export-latest-news: Export top N articles as JSON for QA News
- CLI: npx ts-node src/cli/export-latest-news.ts

Replaces n8n persist/export workflows. Executable independently.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 4: Create GitHub Actions Workflows (M3 + M4 Scheduling)

**Files:**
- Create: `.github/workflows/daily-brief.yml`
- Create: `.github/workflows/export-latest-news.yml`
- Modify: `.github/workflows/deploy.yml` (already exists)

**Interfaces:**
- Consumes: CLI entry points from Tasks 1-3
- Produces: Scheduled workflows replacing n8n scheduling

**Deliverable:** GitHub Actions workflows for daily M3 and M4 execution.

- [ ] **Step 1: Create daily-brief.yml**

```yaml
name: Daily Brief

on:
  schedule:
    - cron: '0 8 * * *'  # 08:00 UTC daily
  workflow_dispatch:  # Manual trigger

jobs:
  daily-brief:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Generate Daily Brief
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
        run: npx ts-node src/cli/daily-brief.ts
      
      - name: Commit articles
        run: |
          git config user.name "PAIOS Bot"
          git config user.email "bot@paios.local"
          git add data/canonical_articles.ndjson
          git commit -m "chore: update canonical articles from daily brief" || true
          git push
```

- [ ] **Step 2: Create export-latest-news.yml**

```yaml
name: Export Latest News

on:
  schedule:
    - cron: '5 8 * * *'  # 08:05 UTC daily (after Daily Brief)
  workflow_dispatch:

jobs:
  export:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Export Latest News
        run: npx ts-node src/cli/export-latest-news.ts
      
      - name: Push to QA News
        run: |
          cd qa-news
          git config user.name "PAIOS Bot"
          git config user.email "bot@paios.local"
          git add public/latest.json
          git commit -m "chore: update latest.json from knowledge layer" || true
          git push
```

- [ ] **Step 3: Commit workflows**

```bash
git add .github/workflows/daily-brief.yml .github/workflows/export-latest-news.yml
git commit -m "ci: Add GitHub Actions workflows for M3 and M4

- daily-brief.yml: Scheduled 08:00 UTC (replaces n8n M3)
- export-latest-news.yml: Scheduled 08:05 UTC (replaces n8n M4 export)
- Invokes TypeScript CLI entry points
- Auto-commits to canonical_articles and latest.json

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Task 5: Verify Parity (Legacy n8n vs New GitHub Actions)

**Files:**
- Modify: `docs/ARCHITECTURE_REVIEW.md` (add parity verification results)

**Interfaces:**
- Consumes: Working legacy n8n system, new TypeScript CLI, GitHub Actions workflows
- Produces: Verification that both systems produce identical output

**Deliverable:** Proof that new system produces same output as n8n (within acceptable tolerances).

- [ ] **Step 1: Run both systems in parallel**

- [ ] **Step 2: Compare outputs**

- [ ] **Step 3: Document parity verification**

- [ ] **Step 4: Commit**

---

## PHASE 2: M5 Greenfield Build (Weekly/Monthly Aggregation)

Build M5 (Weekly Highlights, Monthly Recap) natively in new architecture (TypeScript + GitHub Actions + NDJSON).

### Task 6: Build M5 Business Logic

### Task 7: Create M5 GitHub Actions Workflows

---

## PHASE 3: Make n8n Optional

### Task 8: Document n8n as Optional Layer

### Task 9: Verify all logic works without n8n

---

## Summary

**Timeline:** ~4.5 days
- Phase 0-1: 3 days (Tasks 1-5)
- Phase 2: 1 day (Tasks 6-7)
- Phase 3: 0.5 days (Tasks 8-9)

**Cost Reduction:** 120-200 PLN/mo (VPS) → 0 PLN
**Complexity Reduction:** 4 platforms → 1 (GitHub Actions primary)
**Flexibility:** n8n remains optional, not mandatory

**Success Criteria:**
- All business logic as TypeScript modules (portable)
- GitHub Actions scheduling (zero cost)
- NDJSON state management (git history)
- CLI executable (local development)
- Parity verified with legacy n8n
- M5 built greenfield in new architecture
- n8n documented as optional, not removed
