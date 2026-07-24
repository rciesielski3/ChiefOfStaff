#!/bin/bash

# wait-for-pr-merge.sh
# Polls GitHub API to wait for a PR to merge with exponential backoff
#
# Usage: wait-for-pr-merge.sh <PR_NUMBER>
# Environment: GH_TOKEN (GitHub token with repo access)
#
# Exit codes:
#   0 = PR merged successfully or PR doesn't exist (skip)
#   1 = Timeout (>300s) or API error
#
# Exponential backoff: 2s, 4s, 8s, 16s, 32s, 64s, 128s, 128s, ... (max 300s total)

set -e

# Validate input
if [ -z "$1" ]; then
  echo "❌ ERROR: PR_NUMBER argument required"
  echo "Usage: $0 <PR_NUMBER>"
  exit 1
fi

if [ -z "$GH_TOKEN" ]; then
  echo "❌ ERROR: GH_TOKEN environment variable required"
  exit 1
fi

PR_NUMBER="$1"
REPO="rciesielski3/ChiefOfStaff"
MAX_WAIT_SECONDS=300
ELAPSED_SECONDS=0
BACKOFF_SECONDS=2

# Get PR info from GitHub API
echo "Polling GitHub API for PR #$PR_NUMBER status..."

while [ $ELAPSED_SECONDS -lt $MAX_WAIT_SECONDS ]; do
  # Check if PR is merged
  PR_INFO=$(curl -s \
    -H "Authorization: token $GH_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/$REPO/pulls/$PR_NUMBER")

  # Check if API response is valid JSON
  if ! echo "$PR_INFO" | jq . >/dev/null 2>&1; then
    echo "❌ ERROR: Invalid API response for PR #$PR_NUMBER"
    exit 1
  fi

  # Extract merged status and state
  MERGED=$(echo "$PR_INFO" | jq -r '.merged // false')
  STATE=$(echo "$PR_INFO" | jq -r '.state // "unknown"')

  # Check if PR doesn't exist (404 error)
  if echo "$PR_INFO" | jq -e '.message == "Not Found"' >/dev/null 2>&1; then
    echo "⚠️  SKIP: PR #$PR_NUMBER not found (may not have been created)"
    exit 0
  fi

  # Check if PR is merged
  if [ "$MERGED" = "true" ]; then
    echo "✅ SUCCESS: PR #$PR_NUMBER merged successfully"
    exit 0
  fi

  # Check if PR is closed without merging
  if [ "$STATE" = "closed" ] && [ "$MERGED" = "false" ]; then
    echo "⚠️  SKIP: PR #$PR_NUMBER closed without merging (no changes needed)"
    exit 0
  fi

  # PR still open, check if next wait would exceed timeout
  if [ $((ELAPSED_SECONDS + BACKOFF_SECONDS)) -ge $MAX_WAIT_SECONDS ]; then
    # Next wait would exceed max, break before sleeping
    break
  fi

  echo "⏳ PR #$PR_NUMBER still pending (state: $STATE, wait ${BACKOFF_SECONDS}s)..."
  sleep "$BACKOFF_SECONDS"
  ELAPSED_SECONDS=$((ELAPSED_SECONDS + BACKOFF_SECONDS))

  # Exponential backoff: double each time, cap at 128 seconds
  if [ $BACKOFF_SECONDS -lt 128 ]; then
    BACKOFF_SECONDS=$((BACKOFF_SECONDS * 2))
  fi
done

# Timeout reached
echo "❌ ERROR: Timeout waiting for PR #$PR_NUMBER to merge (>300 seconds)"
exit 1
