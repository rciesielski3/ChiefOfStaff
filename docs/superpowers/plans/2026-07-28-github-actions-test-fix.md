# GitHub Actions Test Failure Resolution Plan

**Date:** 2026-07-28  
**Status:** 🚧 Investigation Phase  
**Blocker:** Tests pass locally but fail in GitHub Actions despite Node 22 deployment

---

## Problem Statement

**Symptom:** 5 automation PRs (#60, #66, #67, #69, #70) queued for auto-merge but blocked by failing test status checks.

**Observed:**
- ✅ Tests pass locally: `npm test` → 116 PASS in qa-news/
- ✅ Export workflow succeeds: Creates PRs, queues auto-merge
- ❌ Test workflow fails: Same test code fails in GitHub Actions
- ✅ Node 22 deployed: All workflows updated, even test.yml

**Not Caused By:**
- Node version (20→22 fixed, still failing)
- Missing dependencies (npm ci)
- Code changes (tests pass locally on same code)
- Path filters (qa-news/** changes do trigger test workflow)

---

## Investigation Tasks (Phase 1)

### Task 1: Check Test Workflow Execution
**Objective:** Verify test.yml actually runs on PR changes

**Steps:**
1. Pick PR #70 (latest)
2. Get test run ID: `gh run list --workflow test.yml --json number,headBranch,status,conclusion`
3. Check if test workflow runs at all
4. If runs: Proceed to Task 2
5. If doesn't run: Debug path filters in test.yml

**Success Criteria:**
- Confirm test.yml executes for PR changes to qa-news/**
- Identify exact step where failure occurs

**Estimate:** 15 min

---

### Task 2: Capture Test Error Output
**Objective:** Get exact error message from GitHub Actions test run

**Steps:**
1. Find latest test workflow run for PR #70
2. Run: `gh run view <RUN_ID> --log > test-output.log`
3. Search for:
   - `FAIL` or `ERROR` 
   - Stack traces
   - Jest error messages
   - Node/npm errors
4. Save to local file for analysis

**Success Criteria:**
- Have actual error message(s) from GitHub Actions
- Understand where/why test fails

**Estimate:** 10 min

---

### Task 3: Compare Environments
**Objective:** Identify difference between local and GitHub Actions environments

**Compare:**
- Node version: Local vs Actions
- npm/package versions: `npm list` local vs Actions cache
- Dependencies: Lock file differences
- Jest config: Any environment-specific settings
- PATH/environment variables: Anything special in Actions

**Steps:**
1. `node --version && npm --version` (local)
2. Run test with verbose output: `npm test -- --verbose`
3. Check test.yml for any env variables or special config
4. Look for Jest config in qa-news/package.json or jest.config.js

**Success Criteria:**
- Identify at least one environmental difference
- Hypothesis about root cause

**Estimate:** 20 min

---

## Fix Tasks (Phase 2) - Based on Phase 1 Findings

### Fix Option A: Clear GitHub Actions Cache
**If:** Tests fail due to old npm cache

**Steps:**
1. In test.yml, add before npm ci:
   ```yaml
   - name: Clear npm cache
     run: npm cache clean --force
   ```
2. Commit and push (re-run tests on PR)
3. Check if tests pass

**Estimate:** 10 min

---

### Fix Option B: Update Jest Config
**If:** Jest config differs between local and Actions

**Steps:**
1. Add NODE_ENV=test to test.yml
2. Check for jest.config.js incompatibilities
3. Run: `npm test -- --no-coverage` to skip coverage collection
4. Test locally, verify, push

**Estimate:** 15 min

---

### Fix Option C: Update package-lock.json
**If:** Dependency versions causing issue

**Steps:**
1. Local: `rm -rf node_modules package-lock.json`
2. Local: `npm install`
3. Verify tests still pass: `npm test`
4. Commit package-lock.json
5. Push and re-run GitHub Actions test

**Estimate:** 20 min

---

### Fix Option D: Debug in GitHub Actions Directly
**If:** Above fixes don't work

**Steps:**
1. Add debug step to test.yml:
   ```yaml
   - name: Debug environment
     run: |
       echo "Node: $(node --version)"
       echo "npm: $(npm --version)"
       echo "pwd: $(pwd)"
       ls -la
       npm list
   ```
2. Push and check logs
3. Compare to local output

**Estimate:** 15 min

---

## Success Criteria

**Definitive Success:**
- ✅ All 5 automation PRs have passing test status
- ✅ Auto-merge executes on all queued PRs
- ✅ PRs merged into main

**Interim Success:**
- ✅ Root cause identified (not just "Node issue")
- ✅ Fix attempted on at least one PR
- ✅ Specific GitHub Actions error understood

---

## Timeline

| Phase | Tasks | Estimate | Owner |
|-------|-------|----------|-------|
| 1. Investigation | Tasks 1-3 | 45 min | - |
| 2. Fix | Option A-D | 10-20 min | - |
| 3. Verify | Re-run PR tests | 5-10 min | - |
| 4. Cleanup | Merge PRs | 5 min | - |

**Total:** ~1-1.5 hours to full resolution

---

## Decision Tree

```
Start Investigation
    ↓
Does test.yml run? 
├─ NO → Fix path filters in test.yml
└─ YES → Capture error output
         ↓
    What's the error?
    ├─ npm/dependency issue → Fix Option C
    ├─ Node/environment issue → Fix Option A
    ├─ Jest config issue → Fix Option B
    ├─ Unknown → Fix Option D (debug)
    └─ Multiple issues → Iterate

Fix applied
    ↓
Does test pass on next PR run?
├─ YES → Success! Merge all PRs
└─ NO → Iterate to next fix option
```

---

## Rollback Plan

If all fixes fail:
1. Disable test requirement temporarily (remove from branch protection)
2. Manually review and approve PRs
3. Allow auto-merge to proceed
4. Investigate test framework migration (Jest version, config, etc.)
5. Schedule separate "test framework audit" as longer-term task

---

## Related Files

- **Test workflow:** `.github/workflows/test.yml`
- **QA-News tests:** `qa-news/__tests__/` and `qa-news/src/__tests__/`
- **Jest config:** `qa-news/package.json` (jest section)
- **Branch protection:** Main branch protection rules (GitHub UI)
- **Open PRs:** #60, #66, #67, #69, #70

---

## Notes

- Tests run successfully **every time** locally
- No code changes needed to make tests pass (they already pass)
- This is purely an **environment/config issue** in GitHub Actions
- Node 22 deployment didn't fix it, so it's not a Node version issue
- The `test.yml` workflow file is correct (just changed Node from 20→22)

---

**Next Action:** Execute Phase 1, Task 1 to confirm test.yml is running and collecting error output.
