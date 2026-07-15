# Separate Reusable Notification Workflow Design

**Status:** Approved for implementation  
**Date:** 2026-07-15  
**Approach:** Separate GitHub Actions workflow for smart notifications

---

## Overview

Extract Telegram notifications from inline workflow steps into a standalone, reusable notification workflow. Enable smart success notifications that alert on data anomalies (article count changes, zero data) while keeping noise low on routine successful runs.

## Goal

1. **Reusability:** Both daily-brief and export-latest-news workflows can trigger the same notification handler
2. **Smart alerts:** Success notifications only fire when data metrics change meaningfully or indicate problems
3. **Separation of concerns:** Notification logic separate from article processing logic
4. **Production visibility:** Detect silent failures (pipeline runs but produces no data)

## Architecture

### Components

**1. Separate Notification Workflow (`notify.yml`)**
- New standalone workflow triggered by `workflow_run` events from daily-brief and export-latest-news
- Receives completion status and metrics from parent workflows via `github.event.workflow_run` context
- Implements smart notification logic:
  - **Failure:** Always alert with error context
  - **Success:** Alert only if article/export count changed >20% OR equals zero
- Respects `ENABLE_NOTIFICATIONS` flag (can be disabled for testing)
- `continue-on-error: true` so notification failures don't block parent workflows

**2. Modified daily-brief.yml**
- Remove inline Telegram notification step
- Add step to capture article count from `canonical_articles.ndjson` before workflow completes
- Trigger `notify.yml` workflow (via `workflow_run` on completion) passing:
  - Workflow name: "Daily Brief"
  - Status: success/failure
  - Article count (for smart notifications)
  - Previous article count (stored in workflow artifact or GitHub variable)

**3. Modified export-latest-news.yml**
- Remove inline Telegram notification step
- Add step to capture export count from `latest.json` (number of articles exported)
- Trigger `notify.yml` workflow (via `workflow_run` on completion) passing:
  - Workflow name: "Export Latest News"
  - Status: success/failure
  - Export count (for smart notifications)

### Data Flow

```
daily-brief.yml
  ├─ Fetches articles
  ├─ Commits to canonical_articles.ndjson
  ├─ Counts articles
  └─ Completes → triggers notify.yml workflow_run
      
notify.yml (receives workflow_run event from daily-brief)
  ├─ Checks status
  ├─ On failure: Send alert
  ├─ On success: Compare count vs threshold
  │   ├─ If count changed >20%: Send "✅ Daily brief: 1,087 articles"
  │   ├─ If count = 0: Send alert "⚠️ Daily brief: 0 articles (check RSS feeds)"
  │   └─ If count stable: Skip notification
  └─ Completes

export-latest-news.yml
  ├─ Exports top 50 articles to latest.json
  ├─ Commits to qa-news repo
  ├─ Counts exported articles
  └─ Completes → triggers notify.yml workflow_run
      
notify.yml (receives workflow_run event from export-latest-news)
  ├─ Similar logic with export count
  └─ Completes
```

### Threshold Rules

**Article Count (daily-brief):**
- Failure: Always notify
- Success with count = 0: Always notify (silent failure)
- Success with count changed >20% from previous run: Notify
- Success with count stable (≤20% change): Silent (no notification)

**Export Count (export-latest-news):**
- Failure: Always notify
- Success with count = 0: Always notify (no articles exported)
- Success with count > 0: Always notify (confirms export completed and data pushed)

**Rationale:** Export workflow runs less frequently (only after daily-brief succeeds), so all successful exports should be visible. Article count is more volatile, so only notify on significant changes to avoid noise.

## Implementation Details

### notify.yml Structure

```yaml
name: Notify Telegram
on:
  workflow_run:
    workflows: ["Daily Brief", "Export Latest News"]
    types: [completed]

jobs:
  notify:
    runs-on: ubuntu-latest
    env:
      ENABLE_NOTIFICATIONS: true
    steps:
      - name: Determine Workflow
        id: determine
        run: |
          echo "workflow_name=${{ github.event.workflow_run.name }}" >> $GITHUB_OUTPUT
          echo "status=${{ github.event.workflow_run.conclusion }}" >> $GITHUB_OUTPUT
      
      - name: Send Notification (Failure)
        if: |
          steps.determine.outputs.status == 'failure' &&
          env.ENABLE_NOTIFICATIONS == 'true'
        continue-on-error: true
        run: |
          curl -X POST https://api.telegram.org/bot${{ secrets.TELEGRAM_BOT_TOKEN }}/sendMessage \
            -d chat_id=${{ secrets.TELEGRAM_CHAT_ID }} \
            -d text="⚠️ Workflow failed: ${{ steps.determine.outputs.workflow_name }}"
      
      - name: Send Notification (Smart Success)
        if: |
          steps.determine.outputs.status == 'success' &&
          env.ENABLE_NOTIFICATIONS == 'true'
        continue-on-error: true
        run: |
          # Logic to check article/export count and compare to threshold
          # Only send if count changed >20% or equals 0
          # (Implementation details in task plan)
```

### daily-brief.yml Changes

- Remove step: "Notify Telegram on Failure"
- Add step before workflow completes to log article count
- notify.yml is automatically triggered by workflow_run event on daily-brief completion

### export-latest-news.yml Changes

- Remove step: "Notify Telegram on Failure"
- Add step before workflow completes to log export count
- notify.yml is automatically triggered by workflow_run event on export-latest-news completion

## Error Handling

- **Notification fails:** `continue-on-error: true` ensures parent workflows are not blocked
- **Status check fails:** Workflow proceeds (notification layer is optional)
- **Telegram token missing:** Notification skipped, parent workflow unaffected
- **ENABLE_NOTIFICATIONS = false:** Both success and failure notifications skipped

## Testing

**Test Case 1: Failure Alert**
- Trigger daily-brief with invalid RSS feeds
- Verify notify.yml fires and sends alert to Telegram

**Test Case 2: Success with Count Increase**
- Run daily-brief, get 1,100 articles
- Previous run had 1,000 articles (>20% change)
- Verify notify.yml sends success message with count

**Test Case 3: Success with Count Stable**
- Run daily-brief, get 1,050 articles
- Previous run had 1,000 articles (<20% change)
- Verify notify.yml does NOT send notification

**Test Case 4: Success with Zero Articles**
- Run daily-brief, get 0 articles
- Verify notify.yml sends alert despite "success" status

**Test Case 5: Notifications Disabled**
- Set ENABLE_NOTIFICATIONS = false
- Run daily-brief with failure
- Verify no Telegram message sent, workflow completes successfully

## Backward Compatibility

- Existing daily-brief.yml and export-latest-news.yml continue to work
- Inline notification steps removed (no longer needed)
- notify.yml is purely additive (new workflow)
- No breaking changes to existing workflows

## Future Enhancements (Out of Scope)

- Support for multiple notification channels (Slack, Discord, email)
- Configurable thresholds per workflow
- Metric aggregation (daily summaries instead of per-run alerts)
- Alert severity levels (critical vs info)

---

## Summary

**Deliverables:**
1. New `.github/workflows/notify.yml` workflow with smart notification logic
2. Modified `daily-brief.yml` (remove inline Telegram, add article count logging)
3. Modified `export-latest-news.yml` (remove inline Telegram, add export count logging)

**Benefits:**
- Reusable notification handler (can be extended to other workflows)
- Smart alerts that detect silent failures and data anomalies
- Low noise on routine success
- Separation of notification logic from article processing
- Full visibility into production data flow

**Testing:** 5 test cases covering all scenarios (failure, success with variance, success with stability, zero data, disabled notifications)
