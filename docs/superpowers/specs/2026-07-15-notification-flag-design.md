# Notification Flag System Design

**Status:** Design Approved  
**Approach:** Environment Variable Flag  
**Date:** 2026-07-15

---

## Overview

Add an optional notification flag system to GitHub Actions workflows so Telegram notifications can be toggled without blocking the pipeline. Notifications that fail will not halt execution.

## Goal

Enable real data to flow to production even when Telegram credentials are invalid or notifications are disabled. Operators can intentionally disable notifications (e.g., for testing) without pipeline failure.

## Design

### Architecture

**Notification Flag Pattern:**
```yaml
env:
  ENABLE_NOTIFICATIONS: true  # Toggle notifications: true/false

jobs:
  notify:
    - name: Send Telegram Notification
      if: env.ENABLE_NOTIFICATIONS == 'true'
      continue-on-error: true  # Don't block if Telegram fails
      run: |
        # Telegram notification code
```

### Components

1. **Environment Variable:** `ENABLE_NOTIFICATIONS` (default: `true`)
   - Set at workflow level (applies to all steps)
   - Can be overridden per-step if needed
   - Clear in workflow file for operator visibility

2. **Conditional Step:** `if: env.ENABLE_NOTIFICATIONS == 'true'`
   - Only executes Telegram notification if enabled
   - Step skips silently if disabled (no log entry)

3. **Error Handling:** `continue-on-error: true`
   - If notification fails (invalid token, network error), step reports failure
   - Pipeline continues to next step
   - Failure logged but doesn't halt workflow

### Data Flow

```
Workflow starts
  ↓
ENABLE_NOTIFICATIONS check
  ├─ true: Attempt Telegram notification
  │   ├─ Success: Log success, continue
  │   ├─ Failure: Log error (continue-on-error), continue
  └─ false: Skip notification, continue
  ↓
Next workflow step (export, deploy, etc.)
```

### Affected Workflows

- `.github/workflows/daily-brief.yml` — Add flag + condition
- `.github/workflows/export-latest-news.yml` — Add flag + condition
- `.github/workflows/daily-brief-notify.yml` — Add flag (if applicable)

### Implementation Steps

For each workflow:
1. Add `ENABLE_NOTIFICATIONS: true` to `env:` section
2. Wrap Telegram notification step with `if: env.ENABLE_NOTIFICATIONS == 'true'`
3. Add `continue-on-error: true` to notification step
4. Test with flag = true (notifications enabled)
5. Test with flag = false (notifications disabled)

### Testing

- **Test 1:** Run workflow with `ENABLE_NOTIFICATIONS: true`, valid token → notification succeeds
- **Test 2:** Run workflow with `ENABLE_NOTIFICATIONS: true`, invalid token → notification fails but pipeline continues
- **Test 3:** Run workflow with `ENABLE_NOTIFICATIONS: false` → notification skipped, pipeline continues

### Backward Compatibility

- Existing workflows continue to work (flag defaults to `true`)
- No breaking changes
- Users can disable notifications by editing workflow file

### Future Enhancements (Out of Scope)

- Parameterize `ENABLE_NOTIFICATIONS` via workflow dispatch input
- Support multiple notification channels (Slack, Discord, etc.)
- Dynamic enable/disable via GitHub secrets
