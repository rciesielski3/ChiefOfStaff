# Production Monitoring Strategy

**Status**: ✅ ACTIVE

**Monitoring Workflow**: `.github/workflows/daily-brief-notify.yml`

## Alert Points

### 1. Workflow Health Monitoring

**What**: Monitors success/failure status of Daily Brief workflow

| Alert | Condition | Trigger |
|-------|-----------|---------|
| ❌ Failure Alert | Daily Brief workflow fails | Immediate (workflow_run) |
| ⏱️ Timeout Alert | Workflow running for >30min | Scheduled health check |
| ✅ Success Confirmation | Workflow completes successfully | Scheduled health check |

**Detection Method**:
- Primary: `workflow_run` trigger on Daily Brief completion
- Secondary: Scheduled health check every 6 hours (`0 */6 * * *`)
- Data: GitHub Actions API (conclusion, status, createdAt)

**Response**:
- Telegram notification to `TELEGRAM_CHAT_ID`
- Visible in GitHub Actions UI
- Manual intervention available via workflow_dispatch

### 2. Data Quality Monitoring

**What**: Validates canonical_articles.ndjson integrity after workflow completion

| Check | Validation |
|-------|-----------|
| File Existence | Must exist in `data/canonical_articles.ndjson` |
| File Size | Must not be empty |
| Format Validity | Each line must be valid JSON (NDJSON) |
| Data Freshness | Must be updated within 12 hours |

**Detection Method**:
- Triggered after successful M3 (Daily Brief) completion
- Also runs on scheduled health check
- Validates NDJSON structure line-by-line

**Response**:
- ❌ If validation fails: Alert to Telegram + job fails
- ✅ If validation passes: Logged as success
- 📊 Metrics: Line count and file size tracked

### 3. Deployment Health Monitoring

**What**: Monitors Export Latest News (M4) and Deploy workflow success

**Detection Method**:
- workflow_run trigger on deploy.yml completion
- Validates artifact upload and deployment status

**Response**:
- Alert on deployment failure
- Confirmation on successful deployment

## Thresholds & Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Workflow Duration | >7 min | >15 min |
| Data File Size | <1 KB | <100 bytes |
| Failed Workflows | 1 in 7 days | >2 consecutive |
| Data Staleness | >24 hours | >48 hours |

## Monitoring Workflow Schedule

```
Every 6 hours:
  - Check Daily Brief workflow status
  - Validate data quality
  - Report health metrics

On Daily Brief completion:
  - Verify M3 → M4 transition
  - Validate exported data
  - Confirm deployment

Continuous:
  - GitHub Actions UI dashboard
  - Telegram notifications (failures only)
  - Historical logs retained
```

## Troubleshooting Guide

### Issue: Daily Brief Workflow Fails

**Symptoms**: Red X in GitHub Actions UI, Telegram alert

**Steps**:
1. Check GitHub Actions logs for specific error
2. Verify environment secrets are configured:
   - `TELEGRAM_BOT_TOKEN`
   - `TELEGRAM_CHAT_ID`
3. Verify network connectivity (RSS feeds may be rate-limited)
4. Check file permissions on data/ directory
5. Manual retry via workflow_dispatch

### Issue: Data Quality Validation Fails

**Symptoms**: NDJSON validation error, file missing

**Steps**:
1. Check canonical_articles.ndjson exists in data/
2. Verify file is not corrupted (try parsing with `jq`)
3. Check git status for uncommitted changes
4. Verify Daily Brief CLI ran successfully
5. Review Daily Brief workflow logs for data generation errors

### Issue: Deployment Not Triggered

**Symptoms**: M4 workflow not running after M3 completion

**Steps**:
1. Verify workflow_run trigger in export-latest-news.yml and deploy.yml
2. Check PR auto-merge completed successfully
3. Verify GitHub Actions permissions allow workflow_run
4. Review export-latest-news.yml logs
5. Manual trigger via workflow_dispatch if needed

### Issue: Stale Data in Production

**Symptoms**: canonical_articles.json not updated for >12 hours

**Steps**:
1. Check last successful Daily Brief run timestamp
2. Verify schedule is enabled: `0 8 * * *`
3. Check for workflow queue backlog
4. Verify GitHub Actions quota not exceeded
5. Manual trigger: Actions > Daily Brief > Run workflow

## Monitoring Dashboard

Access GitHub Actions Dashboard:
```
https://github.com/rafalciesielski/ChiefofStaff/actions
```

Key workflows to monitor:
- **Daily Brief** - M3 data fetch and persist
- **Export Latest News** - M4 export and artifact upload
- **Deploy** - Production deployment
- **Daily Brief Monitoring & Alerts** - Health checks

## Next Steps

1. ✅ Monitoring workflow deployed
2. ⏳ First automated run: 2026-07-16 08:00 UTC
3. 📊 Health checks: Every 6 hours starting immediately
4. 🔔 Alerts: Real-time via Telegram on failures
5. 📈 Metrics: Tracked and available in GitHub Actions

## Configuration Verification

✅ Monitoring workflow active at `.github/workflows/daily-brief-notify.yml`
✅ Workflow_run triggers configured on Daily Brief
✅ Health check schedule active
✅ Telegram notification secrets required (user responsibility)
✅ Data quality validation enabled
✅ Manual troubleshooting documentation complete
