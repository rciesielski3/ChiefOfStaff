---
title: M6.3 Knowledge Evolution + CLI Testing Gaps Design
date: 2026-07-21
phase: P2.0 Knowledge Engine (M6.3 Primary, CLI Gaps Secondary)
status: Ready for Implementation
---

# M6.3 Knowledge Evolution + CLI Testing Gaps — Design Spec

**Prepared:** 2026-07-21  
**Phase:** P2.0 Knowledge Engine, Milestone 6  
**Primary Focus:** M6.3 Knowledge Evolution (Knowledge Transformation)  
**Secondary Focus:** CLI Testing Gaps (Documentation + Light Implementation)  
**Execution Model:** Subagent-driven (M6.3) + Inline parallel (CLI gaps)  
**Timeline:** 3 weeks (Week 1 planning, Weeks 2-3 implementation)

---

## Executive Summary

This spec covers two interconnected workstreams:

1. **M6.3 (Knowledge Evolution)** — Implement knowledge deduplication, versioning, and sensitivity assessment to enable permanent knowledge storage in M6.5. The core P2.0 Knowledge Engine transformation phase.

2. **CLI Testing Gaps** — Document untested CLI entry points (extract-knowledge.ts, validate-knowledge-extraction.ts), add basic E2E stubs, and reposition validate-knowledge-extraction.ts as the quality assurance component of M6.5's permanent knowledge base.

Both workstreams execute in parallel with staggered checkpoints, enabling M6.4 (Insight Generation) and M6.5 (Evergreen Knowledge Base) planning to proceed in parallel.

---

## Part 1: M6.3 Knowledge Evolution (Primary)

### 1.1 Purpose & Context

**What M6.3 Solves:**
- Raw extracted facts (M6.1) need deduplication and versioning before permanent storage (M6.5)
- Knowledge should evolve: when new evidence arrives, update existing knowledge rather than duplicate
- Sensitive content (PII, proprietary) must be identified before routing to publication (M6.3 publication decision)
- Current M6.1/M6.2 pipeline produces facts but doesn't deduplicate or track versions

**Why It Matters:**
- Without deduplication: knowledge base grows with redundant entries, bloat increases search noise
- Without versioning: can't track evidence evolution or corrections over time
- Without sensitivity assessment: risk of leaking PII/proprietary data in public exports (M6.6)

### 1.2 Scope & Deliverables

**What M6.3 Produces:**
- ✅ Embeddings service (local, no API cost): compute semantic similarity between facts
- ✅ Evolution logic: detect duplicate/related facts → create versions → update existing entries
- ✅ Sensitivity assessment: flag PII, proprietary, personally-identifiable patterns
- ✅ Workflow integration: wire into daily-brief.yml, pass evolved facts downstream
- ✅ 80%+ test coverage: unit + integration tests validating all paths

**Architecture:**

```
Raw Facts (from M6.1)
    ↓
Embeddings Service (compute semantic vectors)
    ↓
Evolution Logic (detect duplicates/related facts)
    ↓
Sensitivity Assessment (identify PII/proprietary)
    ↓
Versioned Knowledge (stored in M6.5)
    ↓
Publication Routing (M6.3 publication decision)
```

**Data Flow:**
1. Extract facts from article (M6.1): `{ id, article_id, content, type, confidence, extracted_at }`
2. Compute embeddings: `{ fact_id, embedding_vector }`
3. Find related facts: cosine similarity search → matches above threshold (e.g., 0.85)
4. Assess duplicates vs. new evidence:
   - **Exact duplicate:** Skip (deduplication)
   - **Related but newer evidence:** Create new version, link to previous (evolution)
   - **Contradictory:** Flag for manual review, track both versions
   - **New fact:** Store as new entry
5. Sensitivity check: PII patterns, keywords, domain heuristics
6. Output: evolved fact with version chain, sensitivity flags, confidence updates

### 1.3 Design Decisions

#### Embeddings Approach: Local Sentence Transformers (Not API)

**Decision:** Use local `sentence-transformers` (Python/JavaScript library) instead of Claude embeddings or external APIs.

**Rationale:**
- **Cost:** Local models are free; Claude embeddings cost ~$0.02/1K embeddings
- **Privacy:** Embeddings computed locally, not sent to external services
- **Latency:** Sub-second for <100K facts
- **Simplicity:** No API keys, rate limits, or async overhead

**Model:** `all-MiniLM-L6-v2` (lightweight, 384-dim vectors, good quality for fact similarity)

**Implementation:**
- Use `sentence-transformers` npm package (Node.js binding) or Python subprocess
- Cache embeddings in NDJSON: `/data/fact_embeddings.ndjson` (one line per fact)
- Regenerate only for new facts (incremental indexing)

#### Sensitivity Assessment: Rule-Based + Claude Fallback

**Decision:** Heuristic patterns (PII regex, keyword lists) + Claude for edge cases.

**Rationale:**
- **Speed:** Heuristics run in <10ms per fact
- **Cost:** Claude only for low-confidence or ambiguous cases (~5% of facts)
- **Accuracy:** Heuristics catch common PII; Claude handles nuance

**Patterns:**
- PII: Email, phone, SSN, credit card, names (against company/known list), addresses
- Proprietary: Keywords like "confidential", "proprietary", "internal only", custom domain patterns
- Personal: Health details, family info, financial details, location specifics

**Claude Fallback:**
- Trigger: Heuristics uncertain or fact contains multiple potential PII candidates
- Prompt: "Is this fact sensitive (personal, proprietary, PII)? Answer: SENSITIVE or PUBLIC with confidence 0–1."
- Cost: ~$0.01 per uncertain fact, ~$10/week for 50K facts at 5% uncertainty

#### Evolution Logic: Versioning & Linking

**Decision:** Facts remain immutable; new versions created for updates, linked via `replaces` chain.

**Rationale:**
- **Audit trail:** Complete history of fact evolution preserved
- **Safety:** Never overwrite data; always append new versions
- **Correctness:** Can revert to old version if new evidence wrong

**Schema:**
```typescript
interface Fact {
  id: string;                    // Unique ID for this version
  article_id: string;            // Source article
  content: string;               // Fact text
  type: 'DEFINITION' | 'TECHNIQUE' | 'WARNING' | 'BENCHMARK' | 'QUOTE' | 'PATTERN';
  confidence: number;            // 0–1
  extracted_at: string;          // ISO timestamp
  sensitivity: 'PUBLIC' | 'PRIVATE' | 'UNCERTAIN';
  
  // Evolution tracking
  replaces?: string;             // ID of previous version this supersedes
  version: number;               // 1, 2, 3... (increment on update)
  related_facts?: string[];      // IDs of closely related facts (not exact duplicates)
  confidence_updated_by?: string; // "new_evidence" | "correction" | "manual_review"
}
```

**Evolution Rules:**
1. **Exact duplicate** (cosine similarity >0.95): Skip, count as deduplication
2. **High similarity** (0.85–0.95): Likely same fact, different wording
   - If same confidence: deduplicate (keep older)
   - If higher confidence: create new version, link via `replaces`
   - If lower confidence: skip (existing is more confident)
3. **Medium similarity** (0.70–0.85): Related but distinct
   - Link via `related_facts[]`
   - Both stored as independent facts
4. **Low similarity** (<0.70): New fact, store as-is

**Success Criteria for Evolution:**
- ≥15% of new facts matched to existing (deduplication/versioning happening)
- Average 1.5 versions per fact by end of week (evidence accumulating)
- Zero lost facts (all versions queryable)

### 1.4 Tasks (TDD-Driven)

**Task 1: Embeddings Service**
- **Deliverable:** `src/services/embeddings.ts`
- **Input:** Fact array `{ id, content }`
- **Output:** Embeddings array `{ fact_id, vector: number[] }`
- **Tests:**
  - Similar facts (same domain, different wording) → high cosine similarity
  - Dissimilar facts (different domains) → low cosine similarity
  - Caching: embeddings stored/retrieved from NDJSON
- **Coverage:** ≥85%
- **Acceptance:** Similarity search returns top-N facts ranked by cosine distance

**Task 2: Evolution Logic**
- **Deliverable:** `src/services/evolution-engine.ts`
- **Input:** New fact + existing fact store
- **Output:** `{ action: 'deduplicate' | 'version' | 'relate' | 'new', result: Fact }`
- **Tests:**
  - Exact duplicate (>0.95) → deduplicate, log dedup count
  - High similarity (0.85–0.95), higher confidence → create version, link via `replaces`
  - Medium similarity (0.70–0.85) → relate via `related_facts[]`
  - New fact (<0.70) → store as-is
- **Coverage:** ≥85%
- **Acceptance:** 15%+ dedup/version rate on sample 100 facts

**Task 3: Sensitivity Assessment**
- **Deliverable:** `src/services/sensitivity-assessor.ts`
- **Input:** Fact `{ content, domain, type }`
- **Output:** `{ sensitivity: 'PUBLIC' | 'PRIVATE' | 'UNCERTAIN', confidence: number, reasons: string[] }`
- **Tests:**
  - PII patterns (email, phone, SSN, names) → marked PRIVATE
  - Proprietary keywords → marked PRIVATE
  - Generic facts (no PII/proprietary markers) → marked PUBLIC
  - Ambiguous cases (low heuristic confidence) → marked UNCERTAIN (triggers Claude)
- **Coverage:** ≥85%
- **Acceptance:** Zero false negatives on PII test set (no PII facts marked PUBLIC)

**Task 4: Workflow Integration**
- **Deliverable:** Updated `src/business-logic/knowledge-extraction.ts`
- **Changes:**
  - After facts extracted (M6.1), run through evolution engine
  - Store evolved facts to `/data/knowledge_facts.ndjson`
  - Pass evolved facts + sensitivity tags to M6.3 publication decision
- **Workflow:** Update `.github/workflows/daily-brief.yml`
  - Add evolution step (call evolution service on extracted facts)
  - Output: evolved facts file
- **Tests:**
  - End-to-end: article → extract → evolve → store
  - Facts correctly versioned in NDJSON
  - Sensitivity tags applied
- **Coverage:** ≥80%
- **Acceptance:** Workflow runs successfully, facts stored with versions/sensitivity

**Task 5: Integration Tests**
- **Deliverable:** `tests/integration/m6.3-evolution.test.ts`
- **Test Scenarios:**
  - 100 facts from 5 articles: expected dedup/version rates match success criteria
  - Sensitivity assessment: zero PII leaks in PRIVATE facts, correct PUBLIC classification
  - Version chains: facts with multiple versions queryable, history preserved
  - Workflow end-to-end: article → facts → evolution → storage
- **Coverage:** ≥80%
- **Success Criteria Met:**
  - ✅ 15%+ evolution rate (dedup + versioning)
  - ✅ Zero false-negative PII (no sensitive facts marked PUBLIC)
  - ✅ All tests passing
  - ✅ Workflow runs nightly without errors

### 1.5 Success Criteria (M6.3)

| Criterion | Threshold | Verification |
|-----------|-----------|---------------|
| Evolution rate | ≥15% | Dedup + version count / total new facts |
| PII sensitivity | Zero false negatives | Manual review of sample PRIVATE facts |
| Code coverage | ≥80% | Jest coverage report |
| Test suite | All passing | 50+ tests across 5 tasks |
| Workflow | Runs nightly | GitHub Actions succeeds 7/7 days |
| Confidence update | Average >0.05 increase per version | Track confidence before/after evolution |

---

## Part 2: CLI Testing Gaps (Secondary)

### 2.1 Purpose & Context

**Current Situation:**
- `src/cli/extract-knowledge.ts` (256 lines): Invoked by daily-brief.yml workflow, never tested end-to-end
- `src/cli/validate-knowledge-extraction.ts` (380 lines): Standalone validation tool, aspirational (not integrated)
- Both CLI entry points callable from shell but missing automated validation
- No E2E tests verify CLI logic (environment variables, exit codes, file I/O, concurrency)

**Why It Matters:**
- CLI tools are integration points between TypeScript services and shell orchestration
- Untested CLI = risk of silent failures (script errors masked by `continue-on-error`)
- Unvalidated tooling = reduced operational visibility into knowledge pipeline health

### 2.2 Scope & Deliverables

**What This Phase Produces:**
- ✅ CLI Testing Gaps documentation: what's untested, why it matters, scope of future E2E work
- ✅ E2E stubs for extract-knowledge.ts: verify CLI is callable, basic invocation test
- ✅ Reposition validate-knowledge-extraction.ts: document as future M6.5 QA component (not standalone tool)
- ✅ Honest test scoping: business logic tested ✅, CLI orchestration partially tested (stubs only)

### 2.3 Tasks

**Task 1: Document CLI Testing Gaps**
- **Deliverable:** `/docs/knowledge/cli-testing-gaps.md`
- **Content:**
  - extract-knowledge.ts: 256 lines, entry point logic, what's tested (business logic), what's not (CLI orchestration)
  - validate-knowledge-extraction.ts: 380 lines, current status (aspirational, not integrated), future role (M6.5 QA)
  - Why it matters: CLI logic not validated end-to-end, potential silent failures in workflow
  - Scope of future E2E tests: env vars (CONCURRENCY, BATCH_SIZE), exit codes (success/failure), file I/O (read articles, write facts), concurrency validation (N parallel processes don't corrupt data)
  - Estimated effort: 3-4 hours for comprehensive E2E suite (deferred to future phase)
- **Format:** Markdown, clear sections, actionable

**Task 2: Add E2E Stubs for extract-knowledge.ts**
- **Deliverable:** `tests/e2e/extract-knowledge.stub.test.ts`
- **Tests:**
  - CLI callable: `npx ts-node src/cli/extract-knowledge.ts --help` exits 0
  - Basic invocation: Run with mock article, verify output file created
  - Exit codes: Success path (exit 0), failure path (exit 1 on bad input)
  - Documentation: "Stubs verify CLI is callable; full E2E testing (env vars, concurrency) deferred to future phase"
- **Scope:** Light stubs only, not comprehensive E2E
- **Coverage:** ≥50% (basic paths only)

**Task 3: Reposition validate-knowledge-extraction.ts**
- **Deliverable:** Documentation + code header update
- **Content:**
  - Update `/docs/knowledge/cli-testing-gaps.md`: note validate-knowledge-extraction.ts as future M6.5 QA component
  - Update `src/cli/validate-knowledge-extraction.ts` header: "Aspirational tool, planned for M6.5 integration as KnowledgeQualityValidator service"
  - Decision: Keep for now (not removing), integrate in M6.5 sprint
  - Use case: Pre-storage validation for knowledge base permanence checks

### 2.4 Success Criteria (CLI Gaps)

| Criterion | Threshold | Verification |
|-----------|-----------|---------------|
| Gap documentation | Complete | `/docs/knowledge/cli-testing-gaps.md` covers all 3 items |
| E2E stubs | Callable verified | `extract-knowledge.ts --help` and basic invocation working |
| Test coverage | ≥50% | Jest coverage for stub tests |
| Test suite | All passing | No failures, 10+ tests |
| Reposition documented | Clear | validate-knowledge-extraction.ts role documented as future M6.5 component |

---

## Part 3: Integration — M6.5 QA Layer

### 3.1 How CLI Validation Becomes M6.5 Component

**Current State (CLI):**
- validate-knowledge-extraction.ts: standalone tool, calculates metrics (fact count, confidence distribution, domain breakdown)
- Use case: Manual QA, reporting
- Integration: None (not called by workflows)

**Future State (M6.5 QA Service):**
- Rename to `src/services/KnowledgeQualityValidator.ts`
- Keep CLI interface: `npx ts-node src/cli/validate-knowledge.ts` for manual QA
- Add service export for pipeline use: `KnowledgeQualityValidator.validate(facts)`
- Use case: Pre-storage validation (before facts enter knowledge graph), audit trails, reporting
- Integration: Called by M6.5 storage pipeline before facts are versioned/committed

**Quality Gates (M6.5 will enforce):**
- Confidence threshold: ≥0.5 (reject low-confidence facts)
- Structure validation: Required fields present (id, content, type, confidence)
- Duplicate detection: No duplicate IDs in batch
- Audit trail: Log all validation results (passed/rejected, reasons)

**Reporting (M6.5 will produce):**
- Weekly knowledge base health: quality metrics over time
- Fact survival rate: % of facts passing validation
- Sensitivity breakdown: PUBLIC/PRIVATE/UNCERTAIN distribution
- Evolution metrics: version chains, average versions per fact

### 3.2 Design For M6.5 (Deferred Implementation)

**Spec location:** `/docs/knowledge/m6.5-qa-design.md` (to be written in Week 1)

**Key Points:**
- Validate-knowledge-extraction.ts → KnowledgeQualityValidator service (rename/refactor)
- CLI remains for manual inspection: `npx ts-node src/cli/validate-knowledge.ts facts.ndjson`
- Service call signature: `validator.validateBatch(facts: Fact[]): ValidationResult`
- Output: `{ passed: Fact[], rejected: Fact[], report: QAReport }`

---

## Part 4: Timeline & Execution

### 4.1 Week 1: Planning & Spec Writing

**Tasks (Me):**
- Finalize M6.3 detailed task specs (this document is high-level; detailed code patterns needed)
- Write CLI gaps documentation (task 1, see Part 2.3)
- Write M6.5 QA design spec (`/docs/knowledge/m6.5-qa-design.md`)
- **Deliverable:** 3 specs ready for implementation

**Deliverables:**
- ✅ `docs/superpowers/specs/2026-07-21-m6-3-knowledge-evolution-cli-gaps-design.md` (this file)
- ✅ `/docs/knowledge/cli-testing-gaps.md` (gap analysis)
- ✅ `/docs/knowledge/m6.5-qa-design.md` (M6.5 QA spec for future sprint)

### 4.2 Week 2-3: Implementation & Parallel Work

**Subagent Work (M6.3):**
- Implementer subagent receives M6.3 detailed spec (tasks 1-5)
- TDD approach: test-first for each task
- Checkpoint reviews after each task or task group
- **Expected output:** 5 tasks complete, all tests passing, ready for code review

**Inline Work (CLI Gaps):**
- Task 1: Write CLI gaps documentation (2 hours)
- Task 2: Add E2E stubs for extract-knowledge.ts (3 hours)
- Task 3: Update validate-knowledge-extraction.ts positioning (1 hour)
- **Parallel to M6.3 implementation**, not blocked
- **Expected output:** 3 tasks complete, E2E stubs working, tests passing

**Parallel Planning (M6.5):**
- Based on M6.3 shape (what evolves, how versioning works), finalize M6.5 storage design
- Document how KnowledgeQualityValidator integrates into M6.5 pipeline
- **Deliverable:** M6.5 detailed spec ready for next sprint

### 4.3 Week 3: Review Gates & Checkpoint

**Code Review (M6.3):**
- Subagent completes implementation
- Second review agent evaluates: spec compliance ✅, code quality ✅, all tests passing ✅
- Fix any findings, re-review if needed
- **Outcome:** Ready to merge to main

**Code Review (CLI Gaps):**
- E2E stubs reviewed: basic calls verified, tests passing ✅
- Gap documentation reviewed: clear, actionable ✅
- **Outcome:** Ready to merge to main (separate PR)

**Planning Gate (M6.5 + M6.4):**
- M6.5 QA design approved
- M6.4 (Insight Generation) planning begins
- **Outcome:** Ready for next sprint task assignments

### 4.4 Post-Checkpoint: Merge & Next Phase

**Merge to main:**
- PR #30: M6.3 Knowledge Evolution (5 tasks, TDD, 80%+ coverage)
- PR #31: CLI Testing Gaps (E2E stubs, documentation, repositioning)

**Next Sprint:**
- M6.4 Insight Generation (subagent-driven)
- M6.5 Evergreen Knowledge Base (subagent-driven)
- Parallel: Knowledge graph design refinement

---

## Part 5: Success Metrics & Go/No-Go Gates

### 5.1 M6.3 Completion Gate (End of Week 3)

**Must Have (Go/No-Go):**
- ✅ Evolution rate ≥15% (dedup + versioning)
- ✅ Zero false-negative PII (no sensitive facts marked PUBLIC)
- ✅ All M6.3 tests passing (50+ tests, ≥80% coverage)
- ✅ Workflow runs nightly without errors

**Should Have:**
- ✅ Average confidence increase ≥0.05 per version
- ✅ Related facts properly linked via `related_facts[]`

**If not met:** Pause M6.4/M6.5 work, debug M6.3, re-review

### 5.2 CLI Gaps Completion Gate (End of Week 3)

**Must Have (Go/No-Go):**
- ✅ Gap documentation complete (`/docs/knowledge/cli-testing-gaps.md`)
- ✅ E2E stubs added (extract-knowledge.ts callable verified)
- ✅ All CLI stub tests passing (≥50% coverage)
- ✅ validate-knowledge-extraction.ts repositioning documented

**Should Have:**
- ✅ Zero warnings in test output
- ✅ Gap analysis actionable (clear scope for future E2E work)

**If not met:** Minimal impact to M6.3 (separate workstream), fix in follow-up

### 5.3 End-of-Phase Metrics

| Metric | Target | Actual (end of week 3) |
|--------|--------|----------------------|
| M6.3 tests passing | 50+ | _ |
| M6.3 coverage | ≥80% | _ |
| Evolution rate | ≥15% | _ |
| PII false negatives | 0 | _ |
| CLI gap docs | Complete | _ |
| E2E stubs working | ✅ | _ |
| validate-knowledge-extraction.ts repositioned | ✅ | _ |

---

## Part 6: Risks & Mitigations

### 6.1 Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|-----------|
| Embedding quality poor (low dedup rate) | Evolution logic ineffective | Medium | Tuning threshold (0.85 → 0.80 if needed), test with domain-specific facts |
| Sensitivity assessment misses PII | PII leak in public exports | Low | Manual review of sample PRIVATE facts, Claude fallback for edge cases |
| M6.3 and M6.5 requirements conflict | Rework in M6.5 sprint | Low | Early M6.5 spec writing (Week 1) catches conflicts before M6.3 implementation |
| CLI stubs insufficient for future E2E | More E2E work needed later | Medium | OK by design (stubs are intentionally light, full E2E in future sprint) |
| Subagent takes longer than expected | Schedule slip | Medium | TDD checkpoints every task, early visibility into blockers |

### 6.2 Mitigations

1. **Early M6.5 spec writing:** Catch conflicts between evolution logic and storage design before M6.3 code written
2. **TDD checkpoints:** Each M6.3 task reviewed after implementation, not at end
3. **Embedding tuning:** If dedup rate <15%, adjust similarity threshold and re-test
4. **PII validation:** Manual spot-check of PRIVATE facts, Claude fallback for ambiguous cases
5. **CLI stubs as MVP:** Intentionally light; document scope clearly so future E2E is expected, not surprise

---

## Part 7: Dependencies & Assumptions

### 7.1 Dependencies

**Hard dependencies:**
- M6.1 (Knowledge Extraction) merged to main
- M6.2 (Domain Classification) merged to main
- Article store and fact storage working (M6.1 deliverable)

**Soft dependencies:**
- M6.3 publication decision (not yet designed, but loosely related)
- M6.4 insight generation (consumes evolved facts)
- M6.5 storage design (consumes versioned facts with sensitivity flags)

### 7.2 Assumptions

1. **Embeddings cost/performance acceptable:** Local sentence-transformers can handle <100K facts in <5 seconds
2. **Sensitivity patterns sufficient:** Heuristics catch 95%+ of PII; Claude fallback handles edge cases cost-effectively
3. **Evolution rate ≥15% achievable:** Daily articles produce enough duplicate/related facts for versioning to be meaningful
4. **CLI stubs adequate for now:** E2E testing deferred to future sprint, doesn't block M6.3 merge

### 7.3 Constraints

- **No VPS deployment:** Work stays on GitHub, no external hosting yet (user constraint)
- **GitHub Actions only:** No n8n or external orchestration
- **Subagent-driven:** M6.3 implementation via fresh subagent, not inline (execution model choice)

---

## Part 8: Detailed Task Breakdown (For Subagent Dispatch)

### 8.1 M6.3 Task 1: Embeddings Service

**Objective:** Compute semantic similarity between facts using local embeddings

**Inputs:**
- Fact array: `[{ id, content }, ...]`
- Similarity threshold: 0.85 (configurable)

**Outputs:**
- Embeddings: `{ fact_id, vector: number[] }`
- Similarity search: `(fact_id) → [{ related_fact_id, similarity_score }, ...]`

**Tests:**
- `test('similar facts have high cosine similarity')`: Same domain, different wording → >0.8
- `test('dissimilar facts have low similarity')`: Different domains → <0.7
- `test('embeddings cached in NDJSON')`: Store and retrieve embeddings
- `test('similarity search returns top-N')`: Query for related facts, top-5 returned ranked by score

**Code Pattern:**
```typescript
// src/services/embeddings.ts
export class EmbeddingsService {
  constructor(modelPath?: string) { /* load sentence-transformers model */ }
  
  embedFact(fact: { id: string; content: string }): { fact_id: string; vector: number[] }
  
  similaritySearch(factId: string, topN: number = 5): RelatedFact[]
  
  saveCacheToNDJSON(path: string): void
  loadCacheFromNDJSON(path: string): void
}
```

**Acceptance Criteria:**
- ✅ Similarity search returns related facts ranked by score
- ✅ Embeddings cached, no recomputation on subsequent runs
- ✅ <5 second runtime for 1K facts

### 8.2 M6.3 Task 2: Evolution Logic

**Objective:** Detect duplicates, create versions, link related facts

**Inputs:**
- New fact: `{ id, content, type, confidence }`
- Existing facts store
- Embeddings service

**Outputs:**
- Action: `'deduplicate' | 'version' | 'relate' | 'new'`
- Result: Evolved fact with version chain / related links

**Tests:**
- `test('exact duplicate >0.95 similarity deduplicated')`: Count dedup, skip storage
- `test('high similarity >0.85 with higher confidence versions')`: Creates new version, links via `replaces`
- `test('medium similarity 0.70-0.85 relates via related_facts[]')`: Stores both, links as related
- `test('low similarity <0.70 stored as new fact')`: No linking
- `test('dedup rate ≥15% on sample 100 facts')`: Meets success criteria

**Code Pattern:**
```typescript
// src/services/evolution-engine.ts
export interface EvolutionResult {
  action: 'deduplicate' | 'version' | 'relate' | 'new';
  fact?: Fact;  // If action is 'version', 'relate', 'new'
  skipReason?: string;  // If action is 'deduplicate'
}

export class EvolutionEngine {
  constructor(embeddingsService: EmbeddingsService, factStore: FactStore) {}
  
  processNewFact(newFact: Fact): EvolutionResult
  
  // Helper methods
  private findRelatedFacts(fact: Fact): { similarity: number; fact: Fact }[]
  private createVersion(oldFact: Fact, newFact: Fact): Fact
  private linkRelated(fact1: Fact, fact2: Fact): void
}
```

**Acceptance Criteria:**
- ✅ Dedup rate ≥15%
- ✅ Version chains preserved (can query history)
- ✅ Related facts linked and queryable

### 8.3 M6.3 Task 3: Sensitivity Assessment

**Objective:** Flag PII, proprietary, personally-identifiable facts

**Inputs:**
- Fact: `{ id, content, domain, type }`

**Outputs:**
- Sensitivity: `'PUBLIC' | 'PRIVATE' | 'UNCERTAIN'`
- Confidence: 0–1
- Reasons: string[] (why marked PRIVATE)

**Tests:**
- `test('PII patterns marked PRIVATE')`: Emails, phones, SSNs, names → PRIVATE
- `test('proprietary keywords marked PRIVATE')`: "confidential", "internal" → PRIVATE
- `test('generic facts marked PUBLIC')`: Generic facts with no PII → PUBLIC
- `test('ambiguous cases marked UNCERTAIN')`: Low heuristic confidence → UNCERTAIN (triggers Claude)
- `test('zero false negatives on PII test set')`: All PII facts caught, none marked PUBLIC

**Code Pattern:**
```typescript
// src/services/sensitivity-assessor.ts
export interface SensitivityResult {
  sensitivity: 'PUBLIC' | 'PRIVATE' | 'UNCERTAIN';
  confidence: number;
  reasons: string[];
}

export class SensitivityAssessor {
  assessFact(fact: Fact): SensitivityResult
  
  // Private helpers
  private heuristicCheck(content: string): { sensitivity: 'PUBLIC' | 'PRIVATE' | 'UNCERTAIN'; confidence: number; reasons: string[] }
  private claudeFallback(fact: Fact, heuristicResult: SensitivityResult): Promise<SensitivityResult>
}
```

**PII Patterns:**
- Email: `/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/`
- Phone: `/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/`
- SSN: `/\b\d{3}-\d{2}-\d{4}\b/`
- Credit card: `/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/`
- Names: Against company/known list (configure)

**Proprietary Keywords:** "confidential", "proprietary", "internal only", "not for distribution", "do not share"

**Acceptance Criteria:**
- ✅ Zero false-negative PII (all PII facts caught)
- ✅ <5% false positives (generic facts marked PRIVATE)
- ✅ Claude fallback <5% of facts (cost-effective)

### 8.4 M6.3 Task 4: Workflow Integration

**Objective:** Wire evolution logic into daily-brief.yml

**Changes:**
- Call evolution engine after fact extraction
- Store evolved facts to NDJSON
- Pass facts + sensitivity tags downstream

**Tests:**
- `test('end-to-end article → extract → evolve → store')`: Full pipeline
- `test('facts stored with versions and sensitivity')`: NDJSON has version/sensitivity fields
- `test('workflow runs nightly without errors')`: GitHub Actions succeeds

**Code Changes:**
1. Update `src/business-logic/knowledge-extraction.ts`:
   - After `extractFacts()`, call `evolutionEngine.processNewFact()`
   - Before storing, call `sensitivityAssessor.assessFact()`

2. Update `.github/workflows/daily-brief.yml`:
   - Add step: "Run knowledge evolution" (calls TS script)
   - Output: evolved facts file

**Acceptance Criteria:**
- ✅ Workflow runs successfully nightly
- ✅ Evolved facts stored with version/sensitivity fields
- ✅ No data loss (facts not skipped without reason)

### 8.5 M6.3 Task 5: Integration Tests

**Objective:** Validate end-to-end evolution pipeline

**Test Scenarios:**
- 100 facts from 5 articles: dedup/version rates match success criteria
- Sensitivity assessment: zero PII leaks, correct PUBLIC classification
- Version chains: queryable, history preserved
- Workflow: article → facts → evolution → storage

**Tests:**
- `test('100 facts from 5 articles: ≥15% evolution rate')`: Dedup + version count / 100 ≥ 15%
- `test('sensitivity: zero PII in PUBLIC facts')`: Manual spot-check + automated validation
- `test('version chains queryable')`: Get all versions of a fact, ordered chronologically
- `test('workflow end-to-end')`: Simulate daily-brief.yml, verify output

**Acceptance Criteria:**
- ✅ 15%+ evolution rate
- ✅ Zero PII false negatives
- ✅ All tests passing
- ✅ Workflow runs successfully

---

## Part 9: Success Metrics Summary

### End-of-Phase (Week 3 Checkpoint)

| Metric | Target | Pass/Fail |
|--------|--------|-----------|
| M6.3 tests | 50+ passing, ≥80% coverage | _ |
| Evolution rate | ≥15% (dedup + versioning) | _ |
| PII sensitivity | Zero false negatives | _ |
| Workflow stability | Runs nightly, 7/7 days | _ |
| CLI gap docs | Complete, actionable | _ |
| E2E stubs | Working, ≥50% coverage | _ |
| M6.5 QA spec | Ready for next sprint | _ |

---

## Appendix: File Structure

**New/Modified Files:**

```
src/services/
├── embeddings.ts (NEW)
├── evolution-engine.ts (NEW)
├── sensitivity-assessor.ts (NEW)
├── knowledge-extraction.ts (MODIFIED - wire evolution + sensitivity)

tests/
├── services/
│   ├── embeddings.test.ts (NEW)
│   ├── evolution-engine.test.ts (NEW)
│   ├── sensitivity-assessor.test.ts (NEW)
├── e2e/
│   ├── extract-knowledge.stub.test.ts (NEW)
├── integration/
│   ├── m6.3-evolution.test.ts (NEW)

.github/workflows/
├── daily-brief.yml (MODIFIED - add evolution step)

docs/knowledge/
├── cli-testing-gaps.md (NEW)
├── m6.5-qa-design.md (NEW)
├── evolution-schema.md (NEW - documents Fact versioning schema)
```

---

## Approval & Next Steps

This spec is ready for:
1. ✅ User review and approval
2. ✅ Subagent dispatch for M6.3 implementation (after approval)
3. ✅ Inline work dispatch for CLI gaps (after approval)

**Next:** Writing implementation plan (subagent-driven approach) once spec approved.

