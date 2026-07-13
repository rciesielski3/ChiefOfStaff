# PAIOS Architecture Review & Prioritized Backlog

**Date**: 2026-07-13  
**Scope**: M1-M4 Complete, M5-M6 Design Review  
**Status**: P1.0 Production Readiness Assessment

---

## Executive Summary

PAIOS has successfully implemented four functional milestones (M1-M4) with a clean, modular architecture centered on a single "process once, consume everywhere" principle. The system is well-positioned for production deployment to OVH VPS.

**Key Strengths**:
- Clear separation of concerns (data processing → persistence → consumption)
- Effective use of n8n for workflow orchestration
- Robust deduplication and scoring strategy
- Multiple independent consumers (Telegram, Vault, QA News)

**Critical Gaps for Production**:
- Operational monitoring and alerting (no metrics/alerts for failed backups, workflow errors)
- Environment variable hardcoding in workflows (VPS migration blocker)
- Knowledge layer query interface missing (M4 partially incomplete)
- Restore procedure not operationalized or tested
- Deployment automation lacking

**Recommendation**: Proceed to Phase 2 (Operationalization) with focus on production readiness gaps.

---

## Part 1: Architecture Review

### A. M1: Telegram Integration (Complete ✓)

**Status**: Fully implemented, manually tested

**What Works**:
- Simple manual trigger workflow for connectivity verification
- Environment variable usage for secrets (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
- Clear setup instructions with fallback manual implementation
- Integration confirmed with test message capability

**Gaps**:
- No alerting if Telegram API becomes unavailable
- Token rotation not documented (should be handled externally via secrets manager)
- Error workflow exists but error recovery logic not explicitly stated

**Assessment**: M1 foundation is solid; ready for production with ops monitoring.

---

### B. M2: Daily Brief MVP (Mentioned, Not Directly Reviewed)

**Status**: Part of M3 workflow

**Assumption**: Operational via M3 daily briefing (08:00 UTC trigger documented)

---

### C. M3: Daily Brief with AI Processing (Complete ✓)

**Status**: Fully implemented, multi-source, Claude AI integration

**Sources Implemented**:
- GitHub Trending
- GitHub Releases
- Hacker News
- Dev.to
- AI Topics

**Processing Pipeline**:
```
Sources → Normalize → Score → Deduplicate → AI Context → Claude → 
Validate → Markdown → Consumers (Telegram + Vault)
```

**What Works**:
- Multi-source data collection with independent normalization per source
- Scoring algorithm (0-100) with documented weights
- Deduplication via `dedupKey` (source + normalized title)
- AI invoked once per briefing (efficient Claude API usage)
- Shared configuration workflow reduces duplication
- Consumers (Telegram, Vault) are read-only, decoupled from processing

**Gaps**:
- **Hardcoded paths**: Workflows reference explicit paths (e.g., vault directory) — not parameterized for VPS migration
- **No live API verification**: Health check logic may not handle API timeouts/failures gracefully
- **Scoring weights not externalized**: Heuristics embedded in workflow expressions (hard to tune without reimporting)
- **Vault output**: Stored in vault but no query interface for retrieval beyond reading files
- **Schedule timing**: 08:00 UTC hardcoded; no timezone configuration

**Assessment**: Core logic is sound; requires hardening for production operations.

---

### D. M4: Knowledge Layer (Partially Complete ⚠️)

**Status**: Phase 1 (persistence) complete; Phase 2 (QA News public interface) requires API wiring

**Phase 1: Persistence Infrastructure ✓**

**What Works**:
- `canonical_articles` data table created with 12 columns (id, title, summary, url, source, category, publishedAt, tags, addedAt, score, seenCount, dedupKey)
- Schema validated and tested
- Deduplication via `dedupKey` (unique constraint)
- Idempotent writes (upsert logic implemented in persist-articles.json)
- Field mapping documented (M3 → canonical_articles)
- Export pipeline to latest.json working (export-latest-news.json)

**Workflow Files**:
- `persist-articles.json`: Insert/update from M3 to canonical_articles
- `export-latest-news.json`: Query top articles (score >= 50), export to latest.json, git commit
- `test-persist-export-pipeline.json`: End-to-end integration test

**Gaps**:
- **No direct API**: canonical_articles exists only as n8n data table; no REST API for external queries
- **Export-only output**: latest.json is static export; no dynamic querying capability
- **Search/filter missing**: No implemented query interface for categories, date ranges, or full-text search
- **Git commits hardcoded**: Export workflow auto-commits but git credentials not documented
- **No archival strategy**: Canonical table growth unbounded; cleanup/archival not addressed

**Phase 2: QA News Public Interface ⚠️**

**Status**: Frontend deployed (Next.js, GitHub Pages ready), but disconnected from live data

**What Works**:
- qa-news Next.js app built and rendering static data
- GitHub Pages deployment configured
- Homepage, daily archive, categories implemented
- Tailwind CSS styling complete

**Gaps**:
- **Data fetching**: qa-news hardcoded to read latest.json; no API integration for live M3 output
- **Real-time updates**: QA News requires manual export trigger; no automatic data refresh post-M3
- **Search functionality**: Listed in planned features but not yet wired to knowledge layer
- **API layer missing**: No REST API for qa-news (or other future consumers) to query canonical_articles by filters (date, category, score)

**Assessment**: M4 Phase 1 is production-ready; Phase 2 requires API layer implementation before M4 is truly complete.

---

### E. M5-M6: Future Milestones (Design Review)

**M5: Weekly/Monthly Briefs** (Not yet implemented)

**Design Intent**:
- Aggregate weekly/monthly summaries from canonical_articles
- Extend M3 approach to longer time windows
- Separate consumers from daily processing

**Gaps in Design**:
- Weekly/monthly AI synthesis not specified (re-run Claude on week's articles?)
- Retention strategy for weekly/monthly outputs not documented
- Scheduling not planned (when does aggregation run?)

**M6: API & Search** (Not yet implemented)

**Design Intent**:
- REST API exposing canonical_articles with filtering (date, category, score)
- Full-text search over article content
- Serve qa-news and future consumers

**Gaps in Design**:
- API technology not chosen (Fastify? Django? n8n REST trigger?)
- Search backend not selected (PostgreSQL full-text? Elasticsearch?)
- Pagination not addressed
- Rate limiting/authentication not planned

**Assessment**: M5-M6 architecture sound in principle; detailed design needed before Phase 2 starts.

---

## Part 2: Assessment by Category

### Code Quality & Patterns

**Strengths**:
- n8n workflows follow consistent pattern: normalize → validate → transform → persist
- Shared configuration workflow reduces duplication
- Error workflow pattern implemented (central error handler)
- Field mapping documented (data-schema.md)

**Issues**:
- Hardcoded paths break across environments (macOS → VPS migration blocker)
- Workflow expressions use nested conditionals; complex logic hard to test
- No type validation in n8n (data table schema is only source of truth)
- Magic numbers in scoring (weights not parameterized)

**Grade**: B+ (solid for single-environment use; needs hardening for portability)

---

### Naming Consistency

**Strengths**:
- Data table columns named clearly (publishedAt, addedAt, dedupKey)
- Workflow names map 1:1 to functions (persist-articles, export-latest-news)
- Source names standardized (GitHub Trending, Hacker News, Dev.to)

**Issues**:
- "canonical_articles" vs "articles" vs "news" terminology inconsistent
- "score" used without context (relevance score? not defined in all places)
- "dedupKey" internal detail; public API shouldn't expose
- File paths use both snake_case (persist-articles.json) and PascalCase (PAIOS Daily Brief.json)

**Grade**: B (mostly clear; some terminology inconsistency)

---

### Documentation Gaps

**Exists**:
- M1-M4 handover docs (what, not how)
- PERSISTENCE-PIPELINE.md (detailed flow)
- IMPLEMENTATION-GUIDE.md (step-by-step)
- data-schema.md (schema reference)
- VERIFICATION-REPORT.md (test results)

**Missing**:
- **Deployment guide**: How to deploy locally or on VPS (no docker-compose.yml or .env.example at root)
- **Operations runbook**: Daily monitoring, troubleshooting, incident response procedures
- **Restore procedure**: How to recover from backup
- **Configuration reference**: All env vars not listed in one place
- **API specification** (for future M6)
- **Security hardening guide**: Secret management, network isolation, API key rotation

**Grade**: C+ (tactical documentation good; strategic docs missing)

---

### Single Points of Failure (SPOFs)

**Critical SPOFs**:

1. **n8n Instance**
   - All workflow execution depends on single n8n container
   - No clustering/redundancy
   - Data stored in PostgreSQL (backup required)
   - Mitigation: Regular backups via Restic (not yet operationalized)

2. **PostgreSQL Database**
   - Holds n8n project data AND canonical_articles knowledge layer
   - No replication
   - Loss = complete system reset required
   - Mitigation: Backup procedure needed in Phase 2

3. **Telegram API**
   - All consumer notifications go through Telegram
   - If Telegram API unavailable, no alerts generated
   - No fallback channel (email, SMS, Slack)
   - Mitigation: Add monitoring/alerting in Phase 2

4. **Vault Git Repository**
   - M3 daily brief saved to local git repo (via vault)
   - No remote tracking
   - Single point for archive access
   - Mitigation: Set up git remote + backup in Phase 2

**Grade**: C- (backup/HA planning needed for production)

---

### Security Risks

**Current State**:

**Medium Risks**:
- Environment variables stored in .env (standard practice, but requires secure VPS setup)
- n8n UI accessible on localhost:3333 (assumes network isolation via Tailscale or Docker bridge)
- No authentication on canonical_articles data table (n8n project-level access only)
- Workflow code visible to anyone with n8n access (includes API logic)

**Low Risks**:
- Telegram bot token in env var (standard)
- No PII stored (article metadata only)
- No user authentication required (personal system)

**Mitigations Needed**:
- Document Tailscale/network isolation requirements in deployment docs
- Plan OAuth/token auth for future public API (M6)
- Add rate limiting for M6 API endpoint
- Document secret rotation procedures

**Grade**: B (baseline OK for personal system; needs docs for VPS deployment)

---

### Operational Blind Spots

**Critical Gaps**:

1. **Monitoring**
   - No metrics on workflow execution (success rate, duration)
   - No alerting if M3 fails to run
   - No check if export-latest-news succeeded
   - No disk usage monitoring (canonical_articles growth)
   - No n8n health check

2. **Backup & Restore**
   - No documented restore procedure
   - Backup strategy not operationalized (Restic mentioned in plan, not implemented)
   - No test of restore (untested = broken)
   - No backup retention policy
   - No backup verification

3. **Incident Response**
   - No runbook for "M3 failed to run"
   - No procedure for "canonical_articles corrupted"
   - No rollback procedure for failed exports
   - No manual override for data table

4. **Logging & Debugging**
   - n8n logs stored in container (not persisted)
   - No centralized log aggregation
   - No structured logging (JSON) for metrics parsing
   - No correlationID for tracing M3 → persist → export flow

**Grade**: D (production ops not ready; must implement in Phase 2)

---

### Technical Debt

**High Priority**:

| Issue | Impact | Effort | Note |
|-------|--------|--------|------|
| Hardcoded paths in workflows | VPS migration blocker | Medium | Parameterize all paths |
| No API for canonical_articles | M4 incomplete | High | Build REST API |
| Scoring weights not parameterized | Hard to tune | Low | Extract to env vars |
| No backup/restore procedure | Data loss risk | Medium | Implement Restic, test restore |
| No operational monitoring | Can't detect failures | High | Add workflow metrics, alerting |

**Medium Priority**:

| Issue | Impact | Effort | Note |
|-------|--------|--------|------|
| Terraform/IaC not present | VPS manual provisioning | High | Defer to VPS migration |
| Search interface missing | M4 feature gap | High | Defer to M6 |
| Weekly/monthly synthesis design incomplete | M5 blocked | Medium | Finalize design |
| No error handling for Telegram outages | Silent failures | Low | Add fallback, alerting |
| Git credentials hardcoded | Security risk | Low | Use SSH keys or env vars |

**Low Priority**:

| Issue | Impact | Effort | Note |
|-------|--------|--------|------|
| Terminology inconsistency | Confusion | Low | Standardize in docs |
| Workflow complexity | Maintenance burden | Medium | Refactor long expressions into JS nodes |
| No type safety in n8n | Bug potential | Medium | Add validation nodes |

---

## Part 3: Prioritized Backlog

### Phase 1 Completion (Operationalization Blockers)

**All must be done before VPS migration:**

#### P1.1 — CRITICAL: Implement backup & restore procedure
- **Goal**: Guarantee data recovery from any corruption/failure
- **Tasks**:
  - [ ] Set up Restic backup (n8n + PostgreSQL + vault)
  - [ ] Create restore procedure doc (tested locally)
  - [ ] Configure backup schedule (daily, 7-day retention)
  - [ ] Test restore to separate instance
  - [ ] Document rollback procedure
- **Effort**: 3 days
- **Dependency**: None (can do in parallel with ops docs)
- **Owner**: Platform/DevOps

**Related Files to Create**:
- `docs/BACKUP_RESTORE.md` — Complete backup strategy, restore steps, verification
- `scripts/backup.sh` — Automated backup script
- `scripts/restore.sh` — Restore script with validation

---

#### P1.2 — CRITICAL: Parameterize all hardcoded paths & environment variables
- **Goal**: Enable VPS deployment without workflow reimport
- **Tasks**:
  - [ ] List all hardcoded values in workflows (paths, API endpoints, schedule times)
  - [ ] Define env var naming scheme (PAIOS_VAULT_PATH, PAIOS_EXPORT_PATH, etc.)
  - [ ] Create .env.example with all required vars
  - [ ] Update workflows to use `{{ $processEnv.PAIOS_VAULT_PATH }}` everywhere
  - [ ] Test workflows on different path setup
- **Effort**: 2 days
- **Dependency**: None
- **Owner**: Backend/n8n

**Related Files to Create**:
- `.env.example` — Template with all required environment variables
- `docs/CONFIGURATION.md` — Env var reference (what each one does, example values)

---

#### P1.3 — CRITICAL: Implement operational monitoring & alerting
- **Goal**: Detect and respond to workflow failures, data issues
- **Tasks**:
  - [ ] Add workflow execution metrics (duration, success/failure counts)
  - [ ] Implement n8n workflow error notifications (Telegram alert on failure)
  - [ ] Add backup success/failure check (verify latest backup < 24h old)
  - [ ] Monitor canonical_articles growth (alert if > threshold)
  - [ ] Create dashboard or regular summary report (daily ops briefing)
  - [ ] Document alert response procedures
- **Effort**: 3 days
- **Dependency**: P1.1 (backup system needed for monitoring)
- **Owner**: Platform/DevOps

**Related Files to Create**:
- `docs/OPERATIONS.md` — Monitoring dashboard, alert definitions, response procedures
- `docs/TROUBLESHOOTING.md` — Common issues and fixes

---

#### P1.4 — CRITICAL: Complete M4 API layer
- **Goal**: Allow external queries to canonical_articles; enable live QA News updates
- **Tasks**:
  - [ ] Design REST API spec (GET /articles, filters: date, category, score, limit)
  - [ ] Choose API technology (n8n REST trigger or separate Node/Fastify app)
  - [ ] Implement GET /articles endpoint with filtering
  - [ ] Implement GET /articles/search full-text search
  - [ ] Add pagination (limit, offset)
  - [ ] Connect qa-news to live API (remove latest.json dependency)
  - [ ] Document API (OpenAPI spec or README)
  - [ ] Add rate limiting / basic auth if public
- **Effort**: 4 days
- **Dependency**: P1.2 (env vars for API endpoint URLs)
- **Owner**: Backend/Frontend

**Related Files to Create**:
- `docs/API.md` — REST API specification
- `apps/api/` or workflow REST nodes (implementation)

---

#### P1.5 — HIGH: Create comprehensive deployment documentation
- **Goal**: Enable self-service deployment (local + VPS)
- **Tasks**:
  - [ ] Write docker-compose.yml (n8n + PostgreSQL) for local dev
  - [ ] Create VPS deployment guide (Ubuntu 22.04 setup, Docker install, DNS config)
  - [ ] Document Tailscale setup (VPS to local access)
  - [ ] Create DNS/SSL setup guide (Cloudflare + n8n SSL)
  - [ ] Add first-deployment checklist (env vars, secrets, workflow imports)
  - [ ] Document local dev workflow (import test data, run M3, verify outputs)
- **Effort**: 2 days
- **Dependency**: P1.2 (env vars must be finalized first)
- **Owner**: DevOps/Docs

**Related Files to Create**:
- `docker-compose.yml` — Full stack (n8n + PostgreSQL + volumes)
- `.env.example` — (referenced from P1.2)
- `docs/DEPLOYMENT.md` — Deployment steps (local + VPS)
- `docs/FIRST_DEPLOYMENT_CHECKLIST.md` — Post-deploy verification steps

---

### Phase 2: Feature Completion (After Phase 1)

#### P2.1 — MEDIUM: Operationalize M4 QA News live updates
- **Goal**: QA News reflects latest M3 output in real-time
- **Tasks** (depends on P1.4 API):
  - [ ] Update qa-news to fetch from API (not latest.json)
  - [ ] Add auto-refresh trigger (daily at 08:10 UTC, 15 min after M3)
  - [ ] Test live update pipeline end-to-end
  - [ ] Document deployment to GitHub Pages with API access
- **Effort**: 2 days
- **Dependency**: P1.4 (API must exist)
- **Owner**: Frontend

---

#### P2.2 — MEDIUM: Finalize M5 design (Weekly/Monthly briefs)
- **Goal**: Specification for M5 implementation (not implementation, just design)
- **Tasks**:
  - [ ] Define weekly brief synthesis (Claude re-run on top 20 weekly articles?)
  - [ ] Define monthly brief (aggregate of weeklies or new Claude run?)
  - [ ] Specify storage (in canonical_articles? separate table?)
  - [ ] Design scheduling (weekly run on Sunday? monthly on 1st?)
  - [ ] Design consumers (Telegram weekly, Vault archive, QA News timeline?)
- **Effort**: 1 day
- **Dependency**: None
- **Owner**: Product/Architecture

**Related Files to Create**:
- `docs/DESIGN_M5.md` — Weekly/Monthly brief architecture

---

#### P2.3 — MEDIUM: Design M6 full implementation (M6 implementation itself deferred)
- **Goal**: Specification for search, filtering, pagination
- **Tasks**:
  - [ ] Finalize API spec (query syntax, filtering operators)
  - [ ] Choose search backend (PostgreSQL FTS? Elasticsearch?)
  - [ ] Design pagination (cursor-based or offset-based?)
  - [ ] Design authentication (API keys? OAuth?)
  - [ ] Spec advanced features (faceted search, saved searches, export)
  - [ ] Document performance targets (p99 latency, throughput)
- **Effort**: 2 days
- **Dependency**: P1.4 (basic API exists)
- **Owner**: Product/Architecture

**Related Files to Create**:
- `docs/DESIGN_M6.md` — Search & filter API design

---

### Phase 3: Maintenance & Scaling

#### P3.1 — LOW: Refactor workflow complexity (long-term maintainability)
- **Goal**: Reduce cognitive load, enable easier testing
- **Tasks**:
  - [ ] Convert complex n8n expressions to JavaScript code nodes
  - [ ] Extract validation logic into reusable functions
  - [ ] Add type hints/comments to workflow transformations
- **Effort**: 3 days (optional, not blocking)
- **Dependency**: None
- **Owner**: Backend

---

#### P3.2 — LOW: Implement comprehensive logging
- **Goal**: Debug production issues, trace data flow
- **Tasks**:
  - [ ] Set up centralized logging (ELK stack or cloud logging)
  - [ ] Add structured logging to all workflows (JSON, correlationID)
  - [ ] Retain n8n logs persistently
  - [ ] Create debug dashboard (trace M3 → persist → export)
- **Effort**: 3 days
- **Dependency**: P1.3 (after ops baseline)
- **Owner**: Platform/DevOps

---

#### P3.3 — LOW: Performance tuning & optimization
- **Goal**: Prepare for scale (more sources, higher scoring throughput)
- **Tasks**:
  - [ ] Profile M3 workflow (which steps are slowest?)
  - [ ] Optimize data table queries (add indexes, tune pagination)
  - [ ] Cache M3 normalization logic (if repeated per source)
  - [ ] Measure end-to-end latency (sources → persist → export)
  - [ ] Set performance targets (M3 < 10 min, export < 2 min)
- **Effort**: 4 days
- **Dependency**: P1.3 (need monitoring to measure)
- **Owner**: Backend/Platform

---

## Part 4: Risk & Recommendations

### Deployment Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| VPS provisioning fails, hardcoded paths don't work | HIGH | HIGH | P1.2 (parameterize) |
| Backup not tested, restore fails | HIGH | CRITICAL | P1.1 (test restore) |
| M3 fails silently, no one notices | MEDIUM | HIGH | P1.3 (alerting) |
| PostgreSQL corrupts, data lost | MEDIUM | CRITICAL | P1.1 (backup) |
| QA News shows stale data | MEDIUM | MEDIUM | P2.1 (live API) |
| Telegram API outage, no fallback channel | LOW | MEDIUM | P1.3 (add fallback) |

### Go/No-Go Criteria for VPS Migration

**Must Complete Before Migration**:
- [ ] P1.1 — Backup & restore tested end-to-end
- [ ] P1.2 — All env vars parameterized, tested on VPS-like path setup
- [ ] P1.3 — Operational monitoring in place (can detect M3 failures)
- [ ] P1.4 — API layer working (M4 complete)
- [ ] P1.5 — Deployment docs written and validated

**Nice to Have Before Migration**:
- P2.1 — QA News live updates (can use export-based approach initially)
- P2.2/P2.3 — M5/M6 design finalized (not blocking)
- P3.x — Logging/performance (defer to post-launch optimization)

### Recommendations for Next Phase

1. **Immediately** (Next 1-2 days):
   - Execute P1.2 (parameterize paths) — VPS migration is blocked without this
   - Start P1.1 (backup setup) — critical for data safety
   - Plan P1.3 (monitoring) — enables confidence in Phase 2

2. **Week 2-3** (P1 Completion):
   - Complete P1.1, P1.3, P1.5 in parallel
   - Complete P1.4 (API) — enables M4 to be truly complete
   - Validate all docs against local environment

3. **Week 3-4** (VPS Readiness):
   - Test full deployment on VPS-like environment
   - Perform restore procedure test
   - Green-light migration decision

4. **Post-Migration**:
   - Operationalize M4 QA News updates (P2.1)
   - Begin M5 design & implementation
   - Revisit performance tuning (P3.3)

---

## Conclusion

PAIOS architecture is **fundamentally sound** and ready for production deployment. The core "process once, consume everywhere" pattern is well-executed across M1-M4.

**Critical Path to Production**:
1. **P1.1-P1.5** must be completed before VPS migration (2 weeks)
2. **M4 API layer** completes the knowledge layer (P1.4, 4 days)
3. **M5-M6** can proceed in parallel after Phase 1

**Confidence Level**: **80%** for migration by end of July 2026, assuming Phase 1 completion.

---

## Appendices

### A. File Inventory

**Core Workflows**:
- `PAIOS Daily Brief.json` — M3 main workflow (multi-source AI briefing)
- `persist-articles.json` — M4 Phase 1 (insert to canonical_articles)
- `export-latest-news.json` — M4 Phase 1 (export to latest.json)
- `wf-alive.json` — M1 (Telegram connectivity test)
- `RSS Aggregator.json` — M3 source (RSS feed parsing)
- `Tech Radar (API).json` — M3 source (GitHub Trending API)

**Configuration Workflows**:
- `Config Tech.json` — Shared configuration (scores, categories)
- `Save Markdown.json` — Shared consumer (vault persistence)
- `Error Trigger.json` — Shared error handler

**Documentation**:
- `M1-Telegram-Setup.md` — M1 setup guide
- `PAIOS_M3_Handover.md` — M3 architecture summary
- `PAIOS_M4_Knowledge_Layer.md` — M4 design
- `PAIOS_Vision_and_QA_News.md` — Product vision
- `workflows/data-schema.md` — canonical_articles schema reference
- `workflows/PERSISTENCE-PIPELINE.md` — M4 Phase 1 architecture
- `workflows/IMPLEMENTATION-GUIDE.md` — Step-by-step setup
- `workflows/VERIFICATION-REPORT.md` — Data table validation
- `qa-news/README.md` — QA News frontend

**Frontend**:
- `qa-news/` — Next.js static site (GitHub Pages ready)

---

### B. Metric Definitions

For P1.3 Operational Monitoring:

- **M3 Execution Duration**: Time from 08:00 UTC trigger to export completion (target < 10 min)
- **M3 Success Rate**: % of days M3 completes without error (target 99.5%)
- **Source Success Rate**: % of each source (GitHub, HN, Dev.to) returning data (target 98%)
- **Export Success Rate**: % of days latest.json is committed to git (target 99%)
- **Data Table Size**: Row count in canonical_articles (monitor growth, alert if > 100k)
- **Backup Age**: Hours since last successful backup (alert if > 25h)
- **Backup Size**: GB of backup (trend analysis, plan storage)

---

### C. Questions for Product/Leadership

1. **Public API**: Is M6 public API intended for end-users (qa-news readers) or internal consumers only?
2. **Data Retention**: How long to keep articles? (Current: unbounded → needs archival policy)
3. **M5/M6 Priority**: After Phase 1, what's the priority? M4 completion → M5 → M6, or M6 first?
4. **Scaling**: When do we expect sources to double (2x throughput)? Affects architecture choices.
5. **Compliance**: Any data residency requirements for VPS location? (Current plan: OVH, EU)

---

**Review Complete**  
**Author**: Architecture Review Agent  
**Next Step**: Present findings to P1.0 planning meeting, prioritize Phase 1 tasks
