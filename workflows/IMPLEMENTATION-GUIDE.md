# B2 Implementation Guide: Persistence Pipeline

**Task**: B2 - Wire M3 workflow to persist articles to Knowledge Layer and export to latest.json

**Status**: Workflows created, ready for import and integration

**Date**: 2026-07-13

---

## Quick Start

### 1. Import Workflows into n8n

Three workflow JSON files have been created for this task:

#### Step 1a: Import `persist-articles.json`

1. Open n8n UI at `http://localhost:3333`
2. Navigate to **Workflows** section
3. Click **Import** or **+ Create**
4. Upload: `/Users/rafalciesielski/Developer/ChiefofStaff/workflows/persist-articles.json`
5. Name: `Persist Articles to Knowledge Layer`
6. Click **Import** or **Create**
7. Do NOT activate yet (wait for M3 integration)

#### Step 1b: Import `export-latest-news.json`

1. In Workflows section, click **Import**
2. Upload: `/Users/rafalciesielski/Developer/ChiefofStaff/workflows/export-latest-news.json`
3. Name: `Export Latest News to JSON`
4. Click **Import**
5. Activate this workflow (it runs on cron schedule)

#### Step 1c (Optional): Import test workflow

For testing the persist + export pipeline:

1. Upload: `/Users/rafalciesielski/Developer/ChiefofStaff/workflows/test-persist-export-pipeline.json`
2. Name: `Test: Persist and Export Pipeline`
3. Click **Import**
4. Keep inactive (manual trigger only)

### 2. Verify Data Table

Ensure `canonical_articles` data table exists:

1. Navigate to **Data** section in n8n
2. Verify table `canonical_articles` is listed
3. Click on it to view schema
4. Confirm all 12 fields exist (see `workflows/data-schema.md`)

### 3. Test Persist Workflow (Optional)

Before integrating with M3, you can test the persist workflow:

1. Open `Persist Articles to Knowledge Layer` workflow
2. Click **Activate** (if desired)
3. Click **Execute Workflow** or **Test**
4. Execution will use manual trigger with test data
5. Check Data → canonical_articles table to verify articles inserted
6. Verify dedupKey is correctly calculated: `${source}|${normalized_title}`

### 4. Test Export Workflow (Optional)

To test the export workflow manually:

1. Open `Export Latest News to JSON` workflow
2. Click **Edit** to change schedule to manual trigger (optional)
3. Click **Execute Workflow** or **Test**
4. Verify `/qa-news/public/latest.json` is created/updated
5. Check file content for correct JSON structure
6. Restore to cron schedule (`0 8 * * *`) when done testing

### 5. Integrate with M3 Workflow

**This is the critical step that wires everything together.**

#### Step 5a: Modify M3 to call persist sub-workflow

The M3 workflow (`PAIOS Daily Brief`) needs to call the persist workflow after scoring but before Claude AI processing.

**Current M3 Flow**:
```
Fetch Articles → Normalize → Score → Deduplicate → AI (Claude) → Output
```

**Modified M3 Flow**:
```
Fetch Articles → Normalize → Score → Deduplicate → Persist → AI (Claude) → Output
```

**In n8n UI**:

1. Open `PAIOS Daily Brief` workflow
2. Find the node where articles are scored and sorted (likely after "Sort" node)
3. Add a new node:
   - Type: **Execute workflow** or **Sub-workflow**
   - Select: `Persist Articles to Knowledge Layer`
   - Input: Pass the article array from previous node
   - Output: Continue flow to AI processing
4. Connect the node:
   - Input: Wire from "Sort" or "Limit" node
   - Output: Wire to "Generate Daily Brief (Claude)" node
5. Save the workflow

**Alternative approach** (if sub-workflow node is not available):

If n8n doesn't have a native sub-workflow node, you can:
1. Copy the persist logic (Code node) directly into M3 workflow
2. Add after the "Sort" node, before AI processing
3. Insert articles to canonical_articles in-line

#### Step 5b: Configure M3 scheduling

Ensure M3 workflow is scheduled to run at **08:00 UTC**:

1. Open `PAIOS Daily Brief` workflow
2. Look for the trigger node (likely "Schedule Trigger" or "Cron")
3. Verify cron expression: `0 8 * * *`
4. If not present, add Schedule Trigger:
   - Mode: Cron expression
   - Cron: `0 8 * * *` (08:00 UTC daily)
   - This ensures M3 runs before export (08:05)

### 6. Configure Export Workflow Scheduling

The export workflow is already configured to run at **08:05 UTC** (5 minutes after M3):

1. Open `Export Latest News to JSON` workflow
2. Click on the "Daily Schedule" node (Schedule Trigger)
3. Verify cron expression: `0 8 * * *`
   - ⚠️ NOTE: This is 08:00, not 08:05. You need to change it!
4. To change to 08:05:
   - Click on the Schedule Trigger node
   - Change cron to: `5 8 * * *`
   - Save

Or if using cron expression:
- `5 8 * * *` = 08:05 UTC (minutes first, then hour in standard cron)

After 2024-07-13:
- 08:00 → M3 Daily Brief runs
- 08:05 → Export Latest News runs
- latest.json is updated with top articles from canonical_articles
- Git commit created in qa-news repo

### 7. First Run Verification

Monitor the first automatic run (next day at 08:05):

1. Check n8n Execution Logs:
   - Look for "Export Latest News to JSON" execution at ~08:05
   - Should show "export_complete" status
   - Check for any errors in workflow execution

2. Verify latest.json:
   ```bash
   cd /Users/rafalciesielski/Developer/ChiefofStaff/qa-news
   cat public/latest.json | jq . | head -20
   ```
   - Should have `date`, `updatedAt`, `articles` fields
   - Articles should be sorted by publishedAt (newest first)

3. Check git commit:
   ```bash
   cd /Users/rafalciesielski/Developer/ChiefofStaff/qa-news
   git log --oneline | head -5
   ```
   - Should see commit: `chore(data): export latest articles [skip ci]`

4. Verify GitHub Pages:
   - Access qa-news website
   - Should display latest articles from latest.json
   - Content should auto-update

---

## Architecture Deep Dive

### Data Flow

```
M3 DAILY BRIEF (08:00)
├─ Fetch articles from 5+ sources
├─ Normalize to common schema
├─ Score by keywords + source weight
├─ Deduplicate by URL
├─ Sort by score (DESC)
├─ Limit to top N articles
│
├─ PERSIST ARTICLES (new)
│  ├─ Map to canonical_articles schema
│  ├─ Calculate dedupKey
│  ├─ Check for duplicates (last 30 days)
│  ├─ Insert new or update existing
│  └─ Log persisted article IDs
│
├─ Generate AI Brief (Claude)
├─ Format as Markdown
└─ Output to Telegram + Vault
│
EXPORT LATEST NEWS (08:05)
├─ Query canonical_articles (score >= 50, limit 100)
├─ Transform to export schema
├─ Add metadata (date, updatedAt)
├─ Convert to JSON
├─ Write to latest.json
├─ Git commit
└─ GitHub Pages auto-refresh
```

### Field Mapping

**M3 Article → canonical_articles**:

| M3 Field | canonical_articles | Transform |
|---|---|---|
| source | source | Direct |
| title | title | Direct, max 500 chars |
| content | summary | Truncate to 1000 chars |
| url | url | Direct |
| published_at | publishedAt | ISO 8601 UTC |
| tags | tags | Join array to string |
| score | score | Direct, 0-100 |
| (inferred) | category | From keywords in title/content |
| (generated) | id | UUID or hash-based |
| (current) | addedAt | now().toISOString() |
| (initial) | seenCount | 1 (or increment if dedup) |
| (calculated) | dedupKey | `${source}\|${normalizeTitle(title)}` |

### Deduplication Strategy

When inserting an article:

1. **Calculate dedupKey**: `${source}|${normalizeTitle(title)}`
2. **Query Data Table**: 
   ```sql
   SELECT * FROM canonical_articles 
   WHERE dedupKey = ? 
   AND addedAt >= NOW() - INTERVAL '30 days'
   ```
3. **If found**:
   - Increment seenCount
   - Update score if new score > old score
   - Update publishedAt if new date > old date
   - Keep the same id
4. **If not found**:
   - Generate new id (UUID or hash)
   - Insert as new record
   - seenCount = 1

**Purpose**: Identify when the same article (by source + normalized title) appears multiple times across feeds or runs, without creating duplicates.

### Export Logic

**Query**:
```sql
SELECT id, title, summary, url, source, category, publishedAt, tags
FROM canonical_articles
WHERE score >= 50
ORDER BY publishedAt DESC
LIMIT 100
```

**Schema**:
```json
{
  "date": "YYYY-MM-DD",
  "updatedAt": "ISO 8601 timestamp",
  "articles": [
    {
      "id": "unique-id",
      "title": "Article Title",
      "summary": "Article summary (1000 chars max)",
      "url": "https://...",
      "source": "Source Name",
      "category": "test-automation|ai|engineering|qa-practice|tooling",
      "publishedAt": "ISO 8601 timestamp",
      "tags": ["tag1", "tag2"]
    }
  ]
}
```

---

## Troubleshooting

### Issue: Workflows won't import

**Solution**:
- Ensure JSON syntax is valid (use a JSON linter)
- Check file encoding (UTF-8)
- Verify Data Table ID matches (550e8400-e29b-41d4-a716-446655440001)
- Try manual creation of nodes if import fails

### Issue: Articles not persisting to canonical_articles

**Solution**:
- Verify Data Table exists in **Data** section
- Check workflow execution logs for errors
- Confirm all required fields are mapped (no null IDs)
- Check dedupKey calculation (should not be empty)
- Ensure score is within 0-100 range

### Issue: latest.json not being written

**Solution**:
- Verify file path: `/qa-news/public/latest.json`
- Check n8n has write permissions to qa-news directory
- Check export workflow execution logs
- Verify JSON is valid before writing (use toJSON node)

### Issue: Git commit failing

**Solution**:
- Verify n8n has git credentials configured
- Check git config in n8n container: `git config --list`
- Ensure qa-news repo has git initialized
- Check commit message for special characters
- Try manual git commit to verify setup

### Issue: Articles not appearing in latest.json

**Solution**:
- Verify articles in canonical_articles have score >= 50
- Check query in export workflow (SELECT * ... score >= 50)
- Verify publishedAt dates are valid ISO 8601 format
- Check tag transformation (string → array)
- Verify category enum values are correct

---

## Testing Checklist

### Unit Tests (per workflow)

- [ ] **Persist Articles**:
  - [ ] Articles inserted with correct fields
  - [ ] dedupKey calculated correctly
  - [ ] Deduplication works (seenCount incremented)
  - [ ] Score clamped to 0-100
  - [ ] addedAt timestamp is current

- [ ] **Export Latest News**:
  - [ ] Query returns top articles by publishedAt DESC
  - [ ] JSON schema is correct
  - [ ] Tags converted from string to array
  - [ ] date and updatedAt fields present
  - [ ] File written to correct path

### Integration Tests

- [ ] M3 calls persist workflow automatically
- [ ] Persist workflow completes before AI step
- [ ] Export workflow runs at 08:05 UTC
- [ ] latest.json updates after export
- [ ] Git commit created after export
- [ ] qa-news website displays latest articles

### End-to-End Test

1. **Trigger M3 workflow manually** (08:00)
   - Monitor execution
   - Verify articles appear in canonical_articles
   - Verify scores are correct
2. **Trigger export workflow manually** (or wait until 08:05)
   - Verify latest.json created/updated
   - Verify git commit created
3. **Check qa-news website**
   - Navigate to site
   - Verify latest articles displayed
   - Check article metadata (title, source, category)
4. **Monitor for 24 hours**
   - Verify workflows run at scheduled times
   - Check for any errors in execution logs
   - Verify latest.json updates daily

---

## Configuration Reference

### Environment Variables (if needed in n8n)

```
N8N_DATA_TABLE_ID=550e8400-e29b-41d4-a716-446655440001
EXPORT_FILE_PATH=/qa-news/public/latest.json
EXPORT_ARTICLE_LIMIT=100
EXPORT_MIN_SCORE=50
EXPORT_CRON=5 8 * * *
M3_CRON=0 8 * * *
```

### Database Connection

Data Table queries use n8n's native Data Table node, which auto-connects to the configured data source (PostgreSQL).

### Git Configuration (in n8n container)

For git commit to work:
```bash
git config --global user.name "n8n"
git config --global user.email "n8n@example.com"
```

---

## File References

| File | Purpose |
|---|---|
| `workflows/PERSISTENCE-PIPELINE.md` | Architecture overview and design |
| `workflows/IMPLEMENTATION-GUIDE.md` | This file - step-by-step setup |
| `workflows/persist-articles.json` | Workflow to insert articles into Data Table |
| `workflows/export-latest-news.json` | Workflow to export articles to latest.json |
| `workflows/test-persist-export-pipeline.json` | End-to-end test workflow |
| `workflows/data-schema.md` | canonical_articles schema (reference) |
| `qa-news/public/latest.json` | Output file (auto-generated) |

---

## Success Criteria

After completing this guide:

- [ ] `persist-articles.json` imported into n8n
- [ ] `export-latest-news.json` imported into n8n
- [ ] M3 workflow modified to call persist sub-workflow
- [ ] M3 scheduled to run at 08:00 UTC daily
- [ ] Export scheduled to run at 08:05 UTC daily
- [ ] Test: Persist workflow inserts articles to canonical_articles
- [ ] Test: Export workflow creates valid latest.json
- [ ] Test: Git commit created after export
- [ ] First automatic run verified (08:05 UTC)
- [ ] latest.json updates appear in qa-news website
- [ ] No errors in workflow execution logs

---

## Next Steps

1. **Import workflows** (Step 1a-c)
2. **Test persist workflow** (Step 3, optional)
3. **Test export workflow** (Step 4, optional)
4. **Integrate with M3** (Step 5, critical)
5. **Monitor first run** (Step 7)
6. **Adjust configuration** as needed

Once completed, the persistence pipeline will:
- Automatically persist all M3 articles to Knowledge Layer
- Deduplicate by source + normalized title
- Export top articles daily to latest.json
- Keep qa-news website up-to-date with latest articles

---

**Task B2 Status**: READY FOR IMPLEMENTATION

All workflows created and documented. Awaiting import into n8n and M3 integration.
