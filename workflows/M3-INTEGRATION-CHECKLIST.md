# M3 + Persist-Articles Integration Checklist

## Overview
The `persist-articles.json` sub-workflow must be called from the M3 daily workflow after articles are scored and before the AI brief generation step. This ensures that scored articles are persisted to the Knowledge Layer (canonical_articles Data Table) with proper deduplication.

## Integration Steps

### 1. Add Sub-Workflow Call Node to M3
**Where:** After the "Score Articles" node, before the "Generate AI Brief" node

**Node Configuration:**
- **Type:** `n8n-nodes-base.workflow`
- **Node Name:** "Persist Scored Articles"
- **Workflow ID:** Select `persist-articles` from the list
- **Execution Mode:** `Run as separate process` (recommended for isolation)

### 2. Wire Article Data from M3 to Persist-Articles
**Input Mapping:**

The M3 workflow should pass the scored articles array to persist-articles. Configure the sub-workflow call with:

```
Input Data: {{ $json.articles }}
```

Or if articles are in `$input.all()`:
```
Input Data: {{ $input.all().map(item => item.json) }}
```

Each article object should contain:
- `id` (from M3 scoring)
- `title` (from RSS feed)
- `content` or `contentSnippet` (for category inference)
- `url` / `link` (article URL)
- `source` (feed name)
- `category` (optional, will be inferred)
- `published_at` or `isoDate` (publication date)
- `score` (from M3 scoring, >= 50)
- `tags` (optional, array or comma-separated string)

### 3. Handle Persist-Articles Output
**Output Processing:**

The sub-workflow returns:
```javascript
{
  status: "inserted" | "updated",
  operation: "inserted (new)" | "updated (seenCount++, score adjusted)",
  id: "article-id",
  title: "Article Title",
  source: "Feed Name",
  dedupKey: "source|normalized-title",
  score: 75
}
```

**Pass to Next Step:**
- Extract persisted articles count
- Log completion status
- Continue to AI brief generation

### 4. Workflow Sequence (M3)

```
1. Fetch RSS Feeds
   ↓
2. Score Articles (M3 scoring logic)
   ↓
3. **[NEW]** Persist Scored Articles ← persist-articles sub-workflow call
   ↓
4. Generate AI Brief (using persisted articles)
   ↓
5. Deliver Brief
```

## Deduplication Logic

The `persist-articles` workflow performs 30-day deduplication:

### For NEW Articles (not in last 30 days):
- INSERT into canonical_articles
- `seenCount: 1`
- `score: <from M3>`

### For DUPLICATE Articles (found in last 30 days):
- UPDATE existing row
- `seenCount: seenCount + 1`
- `score: max(existing_score, new_score)`
- Preserve original `addedAt` (don't update)

### Dedup Key:
```
dedupKey = source + "|" + normalizeTitle(title)
```

Example:
- Source: "Dev.to"
- Title: "Testing Best Practices in 2025"
- dedupKey: "Dev.to|testing-best-practices-in-2025"

## Testing Checklist

### Unit Test (persist-articles standalone):
- [ ] Manually trigger `persist-articles` with test article
- [ ] Verify INSERT creates new row with seenCount=1
- [ ] Manually trigger same article again (within 30 days)
- [ ] Verify UPDATE increments seenCount to 2
- [ ] Verify score is max(old, new)
- [ ] Check verification query shows updated article

### Integration Test (M3 + persist-articles):
- [ ] Run M3 daily workflow manually
- [ ] Check M3 logs for "Persist Scored Articles" step
- [ ] Verify all scored articles appear in canonical_articles
- [ ] Run M3 again next day with same articles
- [ ] Verify seenCount incremented for duplicates
- [ ] Verify AI brief still generates correctly
- [ ] Verify export-latest-news.json exports only score >= 50 articles

### End-to-End Test (Full Pipeline):
1. Run M3 workflow → scores articles
2. Check persist-articles logs → articles inserted
3. Check export-latest-news.json runs at 08:05 UTC → latest.json created
4. Verify qa-news receives updated latest.json
5. Verify git commit created with export data

## Troubleshooting

### Issue: "Sub-workflow not found"
**Solution:** Ensure `persist-articles` workflow is deployed and active before running M3

### Issue: "Article objects don't match schema"
**Solution:** Verify M3 outputs article objects with at least: `title`, `url`, `source`, `score`

### Issue: "30-day dedup window not working"
**Solution:** Check that `addedAt` timestamp is set correctly in M3 before calling persist-articles

### Issue: "Export cron not running"
**Solution:** Ensure export-latest-news cron is set to `5 8 * * *` (08:05 UTC) to run AFTER M3 completes at 08:00 UTC

## Files Changed in This Integration

- `workflows/M3/main.json` — Add persist-articles sub-workflow call
- `workflows/persist-articles.json` — Already contains dedup logic
- `workflows/export-latest-news.json` — Cron at 08:05 UTC, score filter applied

## Next Steps

1. Add the persist-articles sub-workflow call node to M3 workflow
2. Configure input/output mappings
3. Run integration test
4. Deploy to production
5. Monitor logs for duplicate handling
