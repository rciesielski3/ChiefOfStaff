# PAIOS P1.0 Production Readiness & OVH Deployment Design

> **For agentic workers:** Use superpowers:subagent-driven-development to execute this design. Each deliverable (D1-D5) runs in parallel with independent agents, then sequential phases build on the results.

**Goal:** Prepare PAIOS for production deployment by documenting local setup, creating reproducible restore procedures, and planning VPS migration.

**Architecture:** 
- Phase 1 (Parallel): Document current local setup, plan architecture, identify gaps
- Phase 2 (Sequential): Operationalize M4 locally, update docs, then migrate to VPS
- End state: Fully configured local system with tested restore procedure, ready to migrate to OVH VPS

**Tech Stack:** Docker Compose, n8n, Tailscale, Restic, Cloudflare DNS, OVH VPS (target)

## Global Constraints

- Keep local development environment intact (macOS Docker)
- VPS is production target (OVH)
- Cloudflare handles DNS (separate from OVH)
- No new product features in P1.0 (ops-only)
- Restore procedure must be executable by someone with no prior project knowledge
- All documentation version-controlled in git
- Docker Compose is the deployment unit

---

# Phase 1: Parallel Documentation & Planning (Days 1-2)

## Deliverable D1: Production Documentation

**Goal:** Create 9 comprehensive docs covering every aspect of the system.

**Scope:** Write from the perspective of the LOCAL SETUP (current state). VPS-specific details noted but primary focus is documenting what's working locally.

**Files to create:**
1. `docs/VISION.md` — Project vision, principles, success metrics
2. `docs/ARCHITECTURE.md` — System design (M1-M4 complete, M5-M6 planned), data flow, components
3. `docs/ROADMAP.md` — Milestones M1-M8, current status, dependencies
4. `docs/DEPLOYMENT.md` — How to deploy locally + overview of VPS target
5. `docs/OPERATIONS.md` — Running the system, monitoring, logs, troubleshooting
6. `docs/BACKUP_RESTORE.md` — Backup strategy, restore procedures (local + future VPS)
7. `docs/CONFIGURATION.md` — Environment variables, secrets, .env.example
8. `docs/TROUBLESHOOTING.md` — Common issues, debugging, recovery
9. `docs/SECURITY.md` — Credentials, secret management, Tailscale, API keys

**Key principle:** Each doc is 200-500 lines, practical and actionable. No abstract philosophy — focus on "how do I actually do this?"

---

## Deliverable D2: Deployment Plan

**Goal:** Document both local and target (VPS) architectures.

**Scope:** 
- Current LOCAL setup: n8n Docker on macOS, volumes, ports, Tailscale
- Target VPS setup: OVH, Docker Compose, n8n, persistent storage, Tailscale, backup
- Cloudflare DNS: configuration and SSL strategy
- Migration path: steps to move from local to VPS

**File:** `docs/DEPLOYMENT_PLAN.md`

**Key sections:**
1. Local architecture (current state)
2. VPS architecture (target)
3. Docker topology (volumes, networking, ports)
4. Environment variables and secrets strategy
5. Cloudflare DNS configuration
6. Tailscale usage (access from macOS to VPS)
7. Backup and restore integration
8. Rollback strategy
9. Monitoring and alerting
10. Migration checklist

---

## Deliverable D3: Restore Procedure

**Goal:** Step-by-step guide to rebuild PAIOS from scratch.

**Scope:** Two procedures:
1. LOCAL restore (macOS Docker) — for development/recovery
2. VPS restore (Ubuntu 22.04) — for production

**File:** `docs/RESTORE_PROCEDURE.md`

**Structure:**

### Local Restore (10-15 minutes)
- Install Docker Desktop
- Clone repositories
- Create .env file
- Run `docker-compose up -d`
- Import n8n workflows
- Verify Telegram, Vault, scheduled jobs

### VPS Restore (30-45 minutes)
- Provision OVH VPS (Ubuntu 22.04)
- SSH access, basic setup
- Install Docker and Docker Compose
- Clone repositories to /opt/paios
- Configure Tailscale
- Create .env with production secrets
- Start Docker Compose
- Import n8n workflows
- Restore backups (Restic)
- Verify Telegram, Vault, scheduled jobs
- Configure Cloudflare DNS pointing to VPS
- Test end-to-end

**Key principle:** No steps that assume prior knowledge. Clear, testable, with verification at each stage.

---

## Deliverable D4: Operational Checklist

**Goal:** Quick-reference checklists for common operations.

**File:** `docs/OPERATIONS_CHECKLIST.md`

**Checklists:**

1. **First Deployment** (local or VPS)
   - [ ] Docker running
   - [ ] .env configured
   - [ ] Volumes exist
   - [ ] n8n accessible
   - [ ] Workflows imported
   - [ ] Telegram test message sent
   - [ ] Scheduled jobs enabled

2. **Daily Operations**
   - [ ] Check n8n workflow logs (errors?)
   - [ ] Verify latest Telegram message received
   - [ ] Spot-check vault commits
   - [ ] Monitor disk usage (backups growing?)

3. **Weekly Maintenance**
   - [ ] Review workflow execution logs
   - [ ] Backup size check
   - [ ] Restore test (manual, on test data)
   - [ ] Cost review (OVH, Telegram API)

4. **Backup Verification**
   - [ ] Restic list snapshots
   - [ ] Verify latest backup timestamp
   - [ ] Check backup size (expected range?)

5. **Restore Verification**
   - [ ] Restore to test VPS from backup
   - [ ] Verify n8n workflows present
   - [ ] Verify vault files restored
   - [ ] Verify scheduled jobs run

6. **Update Procedure**
   - [ ] Backup current state
   - [ ] Pull latest code
   - [ ] Update workflows (if changed)
   - [ ] Restart containers
   - [ ] Verify workflows run

7. **Incident Response**
   - [ ] Check Docker logs: `docker-compose logs -f n8n`
   - [ ] Verify n8n UI is responsive
   - [ ] Check Telegram connectivity
   - [ ] Review recent git commits (vault)
   - [ ] Restore from backup if corruption detected

---

## Deliverable D5: Architecture Review

**Goal:** Analyze current system, identify gaps, technical debt, and risks.

**Scope:** Review all of M1-M4 (complete), note M5-M6 design, assess:
- Code quality and patterns
- Naming consistency
- Documentation gaps
- Single points of failure
- Security risks
- Operational blind spots
- Technical debt

**File:** `docs/ARCHITECTURE_REVIEW.md`

**Output:** Prioritized backlog (Critical → High → Medium → Low)

**Example findings:**
- M3 Daily Brief stores output in Vault, but no query interface (Medium priority)
- n8n workflows use hardcoded paths — needs env var review (High)
- No alerting if backup fails — add Telegram notification (High)
- QA News doesn't query live API yet — depends on M4 operationalization (Medium)

---

# Phase 2: Sequential Operationalization & Migration (Days 3+)

## M4 Operationalization (Local)

**Goal:** Make M4 Knowledge Layer + QA News fully functional locally.

**Steps:**
1. Import 3 workflows into local n8n (persist-articles, export-latest-news, test)
2. Modify M3 workflow to call persist-articles sub-workflow
3. Test with sample data
4. Verify latest.json generates and qa-news renders it
5. Enable daily cron (08:00 M3, 08:05 export)
6. Update D1-D5 docs to reflect integrated system

---

## VPS Migration Planning

**Goal:** Prepare for move to OVH, using restored local system as baseline.

**Steps:**
1. Provision OVH VPS (if not already done)
2. Follow VPS restore procedure (using local backup as test)
3. Configure Cloudflare DNS to point to VPS
4. Enable Tailscale on VPS
5. Set up automated backup (Restic to S3 or local storage)
6. Test end-to-end: M3 runs, M4 exports, QA News updates

---

# Success Criteria

- ✅ All 9 production docs complete and committed
- ✅ Deployment plan covers local + VPS + migration
- ✅ Restore procedure tested (local at minimum, VPS if VPS available)
- ✅ Operational checklists documented and actionable
- ✅ Architecture review complete with prioritized backlog
- ✅ M4 operationalized locally (workflows running, M3 → export → qa-news)
- ✅ System ready for VPS migration (backup/restore proven)

---

# Dependencies & Blockers

**Must have:**
- Local n8n running (for operationalization)
- Access to Cloudflare DNS (for domain config)
- Optional: OVH VPS access (for VPS restore test)

**Non-blockers:**
- VPS can be provisioned later (docs written for future)
- M5/M6 features deferred (ops-only in P1.0)

---

# Deliverable Ownership

All deliverables (D1-D5) can be created in parallel since they document the system independently. Once D1-D5 are complete, operationalization (M4 + VPS planning) can proceed sequentially.
