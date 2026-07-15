#!/bin/bash
#
# Vault Sync Script - Layer 2 Fallback for Merge Tracking
# Extracts commits tagged with #vault-track and syncs to Obsidian vault
#
# Layer 2 of 3-layer merge tracking strategy:
# - Layer 1: Git hook (automatic, triggered on merge)
# - Layer 2: Commit convention (#vault-track tag) + this sync script ← You are here
# - Layer 3: Manual reference (fallback when automation fails)
#
# Usage:
#   ./vault-sync.sh                  # Sync commits from last 24 hours
#   ./vault-sync.sh 2026-07-14       # Sync commits from specific date
#   ./vault-sync.sh 7                # Sync commits from last N days
#
# Commit message pattern to track:
#   feat: Add retry logic to API calls
#
#   #vault-track
#   #priority-high
#   #ChiefOfStaff
#
#   Fixes #42. Implements exponential backoff for transient errors.
#

set -e

# Configuration
VAULT_PATH="${VAULT_PATH:-/Users/rafalciesielski/Developer/obsidian-vault}"
REPO_PATH="${REPO_PATH:-.}"
DAILY_NOTES_DIR="$VAULT_PATH/10-Daily/work"

# Parse arguments
DAYS_BACK=1
if [ -n "$1" ]; then
    if [[ "$1" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        # Date format provided
        TARGET_DATE="$1"
        SINCE_DATE="$1"
    elif [[ "$1" =~ ^[0-9]+$ ]]; then
        # Number of days provided
        DAYS_BACK="$1"
        SINCE_DATE="$(date -d "$DAYS_BACK days ago" +%Y-%m-%d 2>/dev/null || date -v-${DAYS_BACK}d +%Y-%m-%d)"
    else
        echo "Usage: $0 [YYYY-MM-DD | N]"
        echo "  YYYY-MM-DD: Specific date to sync"
        echo "  N: Number of days back to sync"
        exit 1
    fi
else
    # Default: last 24 hours
    SINCE_DATE="$(date -d "1 day ago" +%Y-%m-%d 2>/dev/null || date -v-1d +%Y-%m-%d)"
fi

# Verify vault path
if [ ! -d "$VAULT_PATH" ]; then
    echo "Error: Vault path not found at $VAULT_PATH" >&2
    exit 1
fi

# Create daily notes directory if needed
mkdir -p "$DAILY_NOTES_DIR"

# Get commits with #vault-track from the specified period
echo "Scanning for #vault-track commits since $SINCE_DATE..."

cd "$REPO_PATH"

# Find all commits containing #vault-track in the last N days
TRACKED_COMMITS=$(git log --since="$SINCE_DATE" --grep="vault-track" --format="%H|%h|%s|%an|%ai" || true)

if [ -z "$TRACKED_COMMITS" ]; then
    echo "No commits with #vault-track found since $SINCE_DATE"
    exit 0
fi

# Process each tracked commit
while IFS='|' read -r FULL_HASH SHORT_HASH MSG AUTHOR TIMESTAMP; do
    # Extract date from timestamp
    COMMIT_DATE=$(echo "$TIMESTAMP" | cut -d' ' -f1)
    DAILY_NOTE="$DAILY_NOTES_DIR/$COMMIT_DATE.md"

    echo "Processing: $SHORT_HASH - $MSG"

    # Create daily note if it doesn't exist
    if [ ! -f "$DAILY_NOTE" ]; then
        cat > "$DAILY_NOTE" << EOF
---
type: daily
category: work
created: $COMMIT_DATE
updated: $COMMIT_DATE
tags: [vault-synced]
---

# $COMMIT_DATE Work Session

## 📍 Session Summary
- **Date:** $COMMIT_DATE
- **Categories:** ChiefOfStaff
- **Time Invested:** TBD

---

## ✅ Milestones Achieved Today
- (Added via vault-sync)

---

## 🔄 Currently Working On
- (Added via vault-sync)

---

## 🔗 Tracked Commits (via #vault-track)

**ChiefOfStaff Repository:**

EOF
    fi

    # Check if commit is already in the note
    if ! grep -q "$SHORT_HASH" "$DAILY_NOTE"; then
        # Extract PR number if available
        PR_NUMBER=$(echo "$MSG" | grep -oP '#\K[0-9]+' | head -1 || echo "")
        PR_LINK=""
        [ -n "$PR_NUMBER" ] && PR_LINK=" (PR #$PR_NUMBER)"

        # Format commit entry
        COMMIT_TIME=$(echo "$TIMESTAMP" | cut -d' ' -f2)
        ENTRY="- ✅ $COMMIT_TIME — \`$SHORT_HASH\`$PR_LINK: $MSG"

        # Append to daily note
        echo "$ENTRY" >> "$DAILY_NOTE"

        # Update timestamp
        sed -i '' "s/^updated: .*/updated: $(date +%Y-%m-%d)/" "$DAILY_NOTE"

        echo "  ✓ Added to $DAILY_NOTE"
    else
        echo "  ⊘ Already recorded in $DAILY_NOTE"
    fi
done <<< "$TRACKED_COMMITS"

echo "Vault sync complete!"
echo "Updated daily notes in: $DAILY_NOTES_DIR"
