# Merge Gate Configuration

**Status:** Technical enforcement via GitHub branch protection rules.

## Policy (from CLAUDE.md)

> **CRITICAL: All changes to main via PR only, user as author, code review gate required, never direct merges**

## Technical Enforcement

### Branch Protection Rules on `main`

Required settings:
- ✅ **Require a pull request before merging**
  - Require approvals: 1
  - Dismiss stale pull request approvals when new commits are pushed

- ✅ **Require status checks to pass before merging**
  - Required status checks:
    - `test` — Runs Jest test suite (must pass)

- ❌ **Do NOT require code owner approval** (reduces automation friction)

### Automated Workflow Behavior

**export-qa-news.yml** and **update-qa-news.yml** workflows:

1. **Create PR** — Branch protection requires this
2. **Queue for auto-merge** — Uses `gh pr merge --squash --auto`
3. **Wait for approvals** — Requires 1 human review (manual click)
4. **Wait for tests** — Requires `test` status check to pass
5. **Auto-merge** — Executes once all requirements met

**Important:** Approval is **always required** by branch protection. The workflow queues the merge, but GitHub won't merge until:
- At least 1 maintainer approves the PR
- All required status checks pass (tests must pass)

### Manual Push Prevention

Direct pushes to `main` are **blocked** by branch protection. Attempting to push will fail with:
```
remote: error: GH013: Repository rule violations found for refs/heads/main
remote: - Changes must be made through a pull request
```

This is enforced at the GitHub level, not just by process.

## How to Approve Automation PRs

Automation PRs (created by export-qa-news or update-qa-news workflows) need manual approval:

1. Go to the PR on GitHub
2. Click **"Approve"** (review tab)
3. Once you approve + tests pass, auto-merge triggers automatically
4. No manual merge click needed

## Troubleshooting

### PR won't auto-merge after approval

**Causes:**
1. Tests are still running — wait for status checks to complete
2. Tests failed — check test logs, fix issues
3. Stale PR — approvals dismissed after new commits; re-approve
4. Branch protection not configured — see Setup section below

**Fix:**
- Verify all status checks show ✅ green
- Manually merge the PR if tests pass but auto-merge isn't triggering

### Direct push rejected

**Error:** `GH013: Repository rule violations found`

**Cause:** Branch protection requires PRs for all changes

**Fix:** 
1. Create a branch: `git checkout -b your-feature`
2. Push to branch: `git push -u origin your-feature`
3. Open a PR on GitHub
4. Get approval + pass tests
5. Auto-merge or manually merge

## Setup

### Enable Branch Protection (Admin Only)

```bash
# Go to GitHub Settings → Branches → main

# Required settings:
- [x] Require a pull request before merging
  - Require approvals: 1
  - [ ] Require code owner review
  - [x] Dismiss stale pull request approvals
  
- [x] Require status checks to pass before merging
  - Required status checks: test

- [ ] Require branches to be up to date before merging (optional)
- [ ] Require conversation resolution before merging (optional)
- [ ] Require signed commits (optional)
```

### Verify Configuration

```bash
gh api repos/rciesielski3/ChiefOfStaff/branches/main/protection
```

Should return protection rules. If HTTP 404, branch protection is not configured.

## Related Files

- **CLAUDE.md** — Project-level merge gate rule (process policy)
- **.github/workflows/export-qa-news.yml** — Auto-merge workflow (export-qa-news)
- **.github/workflows/update-qa-news.yml** — Auto-merge workflow (update-qa-news)

## Last Updated

2026-07-28 — Added technical enforcement documentation after critical review.
