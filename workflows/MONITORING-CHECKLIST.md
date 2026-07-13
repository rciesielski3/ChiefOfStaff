# Monitoring & Observability Checklist for PAIOS Knowledge Layer

**Task**: B3 - Finalize dedup & score logic, add monitoring/scoring documentation  
**Status**: DOCUMENTED  
**Date**: 2026-07-13  

---

## Overview

This document defines the monitoring strategy for the PAIOS Knowledge Layer persistence pipeline (M3 → Persist → Export). It covers logs to track, metrics to measure, alerts to configure, and daily/weekly health checks.

**Goals**:
1. Detect pipeline failures quickly
2. Monitor data quality (dedup effectiveness, score distribution)
3. Catch anomalies (sudden drops in articles, high error rate)
4. Provide operational visibility to team

---

## Logs to Monitor

### 1. n8n Workflow Execution Logs

**Location**: n8n UI → Executions → (workflow name)

**Workflows to monitor**:
- `PAIOS Daily Brief (M3)` — main article processing
- `Persist Articles to Knowledge Layer` — dedup and storage
- `Export Latest News to JSON` — export and publish

### 1.1 Persist Articles Workflow Logs

**What to check**: Every morning after 08:00 UTC (scheduled M3 run)

**Key log entries to look for**:

```
[Log Entry] "Persist Articles to Knowledge Layer" execution started
  Time: 2026-07-13T08:00:00Z
  Trigger: Automatic (M3 completion)
  Status: running
```

**Success indicators**:
```
[Log Entry] "Map Article Fields to Schema" — completed
  Input articles: 42
  Output articles: 42
  Status: success

[Log Entry] "Check for Duplicate (30-day window)" — completed
  Total processed: 42
  Duplicates found: 8 (19%)
  Unique articles: 34
  Status: success

[Log Entry] "INSERT: New article to canonical_articles" — completed
  Rows inserted: 34
  Status: success

[Log Entry] "UPDATE: Increment seenCount & score" — completed
  Rows updated: 8
  Status: success

[Log Entry] "Verify: Last 10 Articles" — completed
  Sample: [article1, article2, ...]
  Status: success

[Log Entry] "Persist Articles to Knowledge Layer" execution ended
  Total time: 2.3s
  Status: success
```

**Error indicators** (critical):
```
[Error] "Check for Duplicate" query failed
  Error: Connection timeout
  Action: INVESTIGATE immediately

[Error] "INSERT: New article to canonical_articles" failed
  Error: Data validation error
  Details: Missing required field 'title'
  Action: Review article mapping, check M3 output

[Error] "UPDATE: Increment seenCount & score" failed
  Error: Row not found (ID mismatch)
  Action: Investigate dedup logic

[Error] Execution ended with errors
  Total errors: 2
  Action: Review all error logs above
```

### 1.2 Export Latest News Workflow Logs

**What to check**: Every morning after 08:05 UTC

**Key log entries to look for**:

```
[Log Entry] "Export Latest News to JSON" execution started
  Time: 2026-07-13T08:05:00Z
  Trigger: Cron schedule (daily 08:05 UTC)
  Status: running
```

**Success indicators**:
```
[Log Entry] "Query: Top Articles (score >= 50)" — completed
  Total rows: 87
  Score >= 50: 87 (100%)
  Status: success

[Log Entry] "Transform to Export Schema" — completed
  Transformed articles: 87
  Status: success

[Log Entry] "Build Export Object" — completed
  Output: {"date": "2026-07-13", "updatedAt": "...", "articles": [...]}
  Status: success

[Log Entry] "Convert to JSON String" — completed
  File size: 156 KB
  Status: success

[Log Entry] "Write latest.json" — completed
  Path: qa-news/public/latest.json
  Bytes written: 156000
  Status: success

[Log Entry] "Git Commit Export" — completed
  Commit: 7a3b9c1 (chore(data): export latest articles [skip ci])
  Status: success

[Log Entry] "Log Export Complete" — completed
  Articles exported: 87
  Status: success

[Log Entry] "Export Latest News to JSON" execution ended
  Total time: 1.8s
  Status: success
```

**Error indicators** (critical):
```
[Error] "Query: Top Articles" failed
  Error: Data Table unreachable
  Action: Check n8n permissions, DB connection

[Error] "Write latest.json" failed
  Error: Permission denied (qa-news/public/)
  Action: Check file permissions, git user credentials

[Error] "Git Commit Export" failed
  Error: authentication failure
  Action: Renew git credentials in n8n

[Warning] "Write latest.json" — file size unexpectedly small
  Expected: 100+ KB (based on daily baseline)
  Actual: 12 KB
  Action: Investigate if query or transform lost articles
```

### 1.3 M3 Workflow Logs (Upstream)

**What to check**: Before running export (should be done by M3 task owner)

**Key indicators**:
- M3 completes successfully (articles processed, not errors)
- Articles reach persist sub-workflow (not filtered out upstream)
- Score distribution looks normal (not all articles score 0 or 100)

**Red flags**:
- M3 doesn't trigger persist sub-workflow (broken integration)
- M3 scores all articles as 0 (scoring algorithm broken)
- M3 outputs 0 articles (source feeds down)

---

## Metrics to Track

### 2.1 Persist Workflow Metrics

**Metric 1: Articles Persisted Per Day**

```
Query:
SELECT DATE(addedAt) as date, COUNT(*) as article_count
FROM canonical_articles
WHERE addedAt >= DATE_TRUNC('day', CURRENT_DATE - INTERVAL '30 days')
GROUP BY DATE(addedAt)
ORDER BY date DESC;
```

**Expected baseline**: 30–50 articles/day (varies by source availability)

**Red flags**:
- Suddenly 0 articles (M3 or persist broken)
- Suddenly <10 articles (sources down or scoring broken)
- Spike >200 articles (duplicate bug or accidental re-import)

**Action**:
- 0 articles → Check M3 execution logs immediately
- <10 articles → Review source feed status, M3 scoring
- >200 articles → Check for duplicate bug, review dedup logs

**Metric 2: Deduplication Rate**

```
Query:
SELECT
  DATE(addedAt) as date,
  COUNT(*) as total_records,
  COUNT(CASE WHEN seenCount = 1 THEN 1 END) as unique_articles,
  COUNT(CASE WHEN seenCount > 1 THEN 1 END) as duplicates,
  ROUND(COUNT(CASE WHEN seenCount > 1 THEN 1 END)::float / COUNT(*) * 100, 2) as dedup_rate_pct
FROM canonical_articles
WHERE addedAt >= DATE_TRUNC('day', CURRENT_DATE - INTERVAL '7 days')
GROUP BY DATE(addedAt)
ORDER BY date DESC;
```

**Expected baseline**: 10–30% (each article seen 1.1–1.4x on average)

**Red flags**:
- Suddenly 0% (dedup logic broken, sources distinct)
- Suddenly >60% (accidental over-deduplication or low source diversity)

**Action**:
- 0% → Review dedup query, check dedupKey generation
- >60% → Check if sources changed (or consolidated), review scoring

**Metric 3: Score Distribution**

```
Query:
SELECT
  CASE
    WHEN score <= 20 THEN 'Low (0-20)'
    WHEN score <= 50 THEN 'Moderate (21-50)'
    WHEN score <= 79 THEN 'High (51-79)'
    ELSE 'Critical (80+)'
  END as score_range,
  COUNT(*) as count,
  ROUND(COUNT(*)::float / (SELECT COUNT(*) FROM canonical_articles WHERE addedAt > now() - interval '7 days') * 100, 2) as pct
FROM canonical_articles
WHERE addedAt > now() - interval '7 days'
GROUP BY score_range
ORDER BY CASE WHEN score_range = 'Low (0-20)' THEN 0 WHEN score_range = 'Moderate (21-50)' THEN 1 WHEN score_range = 'High (51-79)' THEN 2 ELSE 3 END;
```

**Expected distribution** (weekly):
```
Low (0-20):      5-10%
Moderate (21-50): 10-20%
High (51-79):    60-75%
Critical (80+):   5-10%
```

**Red flags**:
- Low articles >20% → sources too noisy, scoring too generous
- High articles <40% → scoring too strict, not finding actionable content
- Critical articles >20% → scoring algorithm too aggressive

**Action**:
- Review M3 scoring algorithm
- Check source feed quality
- Adjust keyword weights if needed

**Metric 4: Average seenCount (Duplication Signal)**

```
Query:
SELECT
  DATE(addedAt) as date,
  ROUND(AVG(seenCount), 2) as avg_seen_count,
  MAX(seenCount) as max_seen_count
FROM canonical_articles
WHERE addedAt >= DATE_TRUNC('day', CURRENT_DATE - INTERVAL '7 days')
GROUP BY DATE(addedAt)
ORDER BY date DESC;
```

**Expected baseline**: 1.1–1.5 (articles seen 1–2x on average)

**Red flags**:
- Suddenly 1.0 (dedup broken, low source diversity)
- Suddenly >2.5 (accidental dedup over-matching or duplicate sources)

**Action**:
- 1.0 → Check dedup logic, source diversity
- >2.5 → Investigate possible duplicate sources or dedup bug

### 2.2 Export Workflow Metrics

**Metric 5: Articles Exported (in latest.json)**

```
Query:
SELECT
  DATE(updatedAt) as date,
  COUNT(*) as article_count,
  ROUND(AVG(score), 1) as avg_score,
  MIN(score) as min_score,
  MAX(score) as max_score
FROM (
  SELECT json_array_elements(articles)->>'updatedAt' as updatedAt,
         (json_array_elements(articles)->>'score')::integer as score
  FROM latest_json_view -- create view from latest.json
)
GROUP BY DATE(updatedAt)
ORDER BY date DESC;
```

*Note: This requires parsing latest.json; simpler approach: check file size daily*

**Expected baseline**: 60–100 articles/export

**Red flags**:
- Suddenly <20 articles (query too strict or data missing)
- Suddenly >150 articles (LIMIT not working or threshold too low)
- Article count doesn't grow (export not running)

**Action**:
- <20 articles → Check export query, verify persist running
- >150 articles → Check LIMIT clause, verify score >= 50 filter
- No change → Check export cron schedule

**Metric 6: Export File Metrics**

```
Metric: latest.json file size and update frequency

Baseline:
  - File size: 100–200 KB (varies with article count)
  - Update time: 08:05–08:10 UTC (daily)
  - Format: valid JSON

Red flags:
  - File size <20 KB (articles missing)
  - File size >500 KB (articles not filtered)
  - File not updated in 24h (export cron broken)
  - Invalid JSON format (export transform broken)
```

**Monitoring approach**:
```bash
# Check file size and last modified time (daily at 08:15)
ls -lh qa-news/public/latest.json

# Expected output:
# -rw-r--r-- 1 user staff 145K Jul 13 08:05 latest.json

# Parse and validate JSON
jq '.' qa-news/public/latest.json > /dev/null && echo "Valid JSON" || echo "Invalid JSON"

# Count articles
jq '.articles | length' qa-news/public/latest.json

# Check date metadata
jq '.date, .updatedAt' qa-news/public/latest.json
```

**Metric 7: Export Query Performance**

```
Track in n8n logs:
  - Query execution time (target: <1s)
  - Data Table response time (target: <500ms)
  - File write time (target: <500ms)
  - Git commit time (target: <2s)

Query:
SELECT
  "Query: Top Articles" as node,
  2.3s as execution_time,
  'success' as status
UNION ALL
SELECT "Write latest.json", 0.5s, 'success'
UNION ALL
SELECT "Git Commit Export", 1.8s, 'success';

Red flags:
  - Any node takes >5s (slow database or filesystem)
  - Query time increasing over time (indexing issue?)
  - File write time increasing (disk I/O issue?)
```

---

## Alerts to Set Up

### 3.1 Critical Alerts (Action Required Immediately)

**Alert 1: Persist Workflow Failed**

Condition:
```
Persist workflow execution status = FAILURE
OR
Persist workflow execution status = ERROR
Time: Any time after 08:00 UTC
```

Action:
1. Check n8n execution logs (see section 1.1)
2. Identify specific node that failed
3. If M3 output issue → escalate to M3 owner
4. If data Table issue → check database connectivity, permissions
5. If dedup logic issue → review recent changes to persist workflow
6. Notify ops channel: "@ops Article persist failed at [TIME]. Impact: Knowledge Layer not updating."

**Alert 2: Export Workflow Failed**

Condition:
```
Export workflow execution status = FAILURE
Time: After 08:05 UTC
```

Action:
1. Check n8n execution logs (see section 1.2)
2. Verify persist workflow ran successfully (Alert 1)
3. If query issue → check data Table status
4. If file write issue → check file permissions, git credentials
5. If git commit issue → renew git tokens in n8n
6. Notify ops channel: "@ops Article export failed at [TIME]. Impact: latest.json not updated."

**Alert 3: Persist Workflow Not Triggered**

Condition:
```
Persist workflow was not triggered at 08:00 UTC (5min grace)
OR
M3 workflow completed but persist not called
```

Action:
1. Check M3 workflow completion logs
2. Verify persist sub-workflow is integrated into M3
3. Check M3 conditional logic (should always call persist)
4. If integration missing → escalate to M3 owner
5. Notify ops: "@ops Persist not called by M3. Integration issue?"

### 3.2 Warning Alerts (Investigate Today)

**Alert 4: Deduplication Rate Anomaly**

Condition:
```
Dedup rate today < 5% (expected: 10-30%)
OR
Dedup rate today > 50% (expected: 10-30%)
```

Action:
1. Run dedup rate query (section 2.1, Metric 2)
2. If <5% → Check source diversity, verify dedupKey generation
3. If >50% → Check if sources consolidated, review dedupKey match logic
4. Document investigation in Slack thread

**Alert 5: Score Distribution Anomaly**

Condition:
```
High-score articles (51-79) < 40% of weekly total
OR
Low-score articles (0-20) > 20% of weekly total
```

Action:
1. Run score distribution query (section 2.1, Metric 3)
2. If too few high-score → Review M3 scoring, increase keyword weights
3. If too many low-score → Review source feeds, disable noisy feeds
4. Document findings; consider scoring algorithm adjustment

**Alert 6: Sudden Article Count Change**

Condition:
```
Articles persisted today < (3-day moving avg * 0.5)
OR
Articles persisted today > (3-day moving avg * 2.0)
```

Action:
1. Check M3 execution logs → count articles processed
2. If lower → sources might be down, check feeds
3. If higher → possible duplicate bug or data re-import
4. Escalate to M3 owner if trend continues

### 3.3 Informational Alerts (Track Metrics Only)

**Alert 7: Daily Report**

Condition:
```
Every day at 08:15 UTC (after export completes)
```

Action:
1. Generate daily metrics report (see section 4.1)
2. Post to #paios-operations Slack channel
3. Format:
   ```
   Daily Knowledge Layer Report — 2026-07-13
   ─────────────────────────────────────────
   Articles Persisted:    42
   Duplication Rate:      18%
   Articles Exported:     87
   Avg Score:           67.2
   Status: ✓ Healthy
   ```

---

## Daily Health Checks

**Time**: 08:15 UTC (15 minutes after export completes)  
**Owner**: DevOps / Operations team  
**Duration**: 5–10 minutes

### Daily Checklist

- [ ] **Step 1: Verify Export Completed**
  ```bash
  # Check if latest.json was updated in the last 10 minutes
  ls -l qa-news/public/latest.json
  date; stat -c %y qa-news/public/latest.json
  
  # Expected: "Jul 13 08:05" or "08:06" (within 10min window)
  ```

- [ ] **Step 2: Validate JSON Format**
  ```bash
  # Ensure latest.json is valid JSON
  jq '.' qa-news/public/latest.json > /dev/null
  echo $? # Should print 0 (success)
  
  # Also validate structure
  jq '.date, .updatedAt, .articles | length' qa-news/public/latest.json
  ```

- [ ] **Step 3: Check Article Count**
  ```bash
  # Count articles in export
  ARTICLE_COUNT=$(jq '.articles | length' qa-news/public/latest.json)
  echo "Articles in latest.json: $ARTICLE_COUNT"
  
  # Expected: 60–100 articles
  # Red flag: <20 or >150
  ```

- [ ] **Step 4: Spot-Check Article Quality**
  ```bash
  # Display first 3 articles
  jq '.articles[] | {title, score, source} | limit(3; .[])' qa-news/public/latest.json
  
  # Verify:
  # - All titles are readable (not truncated/mangled)
  # - All scores >= 50
  # - All sources are valid
  # - All URLs are valid (start with http)
  ```

- [ ] **Step 5: Check Persist & Export Logs**
  ```bash
  # View n8n execution logs for last 2 workflows
  # Login to n8n UI → Executions tab
  
  # Look for:
  # - Persist workflow status: SUCCESS (green)
  # - Export workflow status: SUCCESS (green)
  # - Execution time: <5s each
  # - No error messages
  ```

- [ ] **Step 6: Verify Git Commit Created**
  ```bash
  # Check recent commits in qa-news repo
  cd qa-news
  git log --oneline -5
  
  # Expected last commit: "chore(data): export latest articles [skip ci]"
  # Expected author: n8n workflow user
  # Expected time: 08:05-08:10 UTC
  ```

- [ ] **Step 7: Check Daily Metrics**
  ```bash
  # Log article persistence count
  SELECT COUNT(*) as articles_today
  FROM canonical_articles
  WHERE DATE(addedAt) = CURRENT_DATE;
  
  # Expected: 30–50 articles
  # Log dedup rate
  SELECT 
    COUNT(CASE WHEN seenCount > 1 THEN 1 END)::float / COUNT(*) * 100 as dedup_rate
  FROM canonical_articles
  WHERE DATE(addedAt) = CURRENT_DATE;
  
  # Expected: 10–30%
  ```

- [ ] **Step 8: Spot-Check Database Records**
  ```bash
  # Query last 5 articles in canonical_articles
  SELECT id, title, score, seenCount, source, addedAt
  FROM canonical_articles
  ORDER BY addedAt DESC
  LIMIT 5;
  
  # Verify:
  # - addedAt timestamps are recent (within 24h)
  # - score values are 0-100
  # - seenCount is >=1
  # - source is recognized value
  ```

### Daily Checklist Template (Markdown)

```markdown
## Daily Health Check — [DATE]

**Time**: 08:15 UTC  
**Checked by**: [YOUR NAME]  

- [ ] latest.json updated in last 10 minutes
- [ ] JSON format valid
- [ ] Article count: ___ (expected 60-100)
- [ ] Sample articles look good (titles, scores, sources)
- [ ] Persist workflow status: SUCCESS
- [ ] Export workflow status: SUCCESS
- [ ] Git commit created: `chore(data): export latest articles`
- [ ] Articles persisted today: ___ (expected 30-50)
- [ ] Dedup rate: ___% (expected 10-30%)

**Status**: ✓ Healthy | ⚠ Warning | ✗ Critical

**Notes**: [Any anomalies or observations]
```

---

## Weekly Health Checks

**Time**: Monday 09:00 UTC  
**Owner**: DevOps / Knowledge Layer owner  
**Duration**: 20–30 minutes

### Weekly Checklist

- [ ] **Step 1: Score Distribution Analysis**
  ```sql
  -- Run score distribution query (see Metric 3)
  -- Record percentages for each range
  -- Compare to baseline (Low 5-10%, Moderate 10-20%, High 60-75%, Critical 5-10%)
  -- Document any deviations
  ```

- [ ] **Step 2: Dedup Effectiveness Review**
  ```sql
  -- Run dedup metrics query (see Metric 2)
  -- Calculate 7-day average dedup rate
  -- Compare to baseline (10-30%)
  -- Look for trends (increasing/decreasing)
  ```

- [ ] **Step 3: Article Quality Spot-Check**
  ```bash
  # Sample 10 random articles from latest.json
  jq '.articles | sort_by(.publishedAt) | reverse | limit(10; .[])' qa-news/public/latest.json
  
  # For each article:
  # - Read title and summary
  # - Verify score is appropriate (high = valuable, low = less valuable)
  # - Check URL is valid and accessible
  # - Note any quality issues
  ```

- [ ] **Step 4: Source Diversity Analysis**
  ```sql
  -- Check which sources contribute most articles
  SELECT source, COUNT(*) as article_count
  FROM canonical_articles
  WHERE addedAt >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '1 week')
  GROUP BY source
  ORDER BY article_count DESC;
  
  -- Verify:
  # - Multiple sources represented
  # - No single source dominates >50%
  # - All sources producing high-quality articles
  ```

- [ ] **Step 5: Keyword Coverage Analysis**
  ```sql
  -- Check which categories are well-represented
  SELECT category, COUNT(*) as article_count
  FROM canonical_articles
  WHERE addedAt >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '1 week')
    AND score >= 50
  GROUP BY category
  ORDER BY article_count DESC;
  
  -- Expected distribution:
  # - test-automation: 25-35%
  # - ai: 15-25%
  # - engineering: 20-30%
  # - qa-practice: 15-25%
  # - tooling: 10-20%
  ```

- [ ] **Step 6: Export Consistency Check**
  ```bash
  # Verify latest.json has been updated every day
  cd qa-news/public
  
  for i in {0..6}; do
    DATE=$(date -u -d "$i days ago" +%Y-%m-%d)
    # Check if latest.json was updated on that date
    # (This assumes versioned exports; if latest.json only has current, skip)
    echo "Checking $DATE..."
  done
  
  # Expected: 7 successful exports in last 7 days
  ```

- [ ] **Step 7: Performance Trend Analysis**
  ```sql
  -- Check execution times over past week
  SELECT
    DATE(execution_time) as date,
    ROUND(AVG(duration_seconds), 2) as avg_persist_time,
    MAX(duration_seconds) as max_persist_time
  FROM workflow_executions
  WHERE workflow_name = 'Persist Articles'
    AND execution_time >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '1 week')
  GROUP BY DATE(execution_time)
  ORDER BY date DESC;
  
  -- Alert if any day's avg > 5s (possible slowdown)
  ```

- [ ] **Step 8: Error Log Review**
  ```bash
  # Check n8n execution logs for any errors
  # (Manually in n8n UI)
  
  # Look for:
  # - Failed executions
  # - Warnings or retries
  # - Permission errors
  # - Database connectivity issues
  
  # Document any patterns
  ```

- [ ] **Step 9: GitHub Pages Verification**
  ```bash
  # Verify qa-news site is live and showing latest articles
  curl https://[your-github-pages-url]/latest.json | jq '.articles | length'
  
  # Should return article count (60-100)
  # If fails, check GitHub Pages deployment status
  ```

- [ ] **Step 10: Documentation Review**
  ```markdown
  - [ ] DEDUP-STRATEGY.md accurate
  - [ ] SCORING-GUIDE.md reflects current algorithm
  - [ ] MONITORING-CHECKLIST.md (this file) up-to-date
  - [ ] Any deviations from documented behavior documented
  - [ ] Future enhancements noted
  ```

### Weekly Summary Report

```markdown
## Weekly Operations Report — [WEEK OF DATE]

**Reporting Period**: [Mon - Sun]  
**Reported by**: [YOUR NAME]  

### Metrics Summary
- **Articles Persisted**: ___
- **Avg Dedup Rate**: ___% (baseline: 10-30%)
- **Articles Exported**: ___
- **Avg Score**: ___ (baseline: 60-75)
- **Exports Completed**: 7/7 (100%)

### Score Distribution (7-day)
- Low (0-20): ___% 
- Moderate (21-50): ___%
- High (51-79): ___% (target: 60-75%)
- Critical (80+): ___% (target: 5-10%)

### Source Breakdown
- Top source: [SOURCE] (___%)
- Diversity: Good | Fair | Poor

### Issues & Resolutions
- [Issue 1]: [Description] → [Resolution]
- [Issue 2]: [Description] → [Resolution]

### Alerts Triggered
- [Alert 1]: [Time] → [Action taken]

### Action Items for Next Week
- [ ] [Action]
- [ ] [Action]

### Status: ✓ Healthy | ⚠ Warning | ✗ Critical
```

---

## Escalation Procedures

### Level 1: Automated Alert (No Action Required if Resolved)

**Trigger**: Metric threshold exceeded, but self-resolved within 30 minutes

**Example**: Export took 45s instead of 30s (slow), but next export normal

**Action**: Document in weekly report, monitor trend

### Level 2: Warning Alert (Investigate Today)

**Trigger**: Persistent issue after 30 minutes

**Example**: Persist workflow failing 2+ times in a row

**Action**:
1. Check logs (section 1)
2. Run diagnostic queries (section 2)
3. Document findings
4. Notify #paios-operations: "Knowledge Layer warning: [Issue]"
5. Implement fix or escalate to Level 3

### Level 3: Critical Alert (Immediate Response)

**Trigger**: Production impact (export not running, data loss, security issue)

**Example**: Export workflow completely broken, latest.json not updating

**Action**:
1. Page on-call engineer
2. Check logs immediately
3. Activate incident response
4. Post to #paios-critical Slack channel
5. Restore service within 1 hour target
6. Post-incident review (next day)

---

## Tools & Infrastructure

### Recommended Monitoring Tools

| Tool | Purpose | Setup Time |
|---|---|---|
| n8n native logs | Workflow execution logs | Built-in |
| Datadog (optional) | Centralized logging, alerting | 1-2 hours |
| GitHub Actions status | CI/CD health (git commits) | Built-in |
| PagerDuty (optional) | On-call alerting | 1-2 hours |
| Grafana (optional) | Metrics dashboards | 2-4 hours |

### n8n Built-in Monitoring

**Features**:
- Execution history with logs
- Success/failure status
- Execution duration
- Error notifications
- Webhook for custom alerts

**Setup**:
1. In n8n UI, go to Workflows → [Workflow name]
2. Click "Executions" tab
3. View recent runs, check for errors
4. Set up "Active" toggle to enable/disable workflow

**Limitations**:
- No external alerting (only UI)
- No cross-workflow dashboards
- Limited retention (~30 days)

**Recommendation**: Use n8n logs as primary, consider Datadog for production.

---

## References

- **DEDUP-STRATEGY.md**: Deduplication logic and 30-day window details
- **SCORING-GUIDE.md**: Score ranges, thresholds, and algorithm
- **PERSISTENCE-PIPELINE.md**: Architecture overview and field mapping
- **data-schema.md**: canonical_articles table schema
- **n8n Workflows**:
  - `PAIOS Daily Brief` (M3)
  - `Persist Articles to Knowledge Layer` (B2)
  - `Export Latest News to JSON` (B2)

---

## Version History

- **v1.0** (2026-07-13): Initial monitoring & observability documentation
  - Logs to monitor (persist & export workflows)
  - 7 key metrics to track
  - 3 critical alerts, 3 warning alerts
  - Daily checklist (8 steps, 5-10 min)
  - Weekly checklist (10 steps, 20-30 min)
  - Escalation procedures (3 levels)
  - Tools and infrastructure setup

---

## Contact & Support

**Questions about monitoring?**
- Slack: #paios-operations
- Docs: Check PERSISTENCE-PIPELINE.md, DEDUP-STRATEGY.md, SCORING-GUIDE.md

**To update this checklist**:
- Modify workflows/MONITORING-CHECKLIST.md
- Commit with message: `docs(monitoring): update checklist [item]`
- Notify team in #paios-operations

