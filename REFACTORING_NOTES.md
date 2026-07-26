# RSS Config Consolidation Refactoring Notes

**Date:** 2026-07-25  
**Status:** ✅ COMPLETE

## Summary

The RSS source definitions have been consolidated from three separate hardcoded arrays into a single centralized configuration file. This eliminates duplication and establishes a single source of truth for all RSS feed URLs used by the application.

## What Was Consolidated

### Before (Tasks 1-3)
- **daily-brief.ts:** 8 hardcoded RSS sources (Ministry of Testing, Google Testing Blog, InfoQ, Martin Fowler, Cypress, Playwright, OpenAI, Cloudflare)
- **rebuild-qa-news.ts:** 8 hardcoded RSS sources (identical to daily-brief.ts)
- **qa-news-feeds.ts:** 2 separate hardcoded sources (OpenAI, Lobsters) — kept intentionally separate due to different format/purpose

### After (Tasks 1-3 + Task 4)
- **Single source of truth:** `src/config/rss-sources.config.ts`
  - Defines `RSS_SOURCES: RSSSourceConfig[]` with all 8 consolidated feeds
  - Exports `getEnabledSources()` function for retrieving active sources
  
- **Updated CLI files:**
  - `src/cli/daily-brief.ts`: Now imports `getEnabledSources` from config
  - `src/cli/rebuild-qa-news.ts`: Now imports `getEnabledSources` from config

## Duplicates Eliminated

| File | Duplicates | Status |
|------|-----------|--------|
| daily-brief.ts | 8 hardcoded sources | ✅ Removed (now uses `getEnabledSources()`) |
| rebuild-qa-news.ts | 8 hardcoded sources | ✅ Removed (now uses `getEnabledSources()`) |
| **Total duplicates eliminated** | **16 source definitions** | **✅ DONE** |

## Files Intentionally NOT Changed

- **qa-news-feeds.ts:** Kept unchanged — contains 2 separate feeds (OpenAI, Lobsters) with different structure/purpose than the main RSS sources. This is a separate concern and should not be consolidated with the general application feeds.

## Single Source of Truth

**File:** `src/config/rss-sources.config.ts`

**Contents:**
```typescript
export const RSS_SOURCES: RSSSourceConfig[] = [
  { name: 'Ministry of Testing', url: 'https://www.ministryoftesting.com/contents/rss' },
  { name: 'Google Testing Blog', url: 'https://testing.googleblog.com/feeds/posts/default' },
  { name: 'InfoQ', url: 'https://feed.infoq.com/' },
  { name: 'Martin Fowler', url: 'https://martinfowler.com/feed.atom' },
  { name: 'Cypress', url: 'https://cypress.io/blog/rss' },
  { name: 'Playwright', url: 'https://github.com/microsoft/playwright/releases.atom' },
  { name: 'OpenAI', url: 'https://openai.com/news/rss.xml' },
  { name: 'Cloudflare', url: 'https://blog.cloudflare.com/rss/' },
];

export function getEnabledSources(): RSSSourceConfig[] {
  return RSS_SOURCES.filter(source => (source as any).enabled !== false);
}
```

**Usage Pattern:**
```typescript
import { getEnabledSources } from '../config/rss-sources.config';
const RSS_SOURCES = getEnabledSources();
```

## Verification Checklist

- ✅ No duplicate `RSS_SOURCES` definitions remain in CLI/business-logic folders
- ✅ No hardcoded ministry/martin fowler/googleblog URLs in CLI files (verified via grep)
- ✅ qa-news-feeds.ts remains separate and unchanged (different purpose)
- ✅ Config file is the single source of truth for main application feeds
- ✅ All tests pass (no regressions introduced)

## Next Steps

**Spec 2: Dominance Investigation**

With consolidation complete (Spec 1), the next phase is to investigate feed dominance:
- Analyze which sources contribute the most articles to the daily brief
- Identify sources with low signal (articles that don't score high)
- Evaluate coverage gaps
- Recommend any source additions or removals

This dominance analysis will inform decisions about feed curation for Phase 2.

## Git History

- **Task 1:** `0cd7203` — Create central RSS config
- **Task 2:** `3efdd35` — Refactor config types
- **Task 3:** `c2c3297` & `c600afe` — Use config in daily-brief.ts and rebuild-qa-news.ts
- **Task 4:** This file created as verification of complete consolidation

---

**Consolidation Status:** ✅ COMPLETE — Ready for Spec 2 (Dominance Investigation)
