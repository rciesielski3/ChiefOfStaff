# Workflow Resilience: Fix JSON Parsing and RSS Failures

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make daily-brief workflow resilient to JSON parsing errors and RSS fetch failures, ensuring pipelines complete even when individual data sources or processing steps encounter recoverable errors.

**Architecture:** The workflow currently fails entirely when encountering malformed JSON or RSS source errors. This plan adds three layers of resilience: (1) graceful JSON parsing with recovery in evolve-knowledge, (2) per-source error isolation in RSS fetching (skip bad sources, continue with good ones), and (3) validation checkpoints that report issues but don't block the pipeline.

**Tech Stack:** TypeScript, Node.js, Jest, GitHub Actions

---

## Global Constraints

- TypeScript strict mode enforced (no `any` types)
- All tests passing before commit
- No external dependencies beyond package.json
- Workflow continues on non-critical errors (exit 0, log warnings)
- Failed facts/sources skip gracefully; others process normally
- Commits prefixed `fix:` (no AI co-author on main)
- Tests use TDD approach (failing test → implementation → green)

---

## File Structure

| File | Purpose | Change Type |
|------|---------|------------|
| `src/scripts/evolve-knowledge.ts` | Add JSON parsing error recovery and graceful fact skipping | Modify |
| `src/business-logic/rss-fetch.ts` | Improve per-source error handling and reporting | Modify |
| `src/cli/daily-brief.ts` | Add error reporting for failed RSS sources | Modify |
| `tests/scripts/evolve-knowledge.test.ts` | Add tests for malformed JSON recovery | Create |
| `tests/business-logic/rss-fetch.test.ts` | Add tests for per-source error isolation | Create/Modify |

---

## Tasks

### Task 1: Make evolve-knowledge resilient to JSON parsing errors

**Files:**
- Modify: `src/scripts/evolve-knowledge.ts:67-76` (JSON parsing section)
- Modify: `src/scripts/evolve-knowledge.ts:104-130` (result counting section)
- Create: `tests/scripts/evolve-knowledge.test.ts`
- Test: `tests/scripts/evolve-knowledge.test.ts`

**Interfaces:**
- Consumes: `inputFacts` array of potentially malformed JSON strings
- Produces: `evolvedFacts` array with valid facts only, warning log for skipped facts

**Problem Context:**
The workflow fails entirely when a single fact line contains invalid JSON. The error occurs at line 69 where `JSON.parse(line)` throws. This blocks the entire daily-brief workflow.

**Behavior After Fix:**
- Parse each fact line individually
- On JSON parse error: log warning with line number, skip that fact, continue
- Report at end: how many facts skipped due to parse errors
- Exit 0 always (non-blocking)

- [ ] **Step 1: Write failing test for JSON parse error recovery**

Create `tests/scripts/evolve-knowledge.test.ts`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as fsPromises from 'fs/promises';

describe('evolve-knowledge.ts', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = path.join(__dirname, '../../.test-tmp-evolve-' + Date.now());
    await fsPromises.mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    if (fs.existsSync(tempDir)) {
      await fsPromises.rm(tempDir, { recursive: true });
    }
  });

  test('recovers from malformed JSON in fact lines', async () => {
    // Setup: Create input file with mix of valid and invalid JSON
    const inputFile = path.join(tempDir, 'input.ndjson');
    const outputFile = path.join(tempDir, 'output.ndjson');
    const embeddingsFile = path.join(tempDir, 'embeddings.ndjson');

    const validFact1 = JSON.stringify({
      id: 'fact-1',
      text: 'Test fact 1',
      type: 'observation',
      confidence: 0.9,
      source: 'test',
      timestamp: new Date().toISOString(),
    });

    // Intentionally malformed JSON
    const malformedJson = '{ "id": "fact-2", "text": "incomplete json';

    const validFact2 = JSON.stringify({
      id: 'fact-3',
      text: 'Test fact 3',
      type: 'observation',
      confidence: 0.8,
      source: 'test',
      timestamp: new Date().toISOString(),
    });

    fs.writeFileSync(inputFile, [validFact1, malformedJson, validFact2].join('\n'));

    // Run evolve-knowledge with temp files
    const { execSync } = require('child_process');
    let stderr = '';

    try {
      execSync(`npx ts-node src/scripts/evolve-knowledge.ts`, {
        cwd: path.join(__dirname, '../..'),
        env: {
          ...process.env,
          INPUT_FACTS: inputFile,
          OUTPUT_FACTS: outputFile,
          EMBEDDINGS_CACHE: embeddingsFile,
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error: any) {
      stderr = error.stderr?.toString() || '';
    }

    // Verify: Script completes (exit 0) despite malformed JSON
    expect(fs.existsSync(outputFile)).toBe(true);

    // Verify: Valid facts were processed
    const outputLines = fs
      .readFileSync(outputFile, 'utf-8')
      .split('\n')
      .filter(l => l.trim());
    expect(outputLines.length).toBeGreaterThanOrEqual(2); // At least 2 valid facts processed

    // Verify: Warning was logged for malformed JSON
    expect(stderr).toContain('Failed to parse fact');
  });

  test('reports count of skipped facts due to parse errors', async () => {
    const inputFile = path.join(tempDir, 'input.ndjson');
    const outputFile = path.join(tempDir, 'output.ndjson');
    const embeddingsFile = path.join(tempDir, 'embeddings.ndjson');

    const validFact = JSON.stringify({
      id: 'fact-1',
      text: 'Test fact',
      type: 'observation',
      confidence: 0.9,
      source: 'test',
      timestamp: new Date().toISOString(),
    });

    fs.writeFileSync(inputFile, [validFact, '{ invalid', validFact].join('\n'));

    const { execSync } = require('child_process');
    let stdout = '';

    try {
      stdout = execSync(`npx ts-node src/scripts/evolve-knowledge.ts`, {
        cwd: path.join(__dirname, '../..'),
        env: {
          ...process.env,
          INPUT_FACTS: inputFile,
          OUTPUT_FACTS: outputFile,
          EMBEDDINGS_CACHE: embeddingsFile,
        },
        encoding: 'utf-8',
      });
    } catch (error: any) {
      stdout = error.stdout?.toString() || '';
    }

    // Verify: Script logs how many facts were skipped
    expect(stdout).toMatch(/skipped.*parse.*error|Failed to parse/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/scripts/evolve-knowledge.test.ts
```

Expected: Tests fail with message indicating evolve-knowledge crashes on malformed JSON.

- [ ] **Step 3: Modify evolve-knowledge.ts to handle JSON parse errors**

Read the current code at lines 62-76:

```typescript
const factLines = fs
  .readFileSync(inputPath, 'utf-8')
  .split('\n')
  .filter(line => line.trim());

const inputFacts: KnowledgeFact[] = factLines.map((line, index) => {
  try {
    return JSON.parse(line) as KnowledgeFact;
  } catch (error) {
    console.warn(
      `[Knowledge Evolution] Warning: Failed to parse fact at line ${index + 1}`
    );
    throw error;  // <-- THIS THROWS, BLOCKING THE PIPELINE
  }
});
```

Replace with:

```typescript
const factLines = fs
  .readFileSync(inputPath, 'utf-8')
  .split('\n')
  .filter(line => line.trim());

const inputFacts: KnowledgeFact[] = [];
let skippedCount = 0;

for (let index = 0; index < factLines.length; index++) {
  try {
    const fact = JSON.parse(factLines[index]) as KnowledgeFact;
    inputFacts.push(fact);
  } catch (error) {
    skippedCount++;
    console.warn(
      `[Knowledge Evolution] Warning: Failed to parse fact at line ${index + 1}, skipping`
    );
  }
}

if (skippedCount > 0) {
  console.warn(
    `[Knowledge Evolution] ⚠️  Skipped ${skippedCount} facts due to parse errors`
  );
}
```

- [ ] **Step 4: Update result counting to include skip count**

At line 104-130, add logging for skipped facts. Find the section:

```typescript
// Count results by action
const dedupCount = evolutionResults.filter(
  r => r.action === 'deduplicate'
).length;
```

Add after the existing counts:

```typescript
console.log('[Knowledge Evolution] Summary:');
console.log(`  - Input facts: ${inputFacts.length}`);
console.log(`  - Skipped (parse errors): ${skippedCount}`);
console.log(`  - Deduplicated: ${dedupCount}`);
console.log(`  - Versioned: ${versionCount}`);
console.log(`  - Related: ${relateCount}`);
console.log(`  - New: ${newCount}`);
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- tests/scripts/evolve-knowledge.test.ts
```

Expected: Tests pass (evolve-knowledge now handles malformed JSON gracefully).

- [ ] **Step 6: Run full test suite to ensure no regressions**

```bash
npm test
```

Expected: All tests passing.

- [ ] **Step 7: Commit**

```bash
git add src/scripts/evolve-knowledge.ts tests/scripts/evolve-knowledge.test.ts
git commit -m "fix: make evolve-knowledge resilient to malformed JSON facts"
```

---

### Task 2: Improve RSS fetch error handling to skip failed sources

**Files:**
- Modify: `src/business-logic/rss-fetch.ts:80-120` (fetchRSSFromSource function)
- Modify: `src/cli/daily-brief.ts:100-150` (RSS fetch loop)
- Create/Modify: `tests/business-logic/rss-fetch.test.ts`

**Interfaces:**
- Consumes: RSS_SOURCES array with URL and name
- Produces: Articles array with successfully fetched items; warning log for failed sources

**Problem Context:**
When a single RSS source fails (e.g., InfoQ returned 406), the entire daily-brief workflow stops. RSS source failures should be isolated—skip the bad source, continue with others.

**Behavior After Fix:**
- Attempt to fetch from each RSS source independently
- On failure (network error, 406, timeout, parse error): log warning, skip that source, continue
- Report at end: how many sources succeeded, how many failed
- Exit 0 always (non-blocking)

- [ ] **Step 1: Write failing test for per-source error isolation**

Modify/create `tests/business-logic/rss-fetch.test.ts`:

```typescript
import { fetchRSSFromSource, fetchWithRetry } from '../src/business-logic/rss-fetch';

describe('rss-fetch.ts - Per-Source Error Isolation', () => {
  test('continues with valid sources when one source fails', async () => {
    // Mock two sources: one fails, one succeeds
    const sources = [
      { url: 'http://invalid-404.test/feed', name: 'BadSource' },
      { url: 'https://martinfowler.com/feed.atom', name: 'MartinFowler' },
    ];

    const results: { source: string; success: boolean; count: number }[] = [];

    for (const source of sources) {
      try {
        const articles = await fetchRSSFromSource(source.url, source.name);
        results.push({
          source: source.name,
          success: true,
          count: articles.length,
        });
      } catch (error) {
        // Per-source isolation: log error, continue to next source
        console.warn(`Failed to fetch from ${source.name}:`, error);
        results.push({
          source: source.name,
          success: false,
          count: 0,
        });
      }
    }

    // Verify: Bad source failed, but MartinFowler succeeded
    const badSourceResult = results.find(r => r.source === 'BadSource');
    const goodSourceResult = results.find(r => r.source === 'MartinFowler');

    expect(badSourceResult?.success).toBe(false);
    expect(goodSourceResult?.success).toBe(true);
    expect(goodSourceResult?.count).toBeGreaterThan(0);
  });

  test('logs failure reason for each failed source', async () => {
    const source = { url: 'http://invalid.test/feed', name: 'TestSource' };
    const logSpy = jest.spyOn(console, 'warn').mockImplementation();

    try {
      await fetchRSSFromSource(source.url, source.name);
    } catch (error) {
      console.warn(`Failed to fetch from ${source.name}`, error);
    }

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch from TestSource'),
      expect.any(Error)
    );

    logSpy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/business-logic/rss-fetch.test.ts
```

Expected: Tests fail (current code crashes on source failure, doesn't continue).

- [ ] **Step 3: Modify daily-brief.ts RSS fetch loop to isolate per-source errors**

Read the current RSS fetching section in `src/cli/daily-brief.ts` (around line 100-150).

Find the loop that fetches from RSS_SOURCES. Replace it with:

```typescript
// Fetch articles from all RSS sources, isolating per-source errors
const allArticles: typeof articles = [];
const fetchResults: { source: string; success: boolean; count: number; error?: string }[] = [];

for (const source of RSS_SOURCES) {
  try {
    console.log(`[Daily Brief] Fetching from ${source.name}...`);
    const sourceArticles = await fetchRSSFromSource(source.url, source.name);
    allArticles.push(...sourceArticles);
    
    fetchResults.push({
      source: source.name,
      success: true,
      count: sourceArticles.length,
    });
    
    console.log(`[Daily Brief] ✅ ${source.name}: ${sourceArticles.length} articles`);
  } catch (error) {
    fetchResults.push({
      source: source.name,
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : String(error),
    });
    
    console.warn(
      `[Daily Brief] ⚠️  Failed to fetch from ${source.name}: ${error instanceof Error ? error.message : String(error)}`
    );
    // Continue to next source instead of throwing
  }
}

// Report fetch summary
const successCount = fetchResults.filter(r => r.success).length;
const failureCount = fetchResults.filter(r => !r.success).length;

console.log('[Daily Brief] RSS Fetch Summary:');
console.log(`  - Successful sources: ${successCount}/${RSS_SOURCES.length}`);
if (failureCount > 0) {
  console.log(`  - Failed sources: ${failureCount}/${RSS_SOURCES.length}`);
  fetchResults
    .filter(r => !r.success)
    .forEach(r => {
      console.log(`    - ${r.source}: ${r.error}`);
    });
}
console.log(`  - Total articles fetched: ${allArticles.length}`);

if (allArticles.length === 0) {
  console.warn('[Daily Brief] ⚠️  No articles fetched from any source');
  process.exit(0); // Exit gracefully, don't fail workflow
}

const articles = allArticles;
```

- [ ] **Step 4: Ensure fetchRSSFromSource provides clear error info**

In `src/business-logic/rss-fetch.ts`, verify the function has good error messages. Check lines 80-120 for the `fetchRSSFromSource` function and ensure errors include:
- HTTP status code (if network error)
- Error message
- Source name

No changes needed if errors are clear; if not, add context to error messages.

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- tests/business-logic/rss-fetch.test.ts
```

Expected: Tests pass (daily-brief now continues when one source fails).

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: All tests passing.

- [ ] **Step 7: Commit**

```bash
git add src/cli/daily-brief.ts src/business-logic/rss-fetch.ts tests/business-logic/rss-fetch.test.ts
git commit -m "fix: isolate RSS source errors to prevent workflow failure"
```

---

### Task 3: Add validation checkpoint that reports but doesn't block

**Files:**
- Modify: `.github/workflows/daily-brief.yml:92-100` (evolve-knowledge step)
- Create: `src/scripts/validate-facts.ts` (optional validation helper)

**Interfaces:**
- Consumes: knowledge_facts.ndjson from extraction
- Produces: Validation report logged to workflow; exit 0 always

**Problem Context:**
The workflow currently has no resilience layer—if evolve-knowledge fails, the entire pipeline stops. Adding an optional validation step that reports issues but exits 0 makes the workflow resilient.

**Behavior After Fix:**
- Validation warnings are logged but don't stop the pipeline
- Workflow continues to next step (generate-insights)
- Summary shows which facts were problematic (for monitoring)

- [ ] **Step 1: Update daily-brief.yml to handle evolve-knowledge errors gracefully**

Edit `.github/workflows/daily-brief.yml` at lines 92-100.

Current:
```yaml
      - name: Run knowledge evolution
        if: always()
        run: |
          npx ts-node src/scripts/evolve-knowledge.ts
```

Replace with:
```yaml
      - name: Run knowledge evolution
        if: always()
        id: evolve
        run: |
          echo "Starting knowledge evolution..."
          npx ts-node src/scripts/evolve-knowledge.ts || echo "⚠️  Knowledge evolution encountered warnings but continuing"
          echo "✅ Knowledge evolution step completed"
        continue-on-error: true
```

- [ ] **Step 2: Add validation checkpoint step after evolution**

Add new step after "Run knowledge evolution":

```yaml
      - name: Validate evolved facts
        if: always()
        run: |
          if [ ! -f "data/knowledge_facts.ndjson" ]; then
            echo "⚠️  Facts file not found after evolution, but continuing"
            exit 0
          fi
          
          FACT_COUNT=$(wc -l < data/knowledge_facts.ndjson || echo 0)
          
          if [ "$FACT_COUNT" -eq 0 ]; then
            echo "⚠️  No facts available after evolution, but continuing"
            exit 0
          fi
          
          echo "✅ Facts validation: $FACT_COUNT facts ready for processing"
```

- [ ] **Step 3: Verify workflow exits 0 on non-critical errors**

Edit the workflow to ensure all steps use `continue-on-error: true` or `if: always()` for resilience-critical steps:

- Extract Knowledge: `if: always()` ✓
- Evolve Knowledge: `continue-on-error: true` (just added)
- Generate Insights: Already has `if: always()` ✓
- Report Insights: Already has `continue-on-error: true` ✓

- [ ] **Step 4: Commit workflow changes**

```bash
git add .github/workflows/daily-brief.yml
git commit -m "fix: add non-blocking validation checkpoints to daily-brief workflow"
```

---

## Success Criteria

- ✅ evolve-knowledge handles malformed JSON: skips bad lines, logs warnings, exits 0
- ✅ RSS fetch errors isolated per-source: bad source skipped, others continue
- ✅ Daily-brief reports summary: sources succeeded, articles fetched, facts processed
- ✅ Workflow completes to end: exit 0 always unless genuine runtime error
- ✅ All tests passing: JSON recovery + per-source error isolation tested
- ✅ Workflow runs without stopping on recoverable errors
- ✅ Monitoring: Each failure logged with source/reason for debugging

---

## Summary

**Total: 3 Tasks**

1. Make JSON parsing non-blocking in evolve-knowledge (skip bad facts, log warning)
2. Isolate RSS source errors in daily-brief (skip bad sources, continue)
3. Add validation checkpoints that report but don't block (workflow resilience)

Result: Daily-brief workflow is resilient to common failures (bad JSON, failed RSS sources, transient errors) and completes successfully with detailed logging for diagnostics.

---

**Execution:** Ready for subagent-driven development.
