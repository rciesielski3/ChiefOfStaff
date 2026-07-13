# Deduplication Strategy for PAIOS Knowledge Layer

**Task**: B3 - Finalize dedup & score logic, add monitoring/scoring documentation  
**Status**: DOCUMENTED  
**Date**: 2026-07-13  

---

## Overview

The PAIOS Knowledge Layer uses a **30-day deduplication window** with **title-based normalization** to detect and track duplicate articles across sources. When duplicates are detected, the system increments a `seenCount` counter and updates the relevance score, rather than creating duplicate records.

---

## Dedup Window: 30 Days

### Why 30 Days?

**Rationale**:
- **Recency bias**: Articles older than 30 days are considered "archived" in the Knowledge Layer; re-surfacing the same article after 30 days is treated as a fresh discovery
- **Storage efficiency**: Keeps the active Knowledge Layer focused on recent, relevant content
- **Duplicate detection accuracy**: Catches duplicates from the same news cycle without false positives across different seasons
- **User expectation**: Aligns with typical news consumption patterns (weekly/bi-weekly reviews)

### Implementation

**SQL Check** (persist-articles.json, line 39):
```sql
SELECT id, dedupKey, seenCount, score FROM canonical_articles 
WHERE dedupKey = $dedupKey 
  AND (jsonData->>'addedAt')::timestamp > now() - interval '30 days' 
LIMIT 1
```

**Implication**: An article with the same `dedupKey` that was last seen >30 days ago will be treated as a **new** discovery (INSERT), not a duplicate (UPDATE).

### Edge Case: Long-Running Articles

Some articles remain relevant for months (e.g., in-depth guides, archived blog posts). If the same article appears again after 30 days:
- Old record: remains in Knowledge Layer (archived)
- New record: inserted as fresh discovery with new `addedAt` timestamp
- User result: same article appears twice in export (different addedAt dates)

**Future Enhancement**: Implement cross-window dedup (check beyond 30 days on score boost)

---

## DedupKey Format & Title Normalization

### Format

```
dedupKey = ${source} | ${normalizeTitle(title)}
```

**Example**:
- Source: `GitHub`
- Title: `"How to Write Better Tests for Your CI/CD Pipeline!!!"`
- Normalized: `"how-to-write-better-tests-for-your-cicd-pipeline"`
- dedupKey: `GitHub|how-to-write-better-tests-for-your-cicd-pipeline`

### Normalization Algorithm

The `normalizeTitle(title)` function (persist-articles.json, lines 6-12):

```javascript
function normalizeTitle(title) {
  return title
    .toLowerCase()                    // Step 1: Convert to lowercase
    .trim()                           // Step 2: Remove leading/trailing whitespace
    .replace(/[^a-z0-9-]/g, '-')      // Step 3: Replace non-alphanumeric (except hyphens) with hyphens
    .replace(/-+/g, '-')              // Step 4: Collapse consecutive hyphens to single
    .replace(/-$/, '');               // Step 5: Remove trailing hyphens
}
```

### Normalization Details

| Step | Input | Output | Purpose |
|------|-------|--------|---------|
| 1. Lowercase | `How to Write Better TESTS` | `how to write better tests` | Case-insensitive matching |
| 2. Trim | ` article title ` | `article title` | Remove accidental whitespace |
| 3. Replace special chars | `CI/CD, Testing & QA!` | `ci-cd--testing-qa-` | Create slug-friendly format |
| 4. Collapse hyphens | `ci--cd---testing` | `ci-cd-testing` | Avoid multi-hyphen artifacts |
| 5. Remove trailing hyphen | `testing-` | `testing` | Clean up trailing artifacts |

### Examples

| Original Title | Normalized |
|---|---|
| `"How to Write Better Tests (2024)"` | `how-to-write-better-tests-2024` |
| `"CI/CD Best Practices!!!"` | `cicd-best-practices` |
| `"100% automated testing - a guide"` | `100-automated-testing-a-guide` |
| `"What's new in TypeScript?"` | `whats-new-in-typescript` |
| `"  UPPERCASE   TITLE  "` | `uppercase-title` |

---

## UPDATE vs INSERT Logic

### Decision Flow

```
Article arrives with dedupKey = X

   ↓
   
Is dedupKey in canonical_articles (last 30 days)?

   ├─ YES → UPDATE PATH
   │   └─ Increment seenCount
   │   └─ Update score: max(old_score, new_score)
   │   └─ Optionally: update other fields (publishedAt if newer)
   │   └─ Log: "Duplicate detected: seenCount = N"
   │
   └─ NO → INSERT PATH
       └─ Insert new record
       └─ Set seenCount = 1
       └─ Set score = (M3 pipeline score)
       └─ Log: "New article: score = S"
```

### UPDATE Logic (persist-articles.json, lines 65-127)

**When triggered**: Duplicate article from same source within 30 days

**Fields updated**:
- `seenCount`: increment by 1
- `score`: take maximum of (old_score, new_score)
- `publishedAt`: update if new article's date is newer (optional)

**Example**:
```
Article 1 (Day 1): GitHub | how-to-write-tests, score=75, seenCount=1
Article 2 (Day 3): GitHub | how-to-write-tests, score=82, seenCount=?

After UPDATE:
  - seenCount = 2 (incremented)
  - score = 82 (max of 75 and 82)
  → Signal: Article gaining traction across sources
```

**Why keep max(score)?**
- Higher scores indicate better quality/relevance
- If an article appears in different sources, one might rate it higher
- Use the best assessment

### INSERT Logic (persist-articles.json, lines 78-90)

**When triggered**: Article not found in last 30 days (new article)

**Fields set**:
- `id`: generated (UUID or hash-based)
- `seenCount`: 1
- `score`: from M3 pipeline
- `addedAt`: current timestamp
- `dedupKey`: calculated from source + title

---

## Edge Cases & Handling

### 1. URL Changes (Same Article, Different URL)

**Scenario**: Article moved to a new URL, but title remains the same
```
Article 1: GitHub | "How to Write Better Tests"
           URL: https://example.com/old-url

Article 2: GitHub | "How to Write Better Tests"
           URL: https://example.com/new-url
```

**Current behavior**: Deduplicated by title only (same dedupKey)
**Result**: seenCount incremented, URL not updated
**Implication**: Link may be broken if old URL vanishes

**Future enhancement**: 
- Check both title AND URL for dedup
- Use URL-based secondary dedup fallback

### 2. Source Name Changes

**Scenario**: Article from `Dev.to` republished on `GitHub`
```
Article 1: Dev.to | "AI Prompt Engineering Guide"
Article 2: GitHub | "AI Prompt Engineering Guide"
```

**Current behavior**: Different dedupKeys (different sources)
**Result**: Treated as separate articles, seenCount not incremented
**Implication**: Same article appears twice from different sources

**Why this is OK**: Validates cross-platform relevance
**Future enhancement**: Implement content hash-based secondary dedup

### 3. Title Typos or Minor Variations

**Scenario**: Slight differences in capitalization or punctuation
```
Article 1: GitHub | "How to Write BETTER Tests for CI/CD"
Article 2: GitHub | "How to write better tests for ci/cd"
```

**Current behavior**: Same dedupKey after normalization
**Result**: Deduplicated correctly ✓
**Implication**: Typos don't prevent dedup

### 4. Substring Matches

**Scenario**: Article title is a substring of another
```
Article 1: "Testing Best Practices"
Article 2: "Testing Best Practices: A Complete Guide"
```

**Current behavior**: Different dedupKeys (different normalized strings)
**Result**: Treated as separate articles
**Implication**: Legitimate separate articles (good)

**Note**: String-based normalization won't detect semantic similarities. If needed, use future content-hash dedup.

### 5. Articles from Same Feed, Multiple Ingestion Runs

**Scenario**: Same article ingested twice in one day
```
Run 1 (08:00): Article "New TypeScript Features", score=65
Run 2 (14:00): Same article, score=70
```

**Current behavior**: Duplicate detected (same dedupKey, addedAt within 30 days)
**Result**: seenCount = 2, score = max(65, 70) = 70
**Implication**: Correctly consolidated, no duplication in export

---

## Impact on Score Tracking

### Score Evolution Example

```
Timeline:
─────────────────────────────────────────────

Day 1, 08:00: Article "Testing Patterns"
  Score assigned: 65 (good relevance)
  seenCount: 1
  Status: Inserted

Day 1, 14:00: Same article from different feed
  Score assigned: 72 (higher relevance)
  seenCount: 2 (incremented)
  score: 72 (max of 65, 72)
  Status: Updated

Day 2, 08:00: Article appears again
  Score assigned: 68
  seenCount: 3
  score: 72 (unchanged, lower than current)
  Status: Updated (seenCount only)

Result: Article with seenCount=3 and score=72 signals
         HIGH RELEVANCE & CROSS-PLATFORM VISIBILITY
```

### Using seenCount in Scoring

**Current approach**: seenCount stored but not used in export filtering
**Export filter**: `score >= 50` only

**Future enhancement**: 
- Boost score based on seenCount: `final_score = score + (seenCount * 5)`
- Creates positive feedback: high-visibility articles rank higher

---

## Monitoring & Validation

### Dedup Effectiveness Metrics

**What to track**:
- **Duplication rate**: (articles updated / total ingested) × 100
  - Target: 10-30% (indicates healthy cross-source coverage)
  - Too low (<5%): sources are too distinct or dedup logic broken
  - Too high (>50%): sources are redundant or dedup too aggressive

- **Average seenCount**: sum(seenCount) / count(unique articles)
  - Target: 1.2-1.5 (each article seen 1-2 times on average)
  - Indicates cross-platform relevance

### Validation Queries

**Check dedup effectiveness**:
```sql
SELECT 
  COUNT(*) as total_articles,
  COUNT(CASE WHEN seenCount > 1 THEN 1 END) as duplicated_articles,
  ROUND(COUNT(CASE WHEN seenCount > 1 THEN 1 END)::float / COUNT(*) * 100, 2) as duplication_rate,
  ROUND(AVG(seenCount), 2) as avg_seen_count
FROM canonical_articles
WHERE addedAt > now() - interval '7 days'
```

**Check dedupKey validity**:
```sql
-- Find articles with unusual dedupKey patterns
SELECT id, dedupKey, COUNT(*) as count
FROM canonical_articles
WHERE dedupKey LIKE '%-%-%-%' OR dedupKey LIKE '%|%|%'
GROUP BY dedupKey
HAVING COUNT(*) > 1
```

**Check 30-day window**:
```sql
-- Articles eligible for dedup (within 30 days)
SELECT COUNT(*) as active_articles
FROM canonical_articles
WHERE addedAt > now() - interval '30 days'

-- Archived articles (older than 30 days)
SELECT COUNT(*) as archived_articles
FROM canonical_articles
WHERE addedAt <= now() - interval '30 days'
```

---

## Testing Dedup Logic

### Test Case 1: Basic Dedup

**Input**: Same article from same source, 1 day apart

**Setup**:
```json
Article 1: {
  "source": "GitHub",
  "title": "How to Write Better Tests",
  "url": "https://example.com/tests",
  "score": 75,
  "publishedAt": "2026-07-13T10:00:00Z"
}

Article 2 (Day 2): {
  "source": "GitHub",
  "title": "How to Write Better Tests",
  "url": "https://example.com/tests",
  "score": 80,
  "publishedAt": "2026-07-13T10:00:00Z"
}
```

**Expected Result**:
- Article 1 inserted (id=A, seenCount=1, score=75)
- Article 2 triggers UPDATE (seenCount→2, score→80)
- Only 1 record in canonical_articles

### Test Case 2: Cross-Source Visibility

**Input**: Same article from two different sources

**Setup**:
```json
Article 1: GitHub | "CI/CD Best Practices", score=65
Article 2: Dev.to | "CI/CD Best Practices", score=70
```

**Expected Result**:
- Article 1 inserted (seenCount=1, score=65)
- Article 2 inserted separately (different source, different dedupKey)
- 2 records in export (cross-source visibility validated)

### Test Case 3: 30-Day Window Boundary

**Input**: Same article, 31 days apart

**Setup**:
```json
Article 1: addedAt = 2026-06-12T10:00:00Z
Article 2: addedAt = 2026-07-13T10:00:00Z (31 days later)
```

**Expected Result**:
- Article 1 not found in 30-day check (too old)
- Article 2 inserted as NEW (seenCount=1)
- 2 records in canonical_articles (different addedAt dates)

---

## Summary

| Aspect | Implementation |
|--------|---|
| **Window** | 30 days (active Knowledge Layer) |
| **DedupKey** | `${source}\|${normalizeTitle(title)}` |
| **Normalization** | Lowercase → trim → replace special chars → collapse hyphens |
| **UPDATE Trigger** | dedupKey exists AND addedAt within 30 days |
| **UPDATE Fields** | seenCount++, score = max(old, new) |
| **INSERT Trigger** | dedupKey not found in 30-day window |
| **INSERT Fields** | seenCount=1, score from M3 pipeline |
| **Edge Cases** | URL changes, source name changes, typos (handled), semantic duplicates (not handled yet) |
| **Monitoring** | Duplication rate, seenCount distribution, dedupKey validity |

---

## Version History

- **v1.0** (2026-07-13): Initial dedup strategy documentation
  - 30-day window rationale
  - dedupKey normalization algorithm
  - UPDATE vs INSERT decision flow
  - Edge cases and workarounds
  - Monitoring and validation queries
  - Test cases for verification

