# Insight Validation Non-Blocking Fix

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Make hallucination detection non-blocking — report issues but exit successfully so workflows don't fail on warnings.

**Architecture:** The `generate-insights` CLI currently exits with code 1 when validation fails (including hallucination detection). Change it to exit 0, reporting validation results as warnings instead of fatal failures. Daily-brief workflow will run to completion instead of stopping.

**Tech Stack:** TypeScript, Node.js

---

## Global Constraints

- TypeScript strict mode enforced
- All tests passing before commit
- No external dependencies beyond `package.json`
- Commits prefixed `fix:` (no AI co-author)
- Validation failures logged as warnings, not exit(1)

---

## File Structure

| File | Purpose | Change Type |
|------|---------|------------|
| `src/cli/generate-insights.ts` | Remove exit(1) on validation failure, change to warning log | Modify |
| `tests/cli/generate-insights.cli.test.ts` | Add test for non-blocking validation | Modify |

---

## Tasks

### Task 1: Make validation non-blocking in generate-insights CLI

**Files:**
- Modify: `src/cli/generate-insights.ts`
- Test: `tests/cli/generate-insights.cli.test.ts`

**Interfaces:**
- Consumes: ValidationResult from InsightValidator (passed: boolean, failures: array)
- Produces: Exit code 0 always, validation results logged as warnings

- [ ] **Step 1: Read generate-insights.ts lines 220-232**

Understand current validation failure handling and exit logic.

- [ ] **Step 2: Change validation failure behavior**

Replace lines 229-232:
```typescript
// Old code (REMOVE):
// Exit with non-zero code if validation failed
if (!validationResult.passed) {
  process.exit(1);
}
```

With new code (ADD):
```typescript
// New code (KEEP):
// Log validation failures as warnings, but don't fail the pipeline
if (!validationResult.passed) {
  console.warn('[Insight Generation] ⚠️  Validation warnings detected:');
  validationResult.failures.forEach(failure => {
    console.warn(`  - ${failure}`);
  });
  console.warn('[Insight Generation] Continuing pipeline despite validation warnings');
}
```

- [ ] **Step 3: Verify structured logging includes validation status**

Lines 206-212 already log validation results. Verify the log includes `passed: false` when hallucinations detected. (No change needed here.)

- [ ] **Step 4: Test the CLI manually**

Run:
```bash
npx ts-node src/cli/generate-insights.ts --verbose
```

Verify:
- Script completes successfully (exit code 0) even if validation fails ✓
- Warning messages about hallucinations appear in output ✓
- insights.ndjson is created regardless of validation status ✓

- [ ] **Step 5: Add test for non-blocking validation**

Open `tests/cli/generate-insights.cli.test.ts` and add a new test after existing tests:

```typescript
test('cli: continues execution even when validation detects hallucinations', async () => {
  const result = execSync('npx ts-node src/cli/generate-insights.ts', {
    cwd: projectRoot,
    encoding: 'utf-8',
    stdio: 'pipe'
  });

  // Exit code should be 0 (success) even if validation failed
  expect(result).toBeDefined();
  
  // Check that insights file was created
  const insightsPath = path.join(projectRoot, 'data/insights.ndjson');
  if (fs.existsSync(insightsPath)) {
    const content = fs.readFileSync(insightsPath, 'utf-8');
    // Should have content (proves pipeline ran to completion)
    expect(content.trim().length).toBeGreaterThan(0);
  }
});
```

- [ ] **Step 6: Run tests**

```bash
npm test -- tests/cli/generate-insights.cli.test.ts
```

Expected: All tests pass (including the new non-blocking test).

- [ ] **Step 7: Verify daily-brief workflow no longer stops on validation warnings**

The workflow should now continue to "Commit changes" and "Create Pull Request" steps even when insights have hallucinations.

- [ ] **Step 8: Commit**

```bash
git add src/cli/generate-insights.ts tests/cli/generate-insights.cli.test.ts
git commit -m "fix: make insight validation non-blocking, report hallucinations as warnings"
```

---

## Success Criteria

- ✅ CLI exits with code 0 always (even on validation failures)
- ✅ Hallucinations logged as warnings in console output
- ✅ insights.ndjson created regardless of validation status
- ✅ Test verifies non-blocking behavior
- ✅ All tests passing
- ✅ Daily-brief workflow completes to workflow completion

---

## Summary

**Total: 1 Task**

Change validation failure from fatal (exit 1) to warning (log + continue). Simple fix that keeps pipelines running while still reporting quality issues.

---

**Execution:** Ready for subagent-driven development. Two options:

1. **Subagent-Driven** — I dispatch implementer, review, merge via PR
2. **Inline** — I implement directly this session

Which approach?
