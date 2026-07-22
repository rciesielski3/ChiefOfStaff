---
title: QA-News Secret Handling & Error Scenario Test Suite — Design Spec
date: 2026-07-22
---

# QA-News Secret Handling & Error Scenario Test Suite — Design Spec

**Purpose:** Address code review findings (Finding 1: Workflow doesn't pass ANTHROPIC_API_KEY; Finding 3: Missing secret tests) by creating comprehensive test coverage for secret handling, API error scenarios, and graceful fallbacks.

**Status:** Design complete, ready for implementation

---

## Executive Summary

The code review identified a critical production bug: the GitHub Actions workflow `export-qa-news.yml` never passes `ANTHROPIC_API_KEY` to the export CLI steps, causing summaries to always be empty in production. Additionally, unit tests are missing for error scenarios and missing-secret handling.

This spec defines a lean, focused test suite (20-30 tests) organized around:
1. **Unit tests** — Granular validation of specific concerns (exit codes, env vars, fallback text, error handling)
2. **Scenario tests** — End-to-end workflows simulating real CLI invocations and GitHub Actions execution

The suite addresses all code review findings while remaining maintainable and fast.

---

## Architecture

### Test Organization (3 layers)

**Layer 1: Unit Tests (12-15 tests)**
- SummaryGenerator error handling (3 tests)
- CLI environment variable handling (4 tests)
- Export fallback text validation (3 tests)
- Exit code verification (2 tests)
- Logging safety (2 tests)

**Layer 2: Scenario Tests (8-12 tests)**
- Happy path with secrets (2 tests)
- Graceful degradation (3 tests)
- Workflow integration (3 tests)
- Data integrity (2-4 tests)

**Layer 3: Coverage Matrix**
- Maps tests to code review findings
- Ensures all error paths covered
- Validates before/after workflow fix

### Test Execution Pattern

All CLI tests use integration-based approach:
- Invoke actual CLI as subprocess: `execSync('npx ts-node src/cli/...')`
- Set/unset `ANTHROPIC_API_KEY` to test both paths
- Capture stdout/stderr
- Verify exit code, JSON structure, logged messages

API error tests use mocked SDK:
- Mock `Anthropic.messages.create()` to simulate timeout/auth/rate-limit
- Verify error handling returns empty string (graceful fallback)
- Never throws

---

## Test Files & Coverage

### File 1: `tests/business-logic/summary-generator-errors.test.ts`
**Purpose:** Verify SummaryGenerator gracefully handles API failures

**Unit Tests (3):**
1. `test: API timeout → returns empty string`
   - Mock: `mockCreate.mockRejectedValue(new Error("timeout"))`
   - Assert: result === ''
   - Assert: no throw

2. `test: Auth failure (403) → returns empty string`
   - Mock: API response with 403 error
   - Assert: result === ''
   - Assert: error logged to stderr

3. `test: Malformed response (no text content) → returns empty string`
   - Mock: `message.content = []` (empty array)
   - Assert: result === ''
   - Assert: no crash

### File 2: `tests/cli/export-weekly-highlights-secrets.test.ts`
**Purpose:** Verify weekly export CLI handles secrets and errors

**Unit Tests (4):**
4. `test: ANTHROPIC_API_KEY present → summaries generated`
   - Set: `process.env.ANTHROPIC_API_KEY = 'test-key'`
   - Run: CLI
   - Assert: JSON has non-empty summary fields
   - Assert: exit code 0

5. `test: ANTHROPIC_API_KEY missing → skips SummaryGenerator`
   - Unset: `process.env.ANTHROPIC_API_KEY`
   - Run: CLI
   - Assert: JSON has empty summary fields
   - Assert: stderr contains "SUMMARIES_SKIPPED"
   - Assert: exit code 0 (exports still succeed)

6. `test: ANTHROPIC_API_KEY unset → exports still succeed`
   - No key set
   - Run: CLI
   - Assert: exit code 0
   - Assert: JSON structure valid
   - Assert: articles present

7. `test: Empty summary field → JSON valid`
   - No key set
   - Run: CLI
   - Parse: JSON output
   - Assert: `weeks[0].summary === ''`
   - Assert: JSON.parse succeeds

**Scenario Tests (2):**
8. `scenario: CLI with secret key`
   - Set: `ANTHROPIC_API_KEY`
   - Run: CLI
   - Assert: summaries populated
   - Assert: exit 0
   - Assert: file written

9. `scenario: CLI without secret key`
   - Unset: `ANTHROPIC_API_KEY`
   - Run: CLI
   - Assert: summaries empty
   - Assert: fallback text present
   - Assert: exit 0

### File 3: `tests/cli/export-monthly-recap-secrets.test.ts`
**Purpose:** Verify monthly export CLI handles secrets and errors

**Unit Tests (4):** [Same pattern as weekly]
10-13. [Mirror of tests 4-7 for monthly]

**Scenario Tests (2):** [Same pattern as weekly]
14-15. [Mirror of tests 8-9 for monthly]

### File 4: `tests/business-logic/export-weekly-highlights-fallback.test.ts`
**Purpose:** Verify fallback text is correctly used and formatted

**Unit Tests (3):**
16. `test: Fallback text format = "Week of {weekOf}: {count} articles"`
    - Manually invoke: `exportWeeklyHighlightsWithSummaries()` with mock API error
    - Assert: `weeks[0].summary === 'Week of 2026-07-21: 12 articles'`
    - Assert: exact format

17. `test: Fallback used when SummaryGenerator throws`
    - Mock: SummaryGenerator throws error
    - Run: export function
    - Assert: summary is fallback text (not empty, not null)

18. `test: Fallback in JSON → structure valid`
    - Export with fallback text
    - Parse: JSON
    - Assert: JSON.parse succeeds
    - Assert: summary field is string

### File 5: `tests/business-logic/export-monthly-recap-fallback.test.ts`
**Purpose:** Verify monthly fallback text

**Unit Tests (3):** [Same pattern as weekly]
19-21. [Mirror of tests 16-18]

### File 6: `tests/cli/export-qa-news-exit-codes.test.ts`
**Purpose:** Verify exit codes in all scenarios

**Unit Tests (2):**
22. `test: Successful export → exit code 0`
    - Run: CLI with articles
    - Assert: exit code === 0

23. `test: Empty export (no articles) → exit code 1`
    - Run: CLI with empty store
    - Assert: exit code === 1

### File 7: `tests/workflows/export-qa-news-secrets.test.ts`
**Purpose:** Verify workflow secret passing (addresses Finding 1)

**Scenario Tests (3):**
24. `scenario: Simulate GitHub Actions WITH secret`
    - Set: `process.env.ANTHROPIC_API_KEY`
    - Invoke: both export CLIs
    - Assert: summaries present in both
    - Assert: both exit 0
    - **Status:** Exposes current broken workflow

25. `scenario: Simulate GitHub Actions WITHOUT secret`
    - Unset: `process.env.ANTHROPIC_API_KEY`
    - Invoke: both export CLIs
    - Assert: summaries empty in both
    - Assert: both exit 0
    - **Status:** Documents current broken workflow

26. `scenario: After workflow fix (secret passed) → summaries present`
    - Set: `ANTHROPIC_API_KEY`
    - Invoke: CLIs as workflow would
    - Assert: summaries generated
    - Assert: exit codes 0
    - **Status:** Validates fix to Finding 1

### File 8: `tests/integration/export-qa-news-integrity.test.ts`
**Purpose:** Verify data integrity across all scenarios

**Scenario Tests (4):**
27. `test: JSON structure valid with empty summaries`
    - Export without secrets
    - Parse: JSON
    - Assert: all required fields present

28. `test: Article counts correct (weekly all, monthly curated)`
    - Run: both exports
    - Assert: weekly.weeks[0].items.length >= 1
    - Assert: monthly.months[0].items.length <= 25

29. `test: Synced files identical to exported files`
    - Export to qa-news/public/
    - Sync to qa-news/data/
    - Assert: content identical

30. `test: Fallback text doesn't break downstream consumers`
    - Export with fallback text
    - Simulate: Next.js app parsing JSON
    - Assert: all fields accessible
    - Assert: no null/undefined surprises

---

## Coverage Matrix

| Code Review Finding | Test File | Test Number | Type | Coverage |
|---|---|---|---|---|
| **Finding 1: Workflow doesn't pass ANTHROPIC_API_KEY** | export-qa-news-secrets.test.ts | 24-26 | Scenario | Exposes bug (24-25), validates fix (26) |
| **Finding 3: Missing secret tests** | All files | 4-30 | Unit + Scenario | Comprehensive env var, error, fallback coverage |
| **Finding 4: Unguarded array access** | summary-generator-errors.test.ts | 3 | Unit | Malformed response handling |
| **Finding 5: Full error logging** | (covered by 4-6, 16-17) | — | Unit | Error logged safely without secrets |
| **Finding 6: Cancelled workflow proceeds** | export-qa-news-secrets.test.ts | 25 | Scenario | Assumption tested (no fix needed) |

---

## Success Criteria

✅ **Test Count:** 20-30 focused tests (lean, maintainable)  
✅ **Coverage Type:** Unit tests (granular) + Scenario tests (end-to-end)  
✅ **All Error Paths:** API timeout, auth fail, rate limit, malformed response, missing key  
✅ **Fallback Validation:** Text format, JSON structure, downstream compatibility  
✅ **Exit Codes:** 0 on success (even with empty summaries), 1 on failure  
✅ **Logging Safety:** Error messages don't expose secrets  
✅ **Finding 1 Validation:** Before/after tests document workflow bug + fix  
✅ **Finding 3 Resolution:** Comprehensive missing-secret and error-scenario coverage  

---

## Implementation Plan

### Phase 1: Unit Tests (Days 1-2)
- Implement Files 1-5 (error handling, env vars, fallback text)
- ~14 tests
- Fast, isolated, no integration

### Phase 2: Exit Code & Logging Tests (Day 2)
- Implement File 6
- ~2 tests
- Quick validation

### Phase 3: Workflow Integration Tests (Day 3)
- Implement File 7
- 3 critical tests
- Documents Finding 1, validates fix

### Phase 4: Data Integrity Tests (Day 3)
- Implement File 8
- ~4 tests
- Ensure downstream safety

### Total Effort: 3 days, 1 developer, 20-30 tests

---

## Key Decisions

1. **Lean coverage (20-30 tests)** over exhaustive (50+) — focuses on critical paths, fast to maintain
2. **Unit + Scenario split** — unit tests catch regressions, scenario tests validate real workflows
3. **Mocked API errors** — faster than real API, controlled, no rate-limit risk
4. **Integration-based CLI tests** — subprocess invocation catches real CLI behavior (exit codes, env var reading)
5. **Workflow validation tests** — explicitly documents Finding 1 (workflow doesn't pass secret)

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Tests pass locally but fail in GitHub Actions | Use GitHub Actions env var setup in scenario tests |
| Mocked API errors don't match real SDK behavior | Reference SDK error types in mocks, test with real key occasionally |
| Fallback text changes break tests | Hard-code expected format in each test |
| Exit code handling varies between platforms | Run tests on CI (Linux) consistently |

---

## Appendix: Test Naming Convention

All tests follow pattern: `test: [action] → [expected result]`

Examples:
- `test: API timeout → returns empty string`
- `test: ANTHROPIC_API_KEY missing → skips SummaryGenerator`
- `test: Fallback used when SummaryGenerator throws`
- `scenario: CLI with secret key` (for longer end-to-end workflows)

---

**Status:** Design complete. Ready for implementation planning.
