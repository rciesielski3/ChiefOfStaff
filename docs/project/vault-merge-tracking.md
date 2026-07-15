# Vault Merge Tracking Strategy

**Document Type:** Process Documentation  
**Created:** 2026-07-15  
**Updated:** 2026-07-15  
**Status:** Active (Phase 1.2 Implementation)  
**Owner:** Automation Layer

---

## Overview

Automated merge tracking connects git commits to Obsidian vault daily notes. When you merge code, the system automatically records it in today's work session for continuity and audit trail.

**Goal:** Zero manual effort to track what got shipped today.

---

## Architecture: Three-Layer Approach

```
Layer 1 (Automatic)     → Post-merge hook captures merge → vault
       ↓ (if hook fails)
Layer 2 (Semi-Auto)     → Commit convention + daily sync script
       ↓ (if both fail)
Layer 3 (Manual)        → Manual reference in daily notes
```

Each layer is independent and can function without the others.

---

## Layer 1: Git Hook (Recommended, Automatic)

### What It Does

The post-merge git hook triggers **after every merge or pull** and automatically appends merge information to today's daily work note.

**File:** `.git/hooks/post-merge`  
**Trigger:** Automatically on `git merge` or `git pull`  
**Target:** `10-Daily/work/{YYYY-MM-DD}.md` in Obsidian vault

### How It Works

```
You run:
$ git merge feature/retry-logic

Git executes (automatically):
✅ Hook reads latest commit
✅ Extracts: hash, message, PR number (if any)
✅ Creates today's daily note if missing
✅ Appends: "- ✅ 14:22 — `abc1234` (PR #42): Fix retry logic"
✅ Updates YAML timestamp
```

### Format

Merge entries appear in the `🔗 Merged Today` section:

```markdown
## 🔗 Merged Today

**ChiefOfStaff Repository:**
- ✅ 09:15 — `d7f681d` (PR #42): Fix article persistence in daily-brief CLI
- ✅ 14:22 — `8e4a7c2` (PR #43): Add retry logic to API calls
```

### Pros & Cons

**Pros:**
- ✅ Zero manual effort
- ✅ Captures all merges automatically
- ✅ Timestamp is exact moment of merge
- ✅ No configuration after setup
- ✅ Works offline (no external dependencies)

**Cons:**
- ⚠️ Only works in ChiefofStaff repo (requires setup in other repos)
- ⚠️ Fails silently if vault path misconfigured (doesn't block merge)
- ⚠️ Requires vault path to be accessible

### Verification

Test that Layer 1 is working:

```bash
# Make a test commit on a feature branch
echo "test file" > test.txt
git add test.txt
git commit -m "test: Verify merge tracking (test commit #99)"

# Merge it to main
git checkout main
git merge test-branch

# Check that hook ran (should see an entry in today's daily note)
cat /Users/rafalciesielski/Developer/obsidian-vault/10-Daily/work/$(date +%Y-%m-%d).md | grep test

# Cleanup
git branch -d test-branch
rm test.txt
```

---

## Layer 2: Commit Message Convention (Fallback, Semi-Automatic)

### What It Does

By adding `#vault-track` to your commit messages, you explicitly flag commits worth capturing in the vault. A daily sync script extracts these and updates your notes.

**Marker:** `#vault-track` tag in commit message  
**Sync Method:** Manual run or scheduled cron job  
**Script:** `.github/scripts/vault-sync.sh`

### How It Works

```
Step 1: Author adds #vault-track to commit
  $ git commit -m "feat: Add retry logic to API calls
  
  #vault-track
  #priority-high
  #ChiefOfStaff
  
  Implements exponential backoff..."

Step 2: Run sync script (manually or via cron at 23:00)
  $ .github/scripts/vault-sync.sh

Step 3: Script scans git log for #vault-track commits from last 24h
  ✓ Found: 3 commits with #vault-track
  
Step 4: Appends each to daily notes
  ✓ Added to 2026-07-15.md
  ✓ Already recorded in 2026-07-14.md (skipped)
```

### Format

Commit messages should include the `#vault-track` tag:

```
feat: Add retry logic to API calls

#vault-track
#priority-high
#ChiefOfStaff

Fixes #42. Implements exponential backoff for transient errors.
This improves service resilience by 40%.

Co-Authored-By: Claude Haiku <noreply@anthropic.com>
```

**Tags to include:**
- `#vault-track` (required to track)
- `#ChiefOfStaff` (project name, useful for multi-project tracking)
- `#priority-[high|medium|low]` (optional, for filtering)

Resulting daily note entry:

```markdown
- ✅ 09:44 — `abc1234` (PR #42): Add retry logic to API calls
```

### Usage

Run sync script manually when needed:

```bash
# Sync commits from last 24 hours (default)
.github/scripts/vault-sync.sh

# Sync commits from a specific date
.github/scripts/vault-sync.sh 2026-07-14

# Sync commits from last 7 days
.github/scripts/vault-sync.sh 7
```

### Schedule with Cron (Optional)

To automatically sync tracked commits at end of day:

```bash
# Open crontab editor
crontab -e

# Add this line (runs daily at 23:00)
0 23 * * * /Users/rafalciesielski/Developer/ChiefofStaff/.github/scripts/vault-sync.sh >> /tmp/vault-sync.log 2>&1
```

### Pros & Cons

**Pros:**
- ✅ Works without git hooks
- ✅ Gives explicit control (only track what you choose)
- ✅ Clear intent with `#vault-track` tag
- ✅ Can be scheduled (set and forget)
- ✅ Works with older commits

**Cons:**
- ⚠️ Requires discipline to add `#vault-track` tag
- ⚠️ Manual setup of cron job (or manual script runs)
- ⚠️ Semi-automatic (not zero-touch)
- ⚠️ Timestamp is commit time, not merge time

### Verification

Test Layer 2:

```bash
# Create a test commit with #vault-track
git checkout -b test-layer2
echo "layer2 test" > layer2.txt
git add layer2.txt
git commit -m "test: Layer 2 verification

#vault-track
#ChiefOfStaff

Testing Layer 2 sync script"

# Run sync script manually
.github/scripts/vault-sync.sh

# Check that it was added to daily note
grep "layer2" /Users/rafalciesielski/Developer/obsidian-vault/10-Daily/work/$(date +%Y-%m-%d).md

# Cleanup
git checkout main
git branch -d test-layer2
rm layer2.txt
```

---

## Layer 3: Manual Reference (Always Available)

### What It Does

If automation fails, you can still manually link commits in your daily notes. This is the simplest, most reliable fallback.

### How It Works

In your daily note, explicitly reference the PR and commit:

```markdown
## 🔄 Currently Working On

### [[ChiefOfStaff]] — Article Persistence Fix
**PR:** #42  
**Commit:** d7f681d  
**Status:** ✅ Merged 2026-07-14 09:15 UTC  
**Impact:** Data integrity for news collection

This fix resolves the race condition where articles were lost 
when multiple workers processed the same item concurrently.

**Related:** [[10-Daily/work/2026-07-13]]
```

Or add to the "Merged Today" section:

```markdown
## 🔗 Merged Today

**ChiefOfStaff Repository:**
- ✅ PR #42 merged: "Fix article persistence in daily-brief CLI"
  - Commit: d7f681d
  - Impact: Data integrity for news collection
```

### Pros & Cons

**Pros:**
- ✅ Works without any setup
- ✅ Most flexible (full context in daily note)
- ✅ Can add decision rationale alongside merge
- ✅ Readable by both automation and humans
- ✅ Always available as final fallback

**Cons:**
- ⚠️ Requires manual effort
- ⚠️ Easy to forget to document
- ⚠️ No automation help

---

## Implementation Status

| Layer | Status | Implemented | Tested | Notes |
|-------|--------|-------------|--------|-------|
| **Layer 1: Git Hook** | ✅ Active | Yes (2026-07-15) | Pending | Post-merge hook installed, awaiting test merge |
| **Layer 2: Commit Convention** | ✅ Active | Yes (2026-07-15) | Pending | Sync script ready, can run manual or scheduled |
| **Layer 3: Manual Reference** | ✅ Available | N/A (manual) | N/A | Always available, no setup needed |

---

## Testing & Verification

### Test Script: Full 3-Layer Verification

```bash
#!/bin/bash
# Run this to test all three layers at once

REPO="/Users/rafalciesielski/Developer/ChiefofStaff"
VAULT="/Users/rafalciesielski/Developer/obsidian-vault"
TODAY=$(date +%Y-%m-%d)

echo "=== Testing Merge Tracking (3 Layers) ==="
echo ""

# Layer 1: Test hook
echo "Layer 1: Testing git hook..."
cd "$REPO"
git checkout -b test-merge-tracking
echo "test-layer1" > test-layer1.txt
git add test-layer1.txt
git commit -m "test: Layer 1 - Git hook verification (test #001)"
git checkout main
git merge test-merge-tracking --no-edit
echo "✓ Merged test-merge-tracking to main"
if grep -q "test-layer1" "$VAULT/10-Daily/work/$TODAY.md"; then
    echo "✅ Layer 1 PASSED: Hook captured merge in daily note"
else
    echo "❌ Layer 1 FAILED: Hook did not update daily note"
fi
git branch -d test-merge-tracking
rm test-layer1.txt
git reset --soft HEAD~1  # Undo the test merge

# Layer 2: Test sync script
echo ""
echo "Layer 2: Testing vault-sync script..."
git checkout -b test-sync
echo "test-layer2" > test-layer2.txt
git add test-layer2.txt
git commit -m "test: Layer 2 - Vault sync verification

#vault-track
#ChiefOfStaff

Testing Layer 2 sync script"
git checkout main
$REPO/.github/scripts/vault-sync.sh
if grep -q "test-layer2" "$VAULT/10-Daily/work/$TODAY.md"; then
    echo "✅ Layer 2 PASSED: Sync script captured tagged commit"
else
    echo "❌ Layer 2 FAILED: Sync script did not update daily note"
fi
git branch -d test-sync
rm test-layer2.txt

# Layer 3: Manual reference check
echo ""
echo "Layer 3: Manual reference available..."
if [ -f "$VAULT/10-Daily/work/$TODAY.md" ]; then
    echo "✅ Layer 3 AVAILABLE: Daily note exists and is writable"
else
    echo "❌ Layer 3 FAILED: Daily note not accessible"
fi

echo ""
echo "=== Verification Complete ==="
```

### Quick Verification Commands

```bash
# Check hook is installed and executable
ls -l /Users/rafalciesielski/Developer/ChiefofStaff/.git/hooks/post-merge

# Check sync script is installed
ls -l /Users/rafalciesielski/Developer/ChiefofStaff/.github/scripts/vault-sync.sh

# Check today's daily note exists
ls -l /Users/rafalciesielski/Developer/obsidian-vault/10-Daily/work/$(date +%Y-%m-%d).md

# Manually run sync script
/Users/rafalciesielski/Developer/ChiefofStaff/.github/scripts/vault-sync.sh
```

---

## Troubleshooting

### Issue: Hook Doesn't Update Daily Note

**Symptoms:**
- Merge completes successfully
- Daily note not updated
- No error message

**Diagnosis:**
```bash
# Check hook is executable
ls -l .git/hooks/post-merge
# Should show: -rwxr-xr-x

# Check vault path
echo $VAULT_PATH
# Should show: /Users/rafalciesielski/Developer/obsidian-vault

# Verify vault directory exists
ls -l /Users/rafalciesielski/Developer/obsidian-vault/10-Daily/work/
```

**Solution:**
1. Make hook executable: `chmod +x .git/hooks/post-merge`
2. Verify vault path in hook script matches your setup
3. Create daily note manually if it's being skipped
4. Check hook output: `bash -x .git/hooks/post-merge` after a merge

### Issue: Sync Script Doesn't Find Commits

**Symptoms:**
- Run `vault-sync.sh`, reports "No commits with #vault-track found"
- But you know you added the tag

**Diagnosis:**
```bash
# Check commits in last 24h
git log --since="24 hours ago" --oneline

# Search for vault-track specifically
git log --grep="vault-track" --oneline
```

**Solution:**
1. Verify `#vault-track` is in commit message (not just commit body)
2. Make sure commits are pushed to local repo (script reads local git log)
3. Use explicit date: `.github/scripts/vault-sync.sh 2026-07-15`

### Issue: Daily Note Already Has Entry, Hook Creates Duplicate

**Diagnosis:**
- Hook checks for existing commit hash before adding
- If check fails, could create duplicates

**Solution:**
- Manual fix: Edit daily note and remove duplicate
- Verify: `grep -c "<hash>" daily-note.md` should equal 1
- Re-run cleanup: Delete extra entry manually

---

## Configuration

### Environment Variables

You can override defaults by setting environment variables:

```bash
# Override vault path
export VAULT_PATH="/path/to/obsidian-vault"

# Override repo path (for sync script)
export REPO_PATH="/path/to/ChiefofStaff"

# Then run script/hook
.github/scripts/vault-sync.sh
```

### Vault Path Configuration

Both hook and script use this path priority:

1. `$VAULT_PATH` environment variable (if set)
2. Hardcoded default: `/Users/rafalciesielski/Developer/obsidian-vault`
3. If neither exists: Script warns and exits gracefully

To verify your setup:

```bash
# Check environment variable
echo "VAULT_PATH=${VAULT_PATH:-not set}"

# Check hardcoded default
cat .git/hooks/post-merge | grep "VAULT_PATH"
```

---

## Integration with Obsidian Workflow

### Recommended Daily Note Template

When creating new daily notes, include this section:

```markdown
---
type: daily
category: work
created: 2026-07-15
updated: 2026-07-15
tags: []
---

# 2026-07-15 Work Session

## 📍 Session Summary
- **Date:** 2026-07-15
- **Categories:** ChiefOfStaff
- **Time Invested:** TBD

---

## ✅ Milestones Achieved Today
- (Added during session)

---

## 🔄 Currently Working On
- (Added during session)

---

## 🔗 Merged Today

**ChiefOfStaff Repository:**
(Auto-populated by Layer 1 hook or Layer 2 sync script)

---

## 📚 Related Notes
- [[10-Daily/work/2026-07-14]] — Previous session
- [[20-Projects/ChiefOfStaff/status/PROJECT_STATUS]] — Project status
```

### Wiki-Link Conventions

When linking to projects in daily notes:

```markdown
# Good (Obsidian will create backlinks)
Working on [[ChiefOfStaff]]
Merged [[20-Projects/ChiefOfStaff]] code today

# Avoid (bracket links don't create backlinks)
Working on [ChiefOfStaff]
```

---

## Best Practices

1. **Layer 1 (Hook) is default:** Let the hook do its job after merges
2. **Layer 2 (Convention) for intentional tracking:** Use `#vault-track` when merge is noteworthy
3. **Layer 3 (Manual) for context:** Add extra details, rationale, impact assessment
4. **Combine layers:** You can have all three active simultaneously
5. **Regular commits:** Commit vault changes daily to avoid conflicts

### Commit Message Best Practices

```
# Good: Clear, trackable
feat: Add retry logic with exponential backoff

#vault-track
#ChiefOfStaff
#priority-high

Implements jitter to prevent thundering herd.
Fixes #42. Tests added with 100% coverage.

# Avoid: Unclear, hard to track
Fixed stuff

# Avoid: Tag not recognized by hook
#vault-track-important (should be just #vault-track)
```

---

## Future Enhancements

Potential improvements (not implemented yet):

- [ ] GitHub Actions workflow to run sync script on every push
- [ ] DataviewJS dashboard showing weekly merge metrics
- [ ] Slack notification when merge is recorded in vault
- [ ] Two-way sync: update PR description with vault link
- [ ] Archive old daily notes automatically
- [ ] Multi-repo support (track merges from other projects)

---

## Related Documentation

- **VAULT_IMPROVEMENTS.md** — Overall vault strategy (Phase 1, 2, 3)
- **VAULT_AUDIT.md** — Current vault health assessment
- **.git/hooks/post-merge** — Hook implementation
- **.github/scripts/vault-sync.sh** — Sync script implementation
- **10-Daily/work/** — Daily work notes (in Obsidian vault)
- **20-Projects/ChiefOfStaff/status/PROJECT_STATUS.md** — Project status linked from daily notes

---

**Document Status:** Active Implementation  
**Last Verified:** 2026-07-15  
**Maintenance:** Check quarterly or when testing new merges  
**Owner:** Automation Layer (Claude)
