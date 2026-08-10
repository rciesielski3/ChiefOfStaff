#!/bin/bash

# wait-for-pr-merge.sh
# Polls GitHub API to wait for a PR to merge with exponential backoff
#
# Usage: wait-for-pr-merge.sh <PR_NUMBER> [TIMEOUT_SECONDS]
# Environment: GH_TOKEN (GitHub token with repo access)
#
# Exit codes:
#   0 = PR merged successfully
#   1 = Timeout (>timeout seconds)
#   2 = Merge conflict (mergeable: false)
#   3 = PR closed without merging
#
# BACKWARD COMPATIBILITY NOTE: Previous version returned 0 for "closed without merging".
# This version returns 3 to distinguish permanent failure (PR closed) from success.
# If export-qa-news.yml checks exit code, update it to handle 3 as failure.
#
# Exponential backoff: 2s, 4s, 8s, 16s, 32s, 64s, 128s, 128s, ... (capped at 128s)
# Rationale: GitHub Actions runner queues and test execution can exceed 5min;
# 20min timeout accommodates infrastructure delays while preventing indefinite waits

set -e

# Validate gh CLI authentication
if ! gh auth status &>/dev/null; then
  echo "❌ ERROR: gh CLI not authenticated. Run: gh auth login"
  exit 1
fi

# Validate input
if [ -z "$1" ]; then
  echo "❌ ERROR: PR_NUMBER argument required"
  echo "Usage: $0 <PR_NUMBER> [TIMEOUT_SECONDS]"
  exit 1
fi

PR_NUMBER="$1"
TIMEOUT="${2:-1200}"  # Default 20 minutes, configurable
POLL_INTERVAL=2
MAX_POLL_INTERVAL=128
ELAPSED=0

echo "🔄 Waiting for PR #$PR_NUMBER to merge (timeout: ${TIMEOUT}s)..."

while [ $ELAPSED -lt $TIMEOUT ]; do
  # Get PR details using gh CLI
  PR_STATE=$(gh api repos/rciesielski3/ChiefOfStaff/pulls/$PR_NUMBER \
    --jq '.state, .merged, .mergeable, .mergeable_state' 2>/dev/null || echo "error")

  # Validate response format (should be exactly 4 lines)
  LINES=$(echo "$PR_STATE" | wc -l)
  if [ "$LINES" -ne 4 ]; then
    echo "⚠️  Unexpected API response format (got $LINES lines, expected 4). Retrying..."
    MERGED="unknown"
  else
    STATE=$(echo "$PR_STATE" | sed -n '1p')
    MERGED=$(echo "$PR_STATE" | sed -n '2p')
    MERGEABLE=$(echo "$PR_STATE" | sed -n '3p')
    MERGEABLE_STATE=$(echo "$PR_STATE" | sed -n '4p')
  fi

  # Skip processing if response was malformed
  if [ "$MERGED" = "unknown" ]; then
    echo "⚠️  Unable to parse PR response, retrying..."
  # Check if PR merged successfully
  elif [ "$MERGED" = "true" ]; then
    echo "✅ PR #$PR_NUMBER merged successfully"
    exit 0
  # Check if PR was closed without merging
  elif [ "$STATE" = "closed" ]; then
    echo "❌ ERROR: PR #$PR_NUMBER was closed without merging"
    exit 3
  # Check for merge conflicts
  elif [ "$MERGEABLE" = "false" ]; then
    echo "❌ ERROR: PR #$PR_NUMBER has merge conflicts"
    exit 2
  fi

  # Check if blocked by status checks
  if [ "$MERGEABLE_STATE" = "blocked" ]; then
    # Get detailed check status - separate API calls for robustness
    HEAD_SHA=$(gh api repos/rciesielski3/ChiefOfStaff/pulls/$PR_NUMBER --jq '.head.sha' 2>/dev/null)
    if [ -n "$HEAD_SHA" ]; then
      CHECK_STATUS=$(gh api repos/rciesielski3/ChiefOfStaff/commits/$HEAD_SHA/status --jq '.state' 2>/dev/null || echo "unknown")
    else
      CHECK_STATUS="unknown"
    fi
    echo "⚠️  PR #$PR_NUMBER blocked by status checks (state: $CHECK_STATUS)"
  fi

  # Calculate next wait time (cap at MAX_POLL_INTERVAL)
  if [ $POLL_INTERVAL -ge $MAX_POLL_INTERVAL ]; then
    WAIT_TIME=$MAX_POLL_INTERVAL
  else
    WAIT_TIME=$POLL_INTERVAL
  fi

  # Check if we can wait before the next poll
  if [ $((ELAPSED + WAIT_TIME)) -lt $TIMEOUT ]; then
    echo "⏳ PR #$PR_NUMBER still pending (state: $STATE, mergeable: $MERGEABLE, elapsed: ${ELAPSED}s, next check in ${WAIT_TIME}s)..."
    sleep "$WAIT_TIME"
    ELAPSED=$((ELAPSED + WAIT_TIME))

    # Exponential backoff: double each time, cap at MAX_POLL_INTERVAL
    POLL_INTERVAL=$((POLL_INTERVAL * 2))
    if [ $POLL_INTERVAL -gt $MAX_POLL_INTERVAL ]; then
      POLL_INTERVAL=$MAX_POLL_INTERVAL
    fi
  else
    # Next wait would exceed timeout, exit loop
    break
  fi
done

# Timeout reached
echo "❌ ERROR: Timeout waiting for PR #$PR_NUMBER to merge (>${TIMEOUT} seconds)"
exit 1
