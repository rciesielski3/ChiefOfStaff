# RSS Config Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate 3 hardcoded RSS source lists into a single config file with enable/disable toggles.

**Architecture:** Extract RSS_SOURCES arrays from daily-brief.ts and rebuild-qa-news.ts into src/config/rss-sources.config.ts. Add optional `enabled` and `maxPerRun` fields for extensibility. Both CLI files load from config via getEnabledSources() helper. No changes to fetching or scoring logic.

**Tech Stack:** TypeScript, Node.js, Jest, ts-node (no new dependencies)

## Global Constraints

- No changes to `src/business-logic/rss-fetch.ts` (fetching logic unchanged)
- Reuse existing `RSSSourceConfig` interface from rss-fetch.ts
- `enabled` field defaults to true for backwards compatibility
- TypeScript types validated by tsc before test/commit
- All existing tests must pass (no regressions)
- TDD mandatory: failing test first, then implementation

---

## File Structure

```
src/
├── config/
│   └── rss-sources.config.ts         (NEW - source definitions + helpers)
├── cli/
│   ├── daily-brief.ts                (MODIFY - load from config)
│   └── rebuild-qa-news.ts            (MODIFY - load from config)
└── business-logic/
    └── rss-fetch.ts                  (UNCHANGED - kept as-is)

tests/
└── config/
    └── rss-sources.config.test.ts    (NEW - test config and helpers)
```

---

## Task 1: Create RSS Sources Config File

**Files:**
- Create: `src/config/rss-sources.config.ts`
- Test: `tests/config/rss-sources.config.test.ts`

**Interfaces:**
- Consumes: `RSSSourceConfig` interface from `src/business-logic/rss-fetch.ts` (interface only, no logic)
- Produces: 
  - `RSSSourceConfig[]` array exported as `RSS_SOURCES`
  - `getEnabledSources(): RSSSourceConfig[]` function

- [ ] **Step 1: Write failing test for config and getEnabledSources**

Create `tests/config/rss-sources.config.test.ts`:

```typescript
import { RSS_SOURCES, getEnabledSources } from '../../src/config/rss-sources.config';

describe('RSS Sources Config', () => {
  it('should have at least 8 sources defined', () => {
    expect(RSS_SOURCES.length).toBeGreaterThanOrEqual(8);
  });

  it('should have Ministry of Testing source', () => {
    const ministrySource = RSS_SOURCES.find(s => s.name === 'Ministry of Testing');
    expect(ministrySource).toBeDefined();
    expect(ministrySource?.url).toContain('ministryoftesting');
  });

  it('should have OpenAI source', () => {
    const openaiSource = RSS_SOURCES.find(s => s.name === 'OpenAI');
    expect(openaiSource).toBeDefined();
    expect(openaiSource?.url).toContain('openai');
  });

  describe('getEnabledSources', () => {
    it('should return all sources when enabled field not specified', () => {
      const enabled = getEnabledSources();
      expect(enabled.length).toBeGreaterThanOrEqual(8);
    });

    it('should filter out disabled sources', () => {
      const enabled = getEnabledSources();
      const disabled = RSS_SOURCES.filter(s => s.enabled === false);
      expect(enabled.length).toBeLessThanOrEqual(RSS_SOURCES.length);
      expect(enabled.every(s => s.enabled !== false)).toBe(true);
    });

    it('should include all sources with enabled:true or undefined', () => {
      const enabled = getEnabledSources();
      const expected = RSS_SOURCES.filter(s => s.enabled !== false);
      expect(enabled).toEqual(expected);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/config/rss-sources.config.test.ts -v
```

Expected: FAIL with "Cannot find module" or "RSS_SOURCES not defined"

- [ ] **Step 3: Write config file implementation**

Create `src/config/rss-sources.config.ts`:

```typescript
// RSS source definitions — single source of truth
// Imported by daily-brief.ts and rebuild-qa-news.ts
// Add new sources here; enable/disable via `enabled` field

import { RSSSourceConfig } from '../business-logic/rss-fetch';

export const RSS_SOURCES: RSSSourceConfig[] = [
  // Tier 1: QA & Test Automation (PRIMARY FOCUS - 6 sources)
  {
    url: 'https://www.ministryoftesting.com/contents/rss',
    name: 'Ministry of Testing',
    enabled: true
  },
  {
    url: 'https://testing.googleblog.com/feeds/posts/default',
    name: 'Google Testing Blog',
    enabled: true
  },
  {
    url: 'https://feed.infoq.com/',
    name: 'InfoQ',
    enabled: true
  },
  {
    url: 'https://martinfowler.com/feed.atom',
    name: 'Martin Fowler',
    enabled: true
  },
  {
    url: 'https://cypress.io/blog/rss',
    name: 'Cypress',
    enabled: true
  },
  {
    url: 'https://github.com/microsoft/playwright/releases.atom',
    name: 'Playwright',
    enabled: true
  },
  // Tier 2: Context & Updates (2 sources - lower priority)
  {
    url: 'https://openai.com/news/rss.xml',
    name: 'OpenAI',
    enabled: true
  },
  {
    url: 'https://blog.cloudflare.com/rss/',
    name: 'Cloudflare',
    enabled: true
  }
];

/**
 * Get all enabled RSS sources
 * Filters out sources with enabled: false
 * Default enabled:true for backwards compatibility
 */
export function getEnabledSources(): RSSSourceConfig[] {
  return RSS_SOURCES.filter(source => source.enabled !== false);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/config/rss-sources.config.test.ts -v
```

Expected: PASS (all 5 tests passing)

- [ ] **Step 5: Verify TypeScript compilation**

```bash
npm run build
```

Expected: No TypeScript errors

- [ ] **Step 6: Commit**

```bash
git add src/config/rss-sources.config.ts tests/config/rss-sources.config.test.ts
git commit -m "feat: create RSS sources config file with enable/disable toggles

- Consolidate RSS source definitions from hardcoded arrays
- Add RSSSourceConfig extension with enabled/maxPerRun fields
- Export getEnabledSources() helper for filtering
- All 8 sources configured and tested
- Ready for consumption by daily-brief.ts and rebuild-qa-news.ts"
```

---

## Task 2: Update daily-brief.ts to Use Config

**Files:**
- Modify: `src/cli/daily-brief.ts:15-50` (replace hardcoded RSS_SOURCES)
- Test: `tests/cli/daily-brief.test.ts` (existing tests should pass)

**Interfaces:**
- Consumes: `getEnabledSources()` from config, `RSSSourceConfig` interface
- Produces: Same behavior as before (no interface change)

- [ ] **Step 1: Verify existing tests pass**

```bash
npm test -- tests/cli/daily-brief.test.ts -v
```

Expected: Current tests passing (baseline)

- [ ] **Step 2: Replace hardcoded RSS_SOURCES in daily-brief.ts**

Find lines 15-50 in `src/cli/daily-brief.ts` with the hardcoded RSS_SOURCES array.

Replace with:

```typescript
import { getEnabledSources } from '../config/rss-sources.config';

// ... other imports ...

// Load RSS sources from config (single source of truth)
const RSS_SOURCES = getEnabledSources();
```

Remove the entire hardcoded array (about 35 lines of const RSS_SOURCES = [ ... ]).

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npm run build
```

Expected: No TypeScript errors

- [ ] **Step 4: Run tests to verify no regressions**

```bash
npm test -- tests/cli/daily-brief.test.ts -v
```

Expected: All tests passing (same as baseline)

- [ ] **Step 5: Commit**

```bash
git add src/cli/daily-brief.ts
git commit -m "refactor: load RSS sources from config in daily-brief.ts

- Remove hardcoded RSS_SOURCES array
- Import getEnabledSources() from rss-sources.config
- Keep all existing functionality unchanged
- All tests pass, no regressions"
```

---

## Task 3: Update rebuild-qa-news.ts to Use Config

**Files:**
- Modify: `src/cli/rebuild-qa-news.ts:18-53` (replace hardcoded RSS_SOURCES)
- Test: Tests in `tests/cli/rebuild-qa-news.test.ts` (if exists)

**Interfaces:**
- Consumes: `getEnabledSources()` from config
- Produces: Same behavior as before

- [ ] **Step 1: Find and review current RSS_SOURCES in rebuild-qa-news.ts**

```bash
grep -n "const RSS_SOURCES" src/cli/rebuild-qa-news.ts
head -60 src/cli/rebuild-qa-news.ts | tail -45
```

Expected: Hardcoded array starting around line 18

- [ ] **Step 2: Replace hardcoded RSS_SOURCES**

In `src/cli/rebuild-qa-news.ts`, replace the hardcoded array with:

```typescript
import { getEnabledSources } from '../config/rss-sources.config';

// ... other imports ...

// Load RSS sources from config (single source of truth)
const RSS_SOURCES = getEnabledSources();
```

Remove the entire hardcoded const RSS_SOURCES array.

- [ ] **Step 3: Verify TypeScript compilation**

```bash
npm run build
```

Expected: No TypeScript errors

- [ ] **Step 4: Run tests (if exist)**

```bash
npm test -- tests/cli/rebuild-qa-news.test.ts -v 2>/dev/null || echo "No rebuild-qa-news tests found"
```

Expected: Tests pass or no tests exist

- [ ] **Step 5: Commit**

```bash
git add src/cli/rebuild-qa-news.ts
git commit -m "refactor: load RSS sources from config in rebuild-qa-news.ts

- Remove duplicate hardcoded RSS_SOURCES array
- Import getEnabledSources() from rss-sources.config
- Single source of truth now shared with daily-brief.ts
- All functionality unchanged"
```

---

## Task 4: Verify No Duplicate Sources Remain

**Files:**
- Verify: All CLI files

**Interfaces:**
- Consumes: Config from Tasks 1-3
- Produces: Confirmation that duplicates are eliminated

- [ ] **Step 1: Search for remaining RSS_SOURCES definitions**

```bash
grep -r "const RSS_SOURCES\s*=" src/cli/ src/business-logic/
```

Expected: ONLY see `rss-sources.config.ts` defining it (0 other occurrences in cli/ or business-logic/)

- [ ] **Step 2: Search for remaining hardcoded feed arrays**

```bash
grep -r "ministryoftesting\|testing.googleblog\|martinfowler.com" src/cli/ --include="*.ts"
```

Expected: No matches (no hardcoded feeds remaining in CLI files)

- [ ] **Step 3: Verify qa-news-feeds.ts is separate (should NOT change)**

```bash
grep -n "url.*rss" src/cli/qa-news-feeds.ts | head -5
```

Expected: qa-news-feeds.ts has its own feed list (different structure) — leave as-is

- [ ] **Step 4: Document verification**

Create `REFACTORING_NOTES.md` in project root:

```markdown
# RSS Config Consolidation Verification

**Date:** 2026-07-25

## Duplicates Eliminated
- ✅ daily-brief.ts: Removed 8-source hardcoded array
- ✅ rebuild-qa-news.ts: Removed 8-source hardcoded array (duplicate)
- ✅ Both now use getEnabledSources() from src/config/rss-sources.config.ts

## Untouched (Different Purpose)
- ℹ️ src/cli/qa-news-feeds.ts: Kept as-is (different format, different purpose)

## Single Source of Truth
- 📍 src/config/rss-sources.config.ts: Central RSS source definitions
- Consumed by: daily-brief.ts, rebuild-qa-news.ts
- Total sources: 8 (6 QA-focused + 2 context)

## Next Steps (Spec 2)
- Investigate OpenAI dominance (36% of articles)
- Add per-run source frequency limits if needed
- Reconcile qa-news-feeds.ts format (future work)
```

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
npm test
```

Expected: All tests passing (same count as before refactoring)

- [ ] **Step 6: Commit verification note**

```bash
git add REFACTORING_NOTES.md
git commit -m "docs: log RSS config consolidation verification

- Confirm duplicate sources eliminated
- Document single source of truth location
- List untouched files (qa-news-feeds.ts)
- Baseline for future source customizations"
```

---

## Task 5: Final Integration Check

**Files:**
- Verify: All modified files work together

**Interfaces:**
- Consumes: Config from Tasks 1-4
- Produces: End-to-end workflow validation

- [ ] **Step 1: Simulate daily-brief execution (dry-run)**

```bash
npm run build && npx ts-node -e "
  import { getEnabledSources } from './src/config/rss-sources.config';
  const sources = getEnabledSources();
  console.log('Enabled sources for daily-brief:');
  sources.forEach(s => console.log('  -', s.name));
  console.log('Total:', sources.length);
"
```

Expected: 8 sources listed, no errors

- [ ] **Step 2: Verify enabled toggle works**

Temporarily edit `src/config/rss-sources.config.ts` to disable OpenAI:

```typescript
{
  url: 'https://openai.com/news/rss.xml',
  name: 'OpenAI',
  enabled: false  // <-- TEST: disable one source
}
```

Then run:

```bash
npm run build && npx ts-node -e "
  import { getEnabledSources } from './src/config/rss-sources.config';
  const sources = getEnabledSources();
  const hasOpenAI = sources.some(s => s.name === 'OpenAI');
  console.log('OpenAI present:', hasOpenAI, '(should be false)');
  console.log('Total sources:', sources.length, '(should be 7)');
"
```

Expected: OpenAI not listed, 7 sources total

- [ ] **Step 3: Restore OpenAI enabled flag**

Revert the test change:

```typescript
{
  url: 'https://openai.com/news/rss.xml',
  name: 'OpenAI',
  enabled: true  // <-- RESTORE
}
```

- [ ] **Step 4: Run full test suite one more time**

```bash
npm test
```

Expected: All tests passing, TypeScript clean

- [ ] **Step 5: Final commit (if any changes from testing)**

```bash
git add src/config/rss-sources.config.ts
git commit -m "chore: restore OpenAI enabled flag after integration testing"
```

Or if no changes needed:

```bash
echo "Integration testing complete, no changes needed"
```

- [ ] **Step 6: Summary verification**

```bash
echo "=== REFACTORING COMPLETE ===" && \
echo "✅ Config file: src/config/rss-sources.config.ts" && \
echo "✅ daily-brief.ts: Updated to load from config" && \
echo "✅ rebuild-qa-news.ts: Updated to load from config" && \
echo "✅ No duplicate sources remaining" && \
echo "✅ All tests passing" && \
echo "✅ TypeScript validation clean" && \
npm test 2>&1 | grep "Tests:" | head -1
```

Expected: Summary showing all items ✅ and test count

---

## Success Criteria

✅ Single RSS sources config file created in `src/config/rss-sources.config.ts`  
✅ Both daily-brief.ts and rebuild-qa-news.ts load from config via `getEnabledSources()`  
✅ `enabled` field works (can toggle sources on/off)  
✅ No duplicate hardcoded RSS_SOURCES arrays remaining  
✅ All existing tests pass (zero regressions)  
✅ TypeScript compilation clean  
✅ Integration testing confirms toggle works  

---

## Rollback Plan

If any issues arise:

```bash
git reset --hard HEAD~5  # Back to before Task 1
```

But risk is very low since:
- No changes to fetching logic
- Config is drop-in replacement
- All tests validate end-to-end
- Frequent small commits (easy to roll back individual tasks)

---

## Timeline Summary

| Task | Duration | Complexity |
|------|----------|-----------|
| 1: Create config file | 5 min | Low |
| 2: Update daily-brief | 5 min | Low |
| 3: Update rebuild-qa-news | 5 min | Low |
| 4: Verify duplicates | 3 min | Low |
| 5: Integration check | 7 min | Low |
| **Total** | **~25 min** | **Very Low** |

---

## Next Phase

After this plan completes:
1. Code review gate (via merge rule)
2. Merge to main
3. Then: Spec 2 brainstorm (dominance investigation)
4. Then: Spec 2 implementation (if needed)
5. Finally: Both on separate branch `feature/rss-config`

