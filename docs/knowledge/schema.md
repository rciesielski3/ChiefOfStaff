# Knowledge Fact Schema

## Overview

This document defines the schema for knowledge facts extracted from articles in the P2.0 Knowledge Engine (M6.1 Knowledge Extraction).

A **knowledge fact** is a durable, reusable piece of information extracted from an article with:
- Clear source attribution
- Confidence scoring
- Semantic type classification
- Citation tracking for cross-referencing

---

## Fact Types

Knowledge facts are classified into seven semantic types:

| Type | Description | Example | Confidence Threshold |
|------|-------------|---------|---------------------|
| **DEFINITION** | Explains what something is or means | "Kubernetes is a container orchestration platform" | 0.9+ |
| **TECHNIQUE** | How-to, procedure, or best practice | "Use exponential backoff for API retries" | 0.8+ |
| **WARNING** | Important caution, risk, or pitfall | "Never hardcode credentials in source code" | 0.95+ |
| **BENCHMARK** | Measurable metric or performance data | "AWS Lambda has a 15-minute timeout limit" | 0.85+ |
| **QUOTE** | Direct or near-direct quotation from author | "The future is already here, it's just not evenly distributed" | 1.0 (verbatim) |
| **PATTERN** | Observed trend or recurring relationship | "Microservices increase operational complexity" | 0.75+ |
| **INSIGHT** | Synthesized conclusion or analysis (rare in extraction, common in M6.4) | "Kubernetes adoption correlates with team size >10" | 0.7+ |

---

## Fact Data Structure

### TypeScript Interface

```typescript
interface KnowledgeFact {
  // Unique identifier (generated)
  id: string;

  // Source article
  article_id: string;

  // Fact content
  content: string;                    // The actual fact text (50-500 chars)
  type: FactType;                     // Semantic classification

  // Confidence and quality
  confidence: number;                 // 0.0–1.0, reflects how certain the extraction is
  extraction_method: 'claude' | 'manual';  // How was this fact extracted

  // Citations
  source_text?: string;               // Exact quote from article (if QUOTE type)
  source_location?: {
    section?: string;                 // Article section (title, summary, body)
    paragraph?: number;               // Paragraph index if available
  };

  // Metadata
  domain?: string;                    // Filled by M6.2 (e.g., "Technology/AI")
  keywords?: string[];                // Key terms for searchability
  extracted_at: Date;                 // ISO timestamp

  // Versioning & tracking
  version: number;                    // Incremented if fact is updated
  superseded_by?: string;             // ID of fact that replaces this one
  status: 'active' | 'superseded' | 'deprecated';  // Lifecycle status
}

type FactType = 'DEFINITION' | 'TECHNIQUE' | 'WARNING' | 'BENCHMARK' | 'QUOTE' | 'PATTERN' | 'INSIGHT';
```

---

## NDJSON Storage Format

Facts are persisted in `/data/knowledge_facts.ndjson` (one fact per line, newline-delimited JSON).

### Example Entry

```json
{"id":"fact_001","article_id":"article_2601","content":"Kubernetes uses declarative configuration for desired state management","type":"DEFINITION","confidence":0.92,"extraction_method":"claude","domain":"Technology/DevOps","keywords":["kubernetes","declarative","state"],"extracted_at":"2026-07-15T10:30:00Z","version":1,"status":"active"}
{"id":"fact_002","article_id":"article_2601","content":"Set resource requests and limits to prevent pod eviction","type":"TECHNIQUE","confidence":0.88,"extraction_method":"claude","domain":"Technology/DevOps","keywords":["kubernetes","resource","limits"],"extracted_at":"2026-07-15T10:30:00Z","version":1,"status":"active"}
```

---

## Confidence Scoring Guide

Confidence reflects **extraction certainty** (not fact accuracy). Higher scores = more direct/clear statement in original article.

### Scoring Scale

| Score | Meaning | Guideline |
|-------|---------|-----------|
| **0.95–1.0** | Direct quote or unmistakable fact | Verbatim text from article; no interpretation needed |
| **0.85–0.94** | Clear statement, minimal interpretation | Article explicitly says this; Claude interpretation is straightforward |
| **0.75–0.84** | Reasonable inference, small interpretation gap | Article implies this, but Claude inferred it; still high confidence |
| **0.65–0.74** | Moderate inference required | Multi-sentence synthesis; some interpretation bias |
| **0.55–0.64** | Significant inference | Across multiple sections; some interpretation required |
| **< 0.55** | Speculative / Low confidence | Don't extract; too uncertain |

### Confidence Modifiers

Claude extraction service should **lower confidence** by:
- `-0.05` per paragraph of separation (fact synthesized across multiple paragraphs)
- `-0.10` if article contradicts fact elsewhere (conflicting signals)
- `-0.08` for specialized domains requiring expert knowledge (ML math, advanced algorithms)
- `-0.03` if phrasing differs significantly from original (paraphrasing)

**Minimum threshold for extraction:** 0.50 confidence (anything lower is discarded)

---

## Deduplication

Facts are deduplicated on insert via **MD5 hash of normalized content**:

```typescript
const normalized = fact.content.toLowerCase().trim().replace(/\s+/g, ' ');
const hash = md5(normalized);
```

Rules:
- If hash exists in `/data/knowledge_facts.ndjson`, skip insertion
- If fact updates existing fact (new source/version), create new entry with `version: n+1` and set old entry's `superseded_by: new_id`
- Log deduplication events for monitoring

---

## Fact Extraction Workflow

```
Article → [Claude extracts facts] → [Filter by confidence ≥ 0.5]
         → [Deduplicate by hash]
         → [Assign ID]
         → [Add metadata]
         → [Append to knowledge_facts.ndjson]
         → [Log metrics]
```

---

## Validation Rules

On insert, facts MUST:

- ✅ Have non-empty `content` (50–500 chars)
- ✅ Have valid `type` from FactType enum
- ✅ Have `confidence` ∈ [0.0, 1.0]
- ✅ Have valid `article_id` referencing existing article
- ✅ Have `extracted_at` as valid ISO timestamp
- ✅ Not be a duplicate (dedup check passes)

---

## Future Extensions (M6.5+)

- **Cross-referencing:** Add `related_facts: string[]` to link related facts
- **Versioning:** Track fact evolution (corrections, refinements)
- **Sourcing:** Attribution beyond article (X said this independently, Y contradicts)
- **Graph structure:** Facts become nodes in knowledge graph with semantic edges

---

## References

- M6.1: Knowledge Extraction (this phase)
- M6.2: Domain Classification (adds domain tags)
- M6.4: Insight Generation (consumes facts for synthesis)
- M6.5: Evergreen Knowledge Base (storage & querying)
