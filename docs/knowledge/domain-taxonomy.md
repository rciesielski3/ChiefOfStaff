# Domain Classification Taxonomy (M6.2)

## Overview

This document defines the 26-domain taxonomy for classifying extracted knowledge facts. Used by the heuristic domain classifier (M6.2 Task 3) and Claude fallback (M6.2 Task 4).

---

## Domain Structure

### AI/ML (6 domains)

| Domain | Keywords | Fact Types |
|--------|----------|-----------|
| **ai-safety** | safety, alignment, x-risk, adversarial, robustness, interpretability, ethics, bias, governance | WARNING, PATTERN, BENCHMARK |
| **ml-ops** | mlops, model deployment, ml infrastructure, ml lifecycle, model serving, pipeline, monitoring, versioning | TECHNIQUE, BENCHMARK, DEFINITION |
| **nlp** | natural language, nlp, transformers, bert, gpt, language model, tokenization, embedding, text processing | DEFINITION, TECHNIQUE, BENCHMARK |
| **computer-vision** | vision, cv, image processing, object detection, cnn, convolutional, face recognition, semantic segmentation | DEFINITION, TECHNIQUE, BENCHMARK |
| **reinforcement-learning** | reinforcement learning, rl, reward, policy, q-learning, actor-critic, markov decision, game playing | DEFINITION, TECHNIQUE, BENCHMARK |
| **llm-applications** | llm, large language model, gpt application, chatbot, retrieval-augmented, rag, prompting, chain-of-thought | TECHNIQUE, DEFINITION, BENCHMARK |

### Infrastructure (5 domains)

| Domain | Keywords | Fact Types |
|--------|----------|-----------|
| **cloud-infra** | cloud, aws, azure, gcp, cloud computing, scalability, lambda, serverless, instance, load balancing | DEFINITION, TECHNIQUE, BENCHMARK |
| **devops** | devops, deployment, ci/cd, automation, infrastructure as code, terraform, orchestration, container | TECHNIQUE, DEFINITION, BENCHMARK |
| **databases** | database, sql, nosql, postgres, mongodb, redis, cache, query, schema, indexing, replication | DEFINITION, TECHNIQUE, BENCHMARK |
| **networking** | network, dns, http, tcp/ip, protocol, latency, bandwidth, cdn, websocket, firewall | DEFINITION, TECHNIQUE, BENCHMARK |
| **security** | security, encryption, authentication, authorization, oauth, jwt, tls, ssl, vulnerability, penetration | TECHNIQUE, WARNING, DEFINITION |

### Languages (5 domains)

| Domain | Keywords | Fact Types |
|--------|----------|-----------|
| **javascript** | javascript, js, node.js, npm, react, vue, angular, typescript, async/await, promise, es6 | DEFINITION, TECHNIQUE, BENCHMARK |
| **python** | python, pip, django, flask, fastapi, numpy, pandas, scikit-learn, asyncio, decorator | DEFINITION, TECHNIQUE, BENCHMARK |
| **rust** | rust, cargo, ownership, borrow, lifetime, async, tokio, webassembly, wasm, systems programming | DEFINITION, TECHNIQUE, BENCHMARK |
| **go** | go, golang, goroutine, channel, concurrency, defer, interface, package, microservice | DEFINITION, TECHNIQUE, BENCHMARK |
| **other-languages** | java, c++, c#, kotlin, swift, ruby, php, scala, haskell, erlang, clojure | DEFINITION, TECHNIQUE, BENCHMARK |

### Web/Frontend (4 domains)

| Domain | Keywords | Fact Types |
|--------|----------|-----------|
| **web-dev** | web, http, rest, graphql, api, endpoint, cors, web server, full-stack, web architecture | DEFINITION, TECHNIQUE, BENCHMARK |
| **frontend-frameworks** | frontend, ui, component, state management, redux, vuex, hooks, lifecycle, virtual dom | DEFINITION, TECHNIQUE, BENCHMARK |
| **css-design** | css, design, layout, flexbox, grid, responsive, animation, sass, styled components, theme | DEFINITION, TECHNIQUE, BENCHMARK |
| **accessibility** | accessibility, a11y, wcag, screen reader, keyboard navigation, aria, inclusive design, ada | DEFINITION, TECHNIQUE, WARNING |

### Other (6 domains)

| Domain | Keywords | Fact Types |
|--------|----------|-----------|
| **cryptography** | cryptography, cipher, hash, sha, md5, rsa, ecdsa, public key, private key, encryption algorithm | DEFINITION, TECHNIQUE, BENCHMARK |
| **performance** | performance, optimization, profiling, latency, throughput, memory, cpu, benchmarking, caching | TECHNIQUE, BENCHMARK, PATTERN |
| **testing** | testing, unit test, integration test, e2e, jest, pytest, mocking, coverage, tdd, bdd | TECHNIQUE, DEFINITION, BENCHMARK |
| **documentation** | documentation, docs, readme, api docs, docstring, markdown, technical writing, tutorial | DEFINITION, TECHNIQUE |
| **open-source** | open source, open source software, contribution, community, license, github, pull request | PATTERN, DEFINITION, TECHNIQUE |
| **general** | general, misc, other, uncategorized | Any (fallback) |

---

## Classification Algorithm

### Heuristic Approach (Task 3)

1. **Keyword Matching** (primary)
   - Split fact content into lowercase words
   - Check against domain keyword lists
   - Count keyword matches per domain
   - Top domain wins

2. **Fact Type Hints** (secondary)
   - BENCHMARK → data science domains (ml-ops, reinforcement-learning, nlp, performance)
   - TECHNIQUE → development domains (javascript, python, rust, go, devops, web-dev)
   - WARNING → security/safety domains (ai-safety, security, accessibility)
   - DEFINITION → all domains equally likely
   - PATTERN → trends/infrastructure domains (open-source, devops, web-dev)
   - QUOTE → no type hint (rely on content)
   - INSIGHT → no type hint (rely on content)

3. **Confidence Scoring**
   - High (0.80+): Strong keyword match (3+ keywords) + matching type hint
   - Medium (0.60-0.79): Keyword match (2 keywords) OR type hint alone
   - Low (0.30-0.59): Weak match (1 keyword) or type mismatch
   - Default: "general" with 0.3 confidence (fallback)

### Claude Fallback (Task 4)

For low-confidence classifications (<0.60), Claude API makes final decision using:
- Fact content + type
- Extracted context (title, summary of source article)
- Relationship to other facts from same article
- Returns: selected domain + confidence 0.70-1.0

---

## Usage Examples

### Example 1: Kubernetes Configuration
**Fact Content:** "Set resource requests and limits to prevent pod eviction in Kubernetes clusters"
- Keywords: devops (kubernetes, limits), cloud-infra (scaling, cluster)
- Type: TECHNIQUE → matches devops/cloud-infra
- **Result:** devops (0.85 confidence)

### Example 2: AI Safety
**Fact Content:** "Adversarial examples pose risks to computer vision models used in autonomous systems"
- Keywords: ai-safety (adversarial, risk), computer-vision (vision, autonomous)
- Type: WARNING → matches ai-safety
- **Result:** ai-safety (0.92 confidence)

### Example 3: CSS Design
**Fact Content:** "Use flexbox for responsive layouts without media queries"
- Keywords: css-design (flexbox, layout, responsive)
- Type: TECHNIQUE → matches web-dev/frontend-frameworks/css-design
- **Result:** css-design (0.87 confidence)

### Example 4: Ambiguous/General
**Fact Content:** "The weather was sunny today"
- Keywords: none match
- Type: PATTERN → weak match
- **Result:** general (0.30 confidence) → Claude fallback recommended

---

## Integration Points

### M6.2 Task 3: Heuristic Classification
- `DomainClassifier.classifyFact(fact: KnowledgeFact)` → { domain, confidence }
- No API calls
- < 10ms per fact

### M6.2 Task 4: Claude Fallback
- Runs on facts with confidence < 0.60
- `CloudeFallbackClassifier.classifyFact(fact, article)` → { domain, confidence }
- Dedupes API calls (batch-processes low-confidence facts)

### M6.2 Task 5: Workflow Integration
- Extract facts → Classify domains (heuristic) → Store with domain field
- Daily workflow runs classification on all new facts
- Weekly job re-processes low-confidence facts with Claude

---

## Extensibility Rules

To add new domain or modify keywords:
1. Add domain to this document
2. Add keywords to taxonomy
3. Update `DomainClassifier` constants
4. Add test cases for new domain
5. Run full test suite (40+ tests)

No database migrations or data model changes needed — domain is flexible string field.

---

## Version History

| Date | Version | Changes |
|------|---------|---------|
| 2026-07-19 | 1.0 | Initial 26-domain taxonomy with keywords and classification algorithm |
