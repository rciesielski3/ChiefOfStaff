# M5 Implementation Plan: Weekly Highlights & Monthly Recap

> **For agentic workers:** Use superpowers:subagent-driven-development with parallel tracks A and B. Companion spec: `docs/superpowers/specs/2026-07-14-m5-planning.md`.

## Goal

Implement M5 (Weekly Highlights + Monthly Recap) as two independent parallel tracks, ready for immediate execution.

## Architecture

- **Track A (Weekly):** Aggregate last 7 days of articles, rank by score, export JSON, display in QA News
- **Track B (Monthly):** Aggregate last 30 days of articles, rank by score, group by category, export JSON, display in QA News

## Global Constraints

- Data source: `canonical_articles` Data Table (must exist from M4)
- Export format: JSON matching weekly/monthly schema (see spec)
- QA News: Next.js 14 static export (build-time data loading)
- No hardcoded paths (use env vars from Task 3 of P1.0 fixes)
- PR workflow: Code review gate, user pushes to remote

---

## Track A: Weekly Highlights

### Task A1: Weekly Aggregation Workflow

**Model:** Haiku
**Files:** n8n workflow: `aggregate-weekly`

**Steps:**

1. **Create n8n workflow: `aggregate-weekly`**
   - Trigger: Manual or cron (daily at 08:10, after M4 export)
   - Query `canonical_articles` for articles from past 7 days
   - Score and rank by relevance (`ORDER BY score DESC`)
   - Select top 10-15 articles
   - Group by category (optional)
   - Format as weekly JSON
   - Output: `weekly-data.json` structure (see spec)

2. **Configure workflow steps in n8n**
   - Data Table Query: `SELECT * FROM canonical_articles WHERE addedAt >= NOW() - INTERVAL 7 DAY ORDER BY score DESC LIMIT 15`
   - Transform: Group by category if needed
   - Generate metadata (week number, date range, `generatedAt`)
   - Test with sample data

3. **Verify workflow executes**
   - Manual trigger in n8n UI
   - Check logs for errors
   - Verify output shape matches schema

4. **Commit**
   ```bash
   # n8n workflows are auto-imported; document config
   git add -A  # If any workflow export files
   git commit -m "feat(M5-A1): Create weekly aggregation workflow

   - Query canonical_articles from past 7 days
   - Rank by score (top 15)
   - Group by category
   - Export weekly-data.json structure

   Ready for A2 (export) and A3 (QA News display)"
   ```

### Task A2: Export Weekly JSON

**Model:** Haiku
**Files:** n8n workflow: `export-weekly` (extension of `aggregate-weekly`)

**Steps:**

1. **Extend `aggregate-weekly` workflow with export step**
   - After Transform: Add File Write node
   - Path: `${EXPORT_FILE_PATH}/../../public/weekly-data.json` (or full path)
   - Content: formatted weekly JSON
   - Add timestamp to cache-bust browsers

2. **Verify file is written**
   ```bash
   ls -lh qa-news/public/weekly-data.json
   cat qa-news/public/weekly-data.json | jq . | head -30
   ```
   Expected: File exists, valid JSON

3. **Test end-to-end**
   - Trigger workflow manually
   - Verify file updated with new timestamp
   - Verify JSON is parseable

4. **Commit**
   ```bash
   git add qa-news/public/weekly-data.json
   git commit -m "feat(M5-A2): Export weekly JSON for QA News

   - Workflow writes weekly-data.json to qa-news/public/
   - Includes metadata (week, dates, generatedAt)
   - Cache-busting timestamp on each export

   QA News can now consume this data in A3"
   ```

### Task A3: Weekly Page in QA News

**Model:** Sonnet
**Files:** `qa-news/src/app/weekly/page.tsx`, `qa-news/src/lib/data.ts`

**Steps:**

1. **Add `getWeeklyHighlights()` to `lib/data.ts`**
   ```typescript
   export async function getWeeklyHighlights() {
     const raw = await fs.readFile(
       path.join(process.cwd(), 'public/weekly-data.json'),
       'utf-8'
     );
     return JSON.parse(raw);
   }
   ```

2. **Create `qa-news/src/app/weekly/page.tsx`**
   ```typescript
   import { getWeeklyHighlights } from '@/lib/data';

   export default async function WeeklyPage() {
     const weekly = await getWeeklyHighlights();

     return (
       <div className="container mx-auto">
         <h1>Weekly Highlights</h1>
         <p>{weekly.weekStart} to {weekly.weekEnd}</p>

         <div className="articles">
           {weekly.articles.map((article) => (
             <PipelineEntry key={article.id} article={article} />
           ))}
         </div>
       </div>
     );
   }
   ```

3. **Style to match Daily/Latest pages** (reuse existing `PipelineEntry` component)

4. **Test build**
   ```bash
   npm run build
   # Should complete with 0 errors, include /weekly page
   ```

5. **Commit**
   ```bash
   git add qa-news/src/app/weekly/page.tsx qa-news/src/lib/data.ts
   git commit -m "feat(M5-A3): Build Weekly Highlights page in QA News

   - New /weekly route displays weekly aggregated articles
   - Loads weekly-data.json at build time
   - Uses PipelineEntry component for consistent styling
   - Builds successfully with npm run build"
   ```

### Task A4: Test Weekly Aggregation

**Model:** Haiku
**Files:** `qa-news/tests/weekly.test.ts` (new tests)

**Steps:**

1. **Test: Articles are ranked by score**
   - Verify articles are sorted descending by score
   - Verify first article has the highest score

2. **Test: Dedup works (no duplicate articles)**
   - Verify all article IDs are unique in weekly export

3. **Test: JSON schema matches spec**
   - Verify required keys present: `week`, `weekStart`, `weekEnd`, `articles[]`, `generatedAt`

4. **Test: QA News build succeeds with weekly data**
   ```bash
   npm run build
   # Expected: 0 errors, /weekly page generated
   ```

5. **Commit**
   ```bash
   git add qa-news/tests/weekly.test.ts
   git commit -m "test(M5-A4): Add weekly aggregation tests

   - Articles ranked by score (DESC)
   - No duplicates in weekly export
   - JSON schema validation
   - QA News build succeeds

   All tests passing"
   ```

---

## Track B: Monthly Recap

Track B mirrors Track A with a 30-day window, top 20-30 articles, and **required** category grouping (`byCategory`).

### Task B1: Monthly Aggregation Workflow

**Model:** Haiku
**Files:** n8n workflow: `aggregate-monthly`

**Steps:**

1. **Create n8n workflow: `aggregate-monthly`**
   - Trigger: Manual or cron (daily at 08:15, after M4 export and weekly)
   - Query `canonical_articles` for articles from past 30 days
   - Score and rank by relevance (`ORDER BY score DESC`)
   - Select top 20-30 articles
   - Group by category (required — produces `byCategory` map)
   - Format as monthly JSON
   - Output: `monthly-data.json` structure (see spec)

2. **Configure workflow steps in n8n**
   - Data Table Query: `SELECT * FROM canonical_articles WHERE addedAt >= NOW() - INTERVAL 30 DAY ORDER BY score DESC LIMIT 30`
   - Transform: Build `byCategory` map (category name to article subset)
   - Generate metadata (month `YYYY-MM`, date range, `generatedAt`)
   - Test with sample data

3. **Verify workflow executes**
   - Manual trigger in n8n UI
   - Check logs for errors
   - Verify output shape matches schema (including `byCategory`)

4. **Commit**
   ```bash
   git add -A  # If any workflow export files
   git commit -m "feat(M5-B1): Create monthly aggregation workflow

   - Query canonical_articles from past 30 days
   - Rank by score (top 30)
   - Group by category (byCategory map)
   - Export monthly-data.json structure

   Ready for B2 (export) and B3 (QA News display)"
   ```

### Task B2: Export Monthly JSON

**Model:** Haiku
**Files:** n8n workflow: `export-monthly` (extension of `aggregate-monthly`)

**Steps:**

1. **Extend `aggregate-monthly` workflow with export step**
   - After Transform: Add File Write node
   - Path: `${EXPORT_FILE_PATH}/../../public/monthly-data.json` (or full path)
   - Content: formatted monthly JSON (including `byCategory`)
   - Add timestamp to cache-bust browsers

2. **Verify file is written**
   ```bash
   ls -lh qa-news/public/monthly-data.json
   cat qa-news/public/monthly-data.json | jq . | head -40
   ```
   Expected: File exists, valid JSON, `byCategory` present

3. **Test end-to-end**
   - Trigger workflow manually
   - Verify file updated with new timestamp
   - Verify JSON is parseable and `byCategory` keys map to article subsets

4. **Commit**
   ```bash
   git add qa-news/public/monthly-data.json
   git commit -m "feat(M5-B2): Export monthly JSON for QA News

   - Workflow writes monthly-data.json to qa-news/public/
   - Includes metadata (month, dates, generatedAt) and byCategory
   - Cache-busting timestamp on each export

   QA News can now consume this data in B3"
   ```

### Task B3: Monthly Page in QA News

**Model:** Sonnet
**Files:** `qa-news/src/app/monthly/page.tsx`, `qa-news/src/lib/data.ts`

**Steps:**

1. **Add `getMonthlyRecap()` to `lib/data.ts`**
   ```typescript
   export async function getMonthlyRecap() {
     const raw = await fs.readFile(
       path.join(process.cwd(), 'public/monthly-data.json'),
       'utf-8'
     );
     return JSON.parse(raw);
   }
   ```

2. **Create `qa-news/src/app/monthly/page.tsx`**
   ```typescript
   import { getMonthlyRecap } from '@/lib/data';

   export default async function MonthlyPage() {
     const monthly = await getMonthlyRecap();

     return (
       <div className="container mx-auto">
         <h1>Monthly Recap</h1>
         <p>{monthly.monthStart} to {monthly.monthEnd}</p>

         {Object.entries(monthly.byCategory).map(([category, articles]) => (
           <section key={category}>
             <h2>{category}</h2>
             <div className="articles">
               {(articles as any[]).map((article) => (
                 <PipelineEntry key={article.id} article={article} />
               ))}
             </div>
           </section>
         ))}
       </div>
     );
   }
   ```

3. **Style to match Daily/Latest/Weekly pages** (reuse existing `PipelineEntry` component; render category sections)

4. **Test build**
   ```bash
   npm run build
   # Should complete with 0 errors, include /monthly page
   ```

5. **Commit**
   ```bash
   git add qa-news/src/app/monthly/page.tsx qa-news/src/lib/data.ts
   git commit -m "feat(M5-B3): Build Monthly Recap page in QA News

   - New /monthly route displays monthly aggregated articles
   - Loads monthly-data.json at build time
   - Renders articles grouped by category (byCategory)
   - Uses PipelineEntry component for consistent styling
   - Builds successfully with npm run build"
   ```

### Task B4: Test Monthly Aggregation

**Model:** Haiku
**Files:** `qa-news/tests/monthly.test.ts` (new tests)

**Steps:**

1. **Test: Articles are ranked by score**
   - Verify `articles` sorted descending by score
   - Verify first article has the highest score

2. **Test: Category grouping is correct**
   - Verify every article in each `byCategory` list belongs to that category
   - Verify `byCategory` articles are a subset of top-level `articles`

3. **Test: JSON schema matches spec**
   - Verify required keys present: `month`, `monthStart`, `monthEnd`, `articles[]`, `byCategory`, `generatedAt`

4. **Test: QA News build succeeds with monthly data**
   ```bash
   npm run build
   # Expected: 0 errors, /monthly page generated
   ```

5. **Commit**
   ```bash
   git add qa-news/tests/monthly.test.ts
   git commit -m "test(M5-B4): Add monthly aggregation tests

   - Articles ranked by score (DESC)
   - Category grouping validated (byCategory subset)
   - JSON schema validation
   - QA News build succeeds

   All tests passing"
   ```

---

## Execution

- Run Track A and Track B in parallel via superpowers:subagent-driven-development
- Each agent owns its task sequence (A1 to A4, B1 to B4)
- Model assignments as specified in the spec (Haiku for workflows/exports/tests, Sonnet for pages)
- Final code review after both tracks complete; user pushes to remote
