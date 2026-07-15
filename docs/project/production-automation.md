# Production Automation Configuration

**Status**: ✅ ACTIVE

## Schedule Configuration

### Daily Brief Workflow
- **Trigger**: Scheduled cron: `0 8 * * *` (08:00 UTC daily)
- **Workflow File**: `.github/workflows/daily-brief.yml`
- **Last Modified**: 2026-07-14 (critical fixes applied)

### Pipeline Flow

```
08:00 UTC Trigger
    ↓
[Fetch Phase] - Daily Brief CLI
    - Fetch latest news via RSS feeds
    - Process canonical articles
    - Telegram notification (manual runs only)
    ↓
[Persist Phase] - Commit & PR
    - Commit to data/canonical_articles.ndjson
    - Create PR via automation/daily-brief branch
    - Enable auto-merge (squash)
    ↓
[Export Phase] - Export Latest News
    - Triggered via workflow_run (M3 PR merge)
    - Export canonical articles to JSON
    - Upload to public storage
    ↓
[Deploy Phase] - Production Deploy
    - Triggered via workflow_run (M4 completion)
    - Deploy knowledge layer
    - Update live public API
    ↓
Complete: ~5 minutes from trigger to live
```

## Timing & Performance

| Phase | Duration | Notes |
|-------|----------|-------|
| Fetch & Generate | ~1 min | RSS feed parsing, data processing |
| Persist & PR | ~1 min | Git commit, PR creation, auto-merge |
| Export | ~1.5 min | JSON export, artifact upload |
| Deploy | ~1.5 min | Deployment to production (VPS) |
| **Total** | **~5 min** | From scheduled trigger to live |

## Safety & Reliability

- **Concurrency Control**: `cancel-in-progress: false` — prevents workflow conflicts
- **PR-based Updates**: Creates PR instead of direct push for code review gate
- **Auto-merge Strategy**: Squash merge minimizes latency between M3 and M4
- **Workflow Sequencing**: Uses `workflow_run` triggers to ensure proper ordering
- **Error Handling**: Failure notifications to Telegram (manual runs only)

## Next Automated Run

**Scheduled**: 2026-07-16 08:00 UTC

## Configuration Verification

✅ Schedule trigger active in `.github/workflows/daily-brief.yml`
✅ Export trigger (workflow_run) active in `.github/workflows/export-latest-news.yml`
✅ Deploy trigger (workflow_run) active in `.github/workflows/deploy.yml`
✅ Concurrency control enabled
✅ PR auto-merge configured

## Manual Trigger

Available via GitHub Actions UI:
```
Actions > Daily Brief > Run workflow (workflow_dispatch)
```
