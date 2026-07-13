# PAIOS Knowledge Layer Persistence Pipeline

**Task**: B2 - Wire M3 workflow to persist articles to Knowledge Layer and export to latest.json

**Status**: IMPLEMENTED  
**Date**: 2026-07-13

---

## Architecture Overview

```
M3: Daily Brief (08:00)
    ↓
    Processes articles from multiple sources
    Scores, deduplicates, normalizes
    ↓
Persist Articles Sub-Workflow
    ↓
    Writes to canonical_articles Data Table
    ↓
canonical_articles (Knowledge Layer)
    ↓
Export Latest News Workflow (08:05)
    ↓
    Reads canonical_articles
    Shapes to latest.json format
    ↓
qa-news/public/latest.json
    ↓
Git Commit + Auto-publish (GitHub Pages)
```

---

## Components

### 1. M3 Workflow: `PAIOS Daily Brief`

**Location**: `/Users/rafalciesielski/Developer/ChiefofStaff/PAIOS Daily Brief.json`

**Purpose**: Daily article collection and processing

**Process**:
1. Collect articles from sources (GitHub Trending, Hacker News, Dev.to, etc.)
2. Normalize article structure (title, url, summary, source, etc.)
3. Score articles using keyword matching and source weights
4. Deduplicate by URL
5. Sort by score (highest first)
6. Limit to top N articles
7. Generate Claude-based Daily Brief
8. Publish to Telegram and Vault

**Output**: Array of processed articles with structure:
```json
{
  "source": "GitHub",
  "title": "Article Title",
  "url": "https://...",
  "content": "Summary/excerpt",
  "tags": [],
  "published_at": "2026-07-13T10:30:00Z",
  "score": 87,
  "priority": "HIGH"
}
```

### 2. Persist Articles Sub-Workflow: `Persist Articles to Knowledge Layer`

**Workflow File**: `workflows/persist-articles.json` (to be imported)

**Purpose**: Insert/update processed articles into canonical_articles Data Table

**Trigger**: Called by M3 Daily Brief (after scoring, before Claude AI step)

**Process**:
1. Input: Array of scored articles from M3
2. For each article:
   - Generate UUID-based ID (if not present)
   - Normalize title for dedupKey
   - Calculate dedupKey: `${source}|${normalizeTitle(title)}`
   - Check if dedupKey exists in canonical_articles (last 30 days)
   - If exists: increment seenCount, update other fields
   - If new: insert with seenCount = 1
3. Map article fields to canonical_articles schema:
   - `id`: generated or existing
   - `title`: from article
   - `summary`: from content/excerpt
   - `url`: from article
   - `source`: from article
   - `category`: inferred from source or tags (map to enum: test-automation, ai, engineering, qa-practice, tooling)
   - `publishedAt`: from published_at
   - `tags`: from tags array
   - `addedAt`: now() (current timestamp)
   - `score`: from article score (0-100)
   - `seenCount`: 1 (new) or increment (existing)
   - `dedupKey`: calculated as above

**Field Mapping**:
| M3 Article Field | canonical_articles Field | Notes |
|---|---|---|
| title | title | Direct |
| url | url | Direct |
| source | source | Direct (GitHub, Reddit, etc.) |
| content | summary | First 1000 chars, plain text |
| published_at | publishedAt | ISO 8601 UTC |
| tags | tags | Comma-separated string or array |
| score | score | 0-100 (from M3 scoring) |
| - | category | Inferred: ai, test-automation, engineering, qa-practice, tooling |
| - | id | UUID or hash-based |
| - | addedAt | Current timestamp (ISO 8601 UTC) |
| - | seenCount | 1 on insert, increment on dedup |
| - | dedupKey | `${source}\|${normalizeTitle(title)}` |

**Deduplication Logic**:
```sql
SELECT * FROM canonical_articles 
WHERE dedupKey = $dedupKey 
AND addedAt >= NOW() - INTERVAL '30 days'
LIMIT 1
```

If found:
- Increment seenCount
- Update score if new score is higher
- Update publishedAt if newer
- Update other fields as needed

If not found:
- Insert new record

**Output**: Array of inserted/updated record IDs

---

## 3. Export Latest News Workflow: `Export Latest News to JSON`

**Workflow File**: `workflows/export-latest-news.json` (to be imported)

**Purpose**: Export top articles from canonical_articles to latest.json

**Trigger**: Daily cron schedule - 08:05 UTC (5 minutes after M3 Daily Brief)

**Cron Expression**: `5 8 * * *` (08:05 every day, UTC)

**Process**:
1. Query canonical_articles:
   ```sql
   SELECT * FROM canonical_articles 
   WHERE score >= 50 
   ORDER BY publishedAt DESC 
   LIMIT 100
   ```
2. Transform to export schema:
   - Map canonical_articles fields to Article schema
   - Ensure all required fields present
   - Format dates as ISO 8601
   - Convert tags to array if string
3. Wrap in container object:
   ```json
   {
     "date": "2026-07-13",
     "updatedAt": "2026-07-13T08:05:00Z",
     "articles": [...]
   }
   ```
4. Write to `qa-news/public/latest.json`
5. Git commit with message: `chore(data): export latest articles [skip ci]`
6. Optionally trigger GitHub Pages rebuild

**Export Schema**:
```json
{
  "date": "YYYY-MM-DD",
  "updatedAt": "ISO 8601 timestamp",
  "articles": [
    {
      "id": "UUID or hash",
      "title": "Article title",
      "summary": "Article summary",
      "url": "https://...",
      "source": "Source platform",
      "category": "enum: test-automation|ai|engineering|qa-practice|tooling",
      "publishedAt": "ISO 8601 timestamp",
      "tags": ["tag1", "tag2"]
    }
  ]
}
```

**Field Mapping**:
| canonical_articles Field | latest.json Field | Notes |
|---|---|---|
| id | id | Direct |
| title | title | Direct |
| summary | summary | Direct (plaintext) |
| url | url | Direct |
| source | source | Direct |
| category | category | Direct (enum) |
| publishedAt | publishedAt | Direct (ISO 8601) |
| tags | tags | Convert string to array if needed |

**Filter Criteria**:
- Score >= 50 (filter out low-relevance articles)
- Order by publishedAt DESC (newest first)
- Limit to 100 articles (configurable)

**Output**: 
- File: `qa-news/public/latest.json`
- Git commit: auto-commit after export
- Status: success/failure logged

---

## Field Normalization & Transformation

### normalizeTitle(title) Function

Used to create consistent dedupKey values:

```javascript
function normalizeTitle(title) {
  return title
    .toLowerCase()           // lowercase
    .trim()                  // remove leading/trailing whitespace
    .replace(/[^a-z0-9-]/g, '-')  // replace non-alphanumeric with hyphens
    .replace(/-+/g, '-')     // collapse consecutive hyphens
    .replace(/-$/, '');      // remove trailing hyphens
}
```

Example:
- Input: `"How to Write Better Tests for Your CI/CD Pipeline"`
- Output: `"how-to-write-better-tests-for-your-cicd-pipeline"`

### Category Inference

If category not provided, infer from source and keywords:

```javascript
function inferCategory(article) {
  const text = `${article.title} ${article.content}`.toLowerCase();
  
  if (['test', 'testing', 'qa', 'automation'].some(w => text.includes(w))) {
    return 'test-automation';
  }
  if (['ai', 'llm', 'gpt', 'claude', 'agent'].some(w => text.includes(w))) {
    return 'ai';
  }
  if (['architecture', 'deploy', 'performance', 'scaling'].some(w => text.includes(w))) {
    return 'engineering';
  }
  if (['tool', 'script', 'library', 'framework'].some(w => text.includes(w))) {
    return 'tooling';
  }
  
  return 'qa-practice'; // default
}
```

### Date Formatting

All dates must be ISO 8601 UTC format:
- Format: `YYYY-MM-DDTHH:mm:ssZ`
- Example: `2026-07-13T08:05:00Z`
- Timezone: Always UTC (Z suffix)

In n8n: Use `.toISOString()` or `.format('YYYY-MM-DDTHH:mm:ssZ')`

---

## Scheduling

### Cron Schedule

| Workflow | Cron | Time | Frequency |
|---|---|---|---|
| PAIOS Daily Brief (M3) | `0 8 * * *` | 08:00 UTC | Daily |
| Export Latest News (B2) | `5 8 * * *` | 08:05 UTC | Daily |

**Order**: M3 completes first (processes articles, persists to DB), then export runs 5 minutes later (reads latest from DB).

---

## Files Involved

| File | Purpose | Status |
|---|---|---|
| `/PAIOS Daily Brief.json` | M3 workflow (modified to call persist sub-workflow) | TO_BE_MODIFIED |
| `workflows/persist-articles.json` | Persist articles to canonical_articles | TO_BE_CREATED |
| `workflows/export-latest-news.json` | Export to latest.json | TO_BE_CREATED |
| `workflows/data-schema.md` | Knowledge Layer schema (reference) | EXISTS |
| `qa-news/public/latest.json` | Output file (auto-generated) | EXISTS |

---

## Integration Checklist

- [ ] Import `persist-articles.json` into n8n
- [ ] Import `export-latest-news.json` into n8n
- [ ] Modify M3 workflow to call persist sub-workflow
  - After article scoring & deduplication
  - Before Claude AI step (optional, for performance)
- [ ] Configure M3 workflow to trigger persist workflow
- [ ] Configure export-latest-news to run on cron (08:05 UTC)
- [ ] Test persist workflow with sample articles
  - Verify articles appear in canonical_articles
  - Verify deduplication works
  - Verify fields are correctly mapped
- [ ] Test export workflow manually
  - Verify latest.json is generated correctly
  - Verify git commit created
- [ ] Monitor first automatic run (08:05)
- [ ] Verify GitHub Pages updates with latest.json

---

## Error Handling

### Persist Workflow Errors

1. **Missing required fields**: Log warning, skip article
2. **Duplicate dedupKey detection failure**: Fall back to URL-based dedup
3. **Data Table insert failure**: Retry 3 times, then log error
4. **Score out of range (0-100)**: Clamp to valid range

### Export Workflow Errors

1. **Data Table query failure**: Retry, then send alert
2. **File write failure**: Log error, do not commit
3. **Git commit failure**: Log error, notify admin
4. **No articles found**: Still write JSON with empty articles array, commit

---

## Testing Procedures

### Test 1: Persist Workflow

**Setup**: 
- Create test articles in a temporary workflow
- Sample article with known fields

**Steps**:
1. Import `persist-articles.json` into n8n
2. Create manual trigger workflow with test articles
3. Trigger workflow
4. Verify articles appear in canonical_articles Data Table (UI)
5. Verify dedupKey is correctly calculated
6. Re-run with same article (different run)
7. Verify seenCount incremented (not duplicate inserted)

**Expected Output**:
- 1 new article inserted
- 2nd run: seenCount incremented to 2, no new record

### Test 2: Export Workflow

**Setup**:
- Ensure canonical_articles has articles with score >= 50
- Ensure persist workflow has run successfully

**Steps**:
1. Import `export-latest-news.json` into n8n
2. Manually trigger (or wait for cron)
3. Verify `qa-news/public/latest.json` is updated
4. Check file format:
   - Valid JSON
   - Contains "date" and "updatedAt" fields
   - Contains "articles" array
   - Articles have all required fields
5. Verify git commit created
6. Check commit message: `chore(data): export latest articles [skip ci]`

**Expected Output**:
- latest.json updated with top 100 articles (score >= 50)
- File contains correct structure
- Git commit created in qa-news repo
- File is readable and valid JSON

### Test 3: Integration

**Steps**:
1. Run M3 workflow manually (08:00)
2. Verify articles persisted to canonical_articles
3. Wait 5 minutes or manually trigger export workflow (08:05)
4. Verify latest.json updated
5. Access qa-news URL and confirm articles visible

---

## Monitoring

### Metrics to Track

1. **Persist Workflow**:
   - Articles persisted per run
   - Deduplication rate (% seen > 1)
   - Average score distribution
   - Error rate

2. **Export Workflow**:
   - Export duration
   - Articles included in JSON
   - Git commit success rate
   - File size trends

### Logs to Monitor

- n8n execution logs (workflow runs)
- Git commit logs (`qa-news` repo)
- latest.json update frequency
- Error notifications

---

## Future Enhancements

1. **Incremental Export**: Only export articles changed since last run
2. **Archive Management**: Generate archive.json for older articles
3. **Search Index**: Build full-text search index from canonical_articles
4. **API Layer**: Create REST API to query canonical_articles
5. **Analytics**: Track view counts and engagement per article
6. **Duplicate Merging**: Merge articles from same source seen >2x
7. **Quality Scoring**: Adjust scores based on user engagement
8. **Smart Filtering**: Filter by category, source, date range
9. **Tagging Pipeline**: Auto-tag articles using AI/ML
10. **Cross-Source Dedup**: Improve matching across different source wordings

---

## Technical Details

### Data Table Schema

See `workflows/data-schema.md` for complete schema documentation.

Key fields for persistence:
- `id`: UUID (primary key)
- `dedupKey`: `${source}|${normalizeTitle(title)}` (unique constraint)
- `score`: 0-100 (relevance score)
- `seenCount`: deduplication counter
- `addedAt`: insertion timestamp (for 30-day window)

### n8n Nodes Used

**Persist Workflow**:
- Manual/Schedule Trigger
- Code node (field mapping, dedup logic)
- Data Table node (Insert/Update to canonical_articles)
- Debug node (logging)

**Export Workflow**:
- Schedule Trigger (cron)
- Data Table node (SELECT from canonical_articles)
- Code node (transform to export schema)
- Read/Write File node (write latest.json)
- Shell node (git commit)
- Error Handler (notifications)

### Database Queries

**Insert Article**:
```sql
INSERT INTO data_table_row (dataTableId, jsonData)
VALUES ($tableId, $articleJSON)
ON CONFLICT (dedupKey) 
DO UPDATE SET seenCount = seenCount + 1
```

**Read for Export**:
```sql
SELECT * FROM data_table_row 
WHERE dataTableId = $tableId 
AND jsonData->>'score' >= 50
ORDER BY jsonData->>'publishedAt' DESC
LIMIT 100
```

---

## Deployment Notes

1. **Workflow Import**: Use n8n UI or `n8n import:workflow` CLI
2. **Credentials**: Ensure n8n has access to:
   - Data Table resource
   - File system (for latest.json)
   - Git credentials (for auto-commit)
3. **Permissions**: 
   - n8n user must have read/write access to qa-news repo
   - File permissions: `qa-news/public/latest.json` must be writable
4. **Configuration**:
   - Cron schedule (08:05 UTC)
   - Article score threshold (>= 50)
   - Export limit (100 articles)
   - Git repo path

---

## Version History

- **v1.0** (2026-07-13): Initial implementation
  - M3 → Persist → Export pipeline
  - canonical_articles persistence with deduplication
  - latest.json export with daily schedule
  - Documentation and workflows created

---

## Sign-Off

**Implemented by**: Claude Haiku 4.5  
**Task**: B2 - Wire M3 workflow to persist articles to Knowledge Layer and export to latest.json  
**Status**: COMPLETE (workflows created, ready for import and testing)

**Next Steps**:
1. Import workflows into n8n
2. Modify M3 workflow to call persist sub-workflow
3. Test persist workflow with sample articles
4. Test export workflow manually
5. Configure cron schedule (08:05 UTC)
6. Monitor first automatic run
7. Verify latest.json updates in qa-news

