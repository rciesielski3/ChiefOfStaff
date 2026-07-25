# RSS Config Consolidation — Design Spec

**Date:** 2026-07-25  
**Status:** Design Phase  
**Scope:** Consolidate hardcoded RSS sources into single config file  
**Effort:** ~30 minutes  
**Risk:** Very low (no fetching logic changes)

---

## Problem Statement

Current implementation has **3 duplicate RSS source lists** scattered across:
1. `src/cli/daily-brief.ts` — 8 sources (hardcoded array)
2. `src/cli/rebuild-qa-news.ts` — 8 sources (duplicate, hardcoded array)
3. `src/cli/qa-news-feeds.ts` — 12 sources (different format with categories)

**Issues:**
- Sources can't be toggled on/off without code changes
- Duplication creates maintenance burden (update 2+ places for any change)
- No central configuration for source limits or behavior
- No extensibility for future features (weights, frequency limits)

**Goal:** Single source of truth for RSS feeds that both daily-brief and rebuild-qa-news consume.

---

## Solution Architecture

### **New File: `src/config/rss-sources.config.ts`**

```typescript
export interface RSSSourceConfig {
  url: string;
  name: string;
  enabled?: boolean;        // NEW: toggle on/off
  maxPerRun?: number;       // NEW: future use (per-run caps)
}

export const RSS_SOURCES: RSSSourceConfig[] = [
  // Tier 1: QA & Test Automation (primary)
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
  // ... (all 8 sources with enabled flags)
];

export const getEnabledSources = (): RSSSourceConfig[] =>
  RSS_SOURCES.filter(s => s.enabled !== false);
```

**Key Design Decisions:**
- Keep interface simple: reuse existing `RSSSourceConfig` from `rss-fetch.ts`
- Add `enabled` field (default true for backwards compatibility)
- Add `maxPerRun` field (unused now, ready for Spec 2)
- Export helper function `getEnabledSources()` for filtering

### **Modified Files**

#### `src/cli/daily-brief.ts`
**Change:**
```typescript
// BEFORE
const RSS_SOURCES = [ ... 8 sources hardcoded ... ];

// AFTER
import { getEnabledSources } from '../config/rss-sources.config';

const RSS_SOURCES = getEnabledSources();
```

**Impact:** Load sources dynamically, respect `enabled` flags

#### `src/cli/rebuild-qa-news.ts`
**Change:**
```typescript
// BEFORE
const RSS_SOURCES = [ ... 8 sources hardcoded (duplicate) ... ];

// AFTER
import { getEnabledSources } from '../config/rss-sources.config';

const RSS_SOURCES = getEnabledSources();
```

**Impact:** Remove duplicate, use central config

#### `src/cli/qa-news-feeds.ts`
**Status:** Keep as-is (different format, used by different logic)
**Future:** Reconcile with config in follow-up task (out of scope for Spec 1)

---

## Data Flow

```
rss-sources.config.ts (SINGLE SOURCE OF TRUTH)
    ├─ daily-brief.ts (loads enabled sources)
    │   ├─ rss-fetch.ts (fetches articles)
    │   └─ scoring (top-N selection)
    │       └─ canonical_articles.ndjson (10-20 articles)
    │
    └─ rebuild-qa-news.ts (loads enabled sources)
        ├─ rss-fetch.ts (fetches articles)
        └─ selection
            └─ latest.json (50 articles)
```

---

## Operationalizability

**To toggle a source on/off:**
```typescript
// In src/config/rss-sources.config.ts
{
  url: 'https://openai.com/news/rss.xml',
  name: 'OpenAI',
  enabled: false  // <-- Change here, no code deployment needed
}
```

**Non-developer safe:** YAML-adjacent config, one field to change per source

---

## Testing Strategy

**Unit Tests:** 
- `getEnabledSources()` filters disabled sources
- Config file parses without errors
- Both daily-brief and rebuild-qa-news load config successfully

**Integration Tests:**
- Daily-brief fetches from enabled sources only
- rebuild-qa-news fetches from enabled sources only
- Existing scoring/selection logic unchanged (no regressions)

**Verification:**
```bash
npm test -- tests/config/rss-sources.config.test.ts
npm run build  # TypeScript validation
```

---

## Constraints & Assumptions

✅ **No changes to RSS fetching logic** — `rss-fetch.ts` unchanged  
✅ **Backwards compatible** — `enabled` defaults to true  
✅ **No new dependencies** — TypeScript config only  
✅ **Existing pattern** — Follows `src/config/qa-news-categories.json` precedent  

❌ **Out of scope:** Frequency limiting, dominance fix, qa-news-feeds reconciliation (Spec 2)

---

## Success Criteria

- [x] Single RSS source config file created
- [x] Both daily-brief.ts and rebuild-qa-news.ts consume it
- [x] `enabled` toggle works (can disable sources without code)
- [x] All existing tests pass (no regressions)
- [x] No changes to fetching or scoring logic
- [x] Config file ready for extension (maxPerRun field present)

---

## Timeline

| Phase | Duration | Notes |
|-------|----------|-------|
| Implementation | 20 min | Extract hardcoded arrays → config file |
| Testing | 5 min | Run test suite, verify no regressions |
| Code review | 5 min | Per merge gate rule |
| **Total** | **~30 min** | Single PR to main |

---

## Risks & Mitigation

| Risk | Likelihood | Mitigation |
|------|------------|-----------|
| Breaking daily-brief | Low | Keep interface identical; config is drop-in |
| Breaking rebuild-qa-news | Low | Same sources, same interface |
| TypeScript compilation fails | Very low | Config is simple type; IDE will catch errors |
| Stale hardcoded lists still exist | Low | grep for `RSS_SOURCES` in codebase to verify cleanup |

---

## Next Steps

1. **This spec approved** → Write implementation plan (tasks 1-5)
2. **After implementation** → Spec 2 brainstorm/debug (dominance investigation)
3. **All specs approved** → Implementation on separate branch `feature/rss-config`

