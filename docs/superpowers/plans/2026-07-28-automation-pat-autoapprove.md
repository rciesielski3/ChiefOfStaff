# Automation PAT Auto-Approval Implementation Plan

**Goal:** Enable automated approval and merging of automation PRs (export-qa-news, update-qa-news) without manual intervention.

**Status:** 🚧 Planning (ready to implement)

**Current State:**
- Workflows create PRs (merge-gate compliant) ✅
- PRs require manual maintainer approval ⏳
- `gh pr merge --auto` works but only after approval
- **Gap:** Need automatic approval before merge

---

## Implementation Options

### Option A: Personal Access Token (PAT) with Scheduled Approval ⭐ Recommended

**How it works:**
1. Create PAT (fine-grained) with repo-scoped `pull_requests: write` permission
2. Add PAT as GitHub secret: `AUTOMATION_PAT`
3. Add approval step to workflow: runs before `gh pr merge --auto`
4. Approval uses PAT (not `GITHUB_TOKEN`)

**Pros:**
- Uses fine-grained PAT (minimal permissions)
- Still auditable (approval shows who made it)
- Isolated from main build token
- Standard GitHub practice

**Cons:**
- Need to manage/rotate PAT
- Token is checked into actions secrets

**Implementation:**
```bash
# Step 1: Create PAT
# GitHub UI → Settings → Developer settings → Personal access tokens → Fine-grained tokens
# Name: automation-pr-approval
# Scope: ChiefOfStaff (specific repo)
# Permissions: 
#   - pull_requests: write (for approvals)
#   - contents: write (for merges)
# Expiration: 1 year

# Step 2: Add to repo secrets
gh secret set AUTOMATION_PAT --body "<token>"

# Step 3: Update workflows
```

### Option B: Reusable GitHub App

**How it works:**
1. Create GitHub App with PR approval permission
2. Install app on repository
3. App auto-approves PRs from automation

**Pros:**
- More secure (app-specific permissions)
- No token rotation needed (GitHub manages)
- Auditable as app action

**Cons:**
- More complex setup
- Requires app installation
- Overkill for this use case

---

## Recommended Implementation (Option A)

### Tasks

#### Task 1: Create Fine-Grained PAT
- [ ] Go to GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens
- [ ] Create token:
  - Name: `automation-pr-approval`
  - Repository: ChiefOfStaff (specific)
  - Permissions: 
    - `pull_requests: write` (to approve PRs)
    - `contents: write` (to merge PRs)
  - Expiration: 1 year
- [ ] Copy token value

#### Task 2: Add PAT to Repository Secrets
```bash
gh secret set AUTOMATION_PAT --body "<paste_token_here>"
```

#### Task 3: Update export-qa-news.yml
Replace PR merge step with:
```yaml
- name: Approve and Merge Pull Request
  if: steps.commit.outputs.changed == 'true'
  run: |
    BRANCH_NAME="automation/export-qa-news-$(date +%s)"
    git checkout -b "$BRANCH_NAME"
    git push -u origin "$BRANCH_NAME"

    # Create PR
    PR_URL=$(gh pr create \
      --title "data: update qa-news daily/weekly/monthly exports" \
      --body "Automated export from latest RSS articles" \
      --base main \
      --head "$BRANCH_NAME" \
      --json url -q .url)

    PR_NUMBER=$(echo "$PR_URL" | grep -oP 'pull/\K[0-9]+')

    # Approve as automation account (using PAT)
    gh pr review "$PR_NUMBER" --approve || true

    # Auto-merge with squash
    gh pr merge "$PR_NUMBER" --squash --auto || true
  env:
    GH_TOKEN: ${{ secrets.AUTOMATION_PAT }}
```

#### Task 4: Update update-qa-news.yml
Same pattern as export-qa-news.yml

#### Task 5: Test
- [ ] Manually trigger export-qa-news workflow
- [ ] Verify PR is created and auto-merged within seconds
- [ ] No manual approval required

#### Task 6: Monitor
- [ ] Watch first few runs to confirm auto-merge works
- [ ] Check approval shows as automated
- [ ] Set calendar reminder to rotate PAT annually

---

## Security Considerations

**PAT Scope:**
- Fine-grained (not classic token)
- Repository-scoped (ChiefOfStaff only)
- Minimal permissions:
  - `pull_requests: write` (for PR approvals)
  - `contents: write` (for PR merges)
- No repo admin, deletion, or workflow permissions

**Storage:**
- Stored in GitHub Actions secrets
- Encrypted at rest
- Only available to workflows in this repo
- Good practice: rotate annually

**Audit Trail:**
- All auto-approvals show in PR timeline
- Attributed to PAT owner account
- Full audit log in repository activity

---

## Rollback Plan

If PAT-based auto-approval causes issues:
1. Delete AUTOMATION_PAT secret
2. Revert workflow changes
3. Back to manual approval requirement
4. No breaking changes to existing workflows

---

## Timeline

- **This week:** Create PAT, update workflows (1-2 hours)
- **Next week:** Monitor first automated runs
- **Ongoing:** Rotate PAT annually

---

**Next Action:** User approves this plan → implement Task 1-4 in order
