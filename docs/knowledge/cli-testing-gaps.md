# CLI Testing Gaps — Gap Analysis & Roadmap

**Date:** 2026-07-21  
**Status:** Documented (E2E stubs in progress)  
**Phase:** M6.3 secondary deliverable

---

## Executive Summary

Two CLI entry points remain untested end-to-end:
1. `src/cli/extract-knowledge.ts` (256 lines) — Invoked by daily-brief.yml workflow
2. `src/cli/validate-knowledge-extraction.ts` (380 lines) — Aspirational validation tool (not integrated)

This document identifies what's tested, what's not, and the roadmap for E2E validation.

---

## Extract-Knowledge CLI

**Current State:**
- **Status:** Invoked by daily-brief.yml workflow
- **Code:** 256 lines, CLI entry point with environment variables
- **Tests:** Business logic only (KnowledgeExtractionService, EvolutionEngine, SensitivityAssessor)
- **Coverage:** 50+ unit tests for underlying services

**What's Tested ✅ (Business Logic):**
- Fact extraction from articles
- Deduplication and versioning logic
- Sensitivity assessment (PII/proprietary detection)
- NDJSON storage and persistence
- Embeddings caching
- Evolution rate ≥15%

**What's NOT Tested ❌ (CLI Orchestration):**
- Environment variable parsing (`CONCURRENCY`, `BATCH_SIZE`, `INPUT_FACTS`, `OUTPUT_FACTS`)
- Command-line argument handling (`--input`, `--output`, `--cache`)
- Process exit codes (0 on success, 1 on failure)
- File I/O under stress (concurrent processes writing same file)
- Concurrency control (N parallel processes, no data corruption)
- Rate-limiting delays (1000ms between batches)
- Error messages and logging output
- Timeout handling

**Why It Matters:**
- CLI environment (process.env, process.exit, file descriptors) differs from unit tests
- Silent failures possible if exit codes not validated
- Workflow relies on exit code to block on failure
- Production invocation in GitHub Actions only tests success path

**E2E Scope (Future Phase):**
Estimated 3-4 hours to add true E2E tests:
```
tests/e2e/extract-knowledge-full.test.ts:
✅ Invoke CLI with sample articles, verify output file created
✅ Test CONCURRENCY=1, CONCURRENCY=3 (concurrent safety)
✅ Verify exit code 0 on success, exit 1 on failure
✅ Test rate-limiting (delays between batches)
✅ Validate NDJSON output format and data integrity
✅ Test error handling (missing files, malformed input)
✅ Verify environment variable overrides work
```

---

## Validate-Knowledge-Extraction CLI

**Current State:**
- **Status:** Aspirational (not integrated into workflows)
- **Code:** 380 lines, validation and reporting tool
- **Tests:** Business logic only (metrics calculation, reporting)
- **Integration:** None (manual inspection only)

**What's Tested ✅ (Business Logic):**
- Fact count calculation
- Confidence distribution analysis (min/max/mean/median)
- Domain classification breakdown
- Output formatting (table/JSON modes)
- Metrics aggregation

**What's NOT Tested ❌ (CLI Entry Point):**
- Command-line argument parsing (`--input`, `--format`, `--output`)
- File input/output handling
- Exit codes
- Error handling for missing/malformed NDJSON
- Table formatting with various terminal widths
- Structured logging

**Status: Repositioning for M6.5**

This tool was designed as a standalone validation CLI but is currently unused in workflows.

**Future Role (M6.5 Sprint):**
- **Rename to:** `src/services/KnowledgeQualityValidator.ts`
- **Keep CLI interface:** `npx ts-node src/cli/validate-knowledge.ts` (for manual QA)
- **Add service interface:** For pipeline use in M6.5 storage layer
- **Use case:** Pre-storage validation (before facts enter knowledge graph)
- **Integration:** Called by M6.5 pipeline before permanent storage

See `/docs/knowledge/m6.5-qa-design.md` for detailed architecture.

---

## Recommended Implementation Roadmap

### Phase 1: Awareness (This Document) ✅
- Identify untested entry points
- Document test scope (business logic vs CLI orchestration)
- Clarify what's missing

### Phase 2: E2E Stubs (Week 2-3) 🔄
- Add basic E2E stubs for extract-knowledge.ts
- Verify CLI is callable
- Test exit codes

### Phase 3: Full E2E Tests (After M6.3 Merge) 📋
- Implement comprehensive E2E suite
- Test concurrency, rate-limiting, environment variables
- Estimated: 3-4 hours
- Priority: MEDIUM (business logic already validated)

### Phase 4: M6.5 Integration (M6.5 Sprint) 📋
- Refactor validate-knowledge-extraction.ts to KnowledgeQualityValidator service
- Integrate into M6.5 storage pipeline
- Add E2E tests for pre-storage validation

---

## Cost-Benefit Analysis

| Phase | Scope | Effort | Benefit | Priority |
|-------|-------|--------|---------|----------|
| **Stubs** | Callable verification | 2 hours | Baseline confidence | HIGH |
| **Full E2E** | Concurrency, exit codes, I/O | 3-4 hours | Production confidence | MEDIUM |
| **M6.5 Integration** | Service + workflow | 4-5 hours | Operational visibility | MEDIUM |

---

## Key Findings

**For M6.3 Closure:**
- ✅ Business logic comprehensively tested (50+ tests, 89.6% coverage)
- ✅ Unit tests validate extraction, evolution, sensitivity
- ⚠️ CLI entry points not exercised in tests (but not blocking M6.3 completion)
- ⏳ E2E validation can proceed in parallel with M6.4/M6.5 work

**For Production Safety:**
- Extract-knowledge.ts is production-critical (daily workflow)
- E2E validation recommended before expanding usage
- Validate-knowledge-extraction.ts currently non-critical (unused)

---

## Conclusions

1. **Business logic is solid:** 418 tests passing, 89.6% coverage, all M6.3 constraints met
2. **CLI orchestration layer is lean:** Entry points simple, minimal risk from untested code
3. **E2E validation is valuable but not blocking:** Can proceed in Phase 2-3 without delaying M6.3 merge
4. **Repositioning is pragmatic:** validate-knowledge-extraction.ts will find its place in M6.5 QA layer

**Decision:** Proceed with M6.3 merge. E2E testing for extract-knowledge.ts in Phase 2, M6.5 integration for validate-knowledge-extraction.ts in Phase 4.
