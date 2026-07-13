# PAIOS P1.0 Production Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) to implement Phase 1 tasks in parallel, then Phase 2 sequentially. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Document local PAIOS setup, create reproducible restore procedures, and plan VPS migration—making the system production-ready.

**Architecture:** 
- Phase 1 (Parallel): 5 independent agents write D1-D5 documentation simultaneously
- Phase 2 (Sequential): M4 operationalization locally, then VPS migration planning
- Outcome: Complete ops documentation + working local system + migration path ready

**Tech Stack:** Docker Compose, n8n, Tailscale, Restic, Cloudflare DNS, OVH VPS (target), Git

## Global Constraints

- Keep local development environment (macOS Docker) as primary
- VPS is production target (OVH compute only)
- Cloudflare manages DNS separately from OVH
- No new product features in P1.0 (operations only)
- All documentation version-controlled in git
- Restore procedures must be executable by non-experts
- Docker Compose is the deployment/migration unit

---

# Phase 1: Parallel Documentation (Days 1-2)

## Task P1-D1: Production Documentation (9 Docs)

**Files:**
- Create: `docs/VISION.md`
- Create: `docs/ARCHITECTURE.md`
- Create: `docs/ROADMAP.md`
- Create: `docs/DEPLOYMENT.md`
- Create: `docs/OPERATIONS.md`
- Create: `docs/BACKUP_RESTORE.md`
- Create: `docs/CONFIGURATION.md`
- Create: `docs/TROUBLESHOOTING.md`
- Create: `docs/SECURITY.md`

**Interfaces:**
- Consumes: Project context (M1-M4 complete, P1.0 in progress, M5-M6 planned)
- Produces: 9 markdown documents, each 200-500 lines, practical and actionable

**Steps:**

- [ ] **Step 1: Create `docs/VISION.md`**

```markdown
# PAIOS Vision

## Mission
Build a Personal AI Operating System that continuously collects, normalizes, scores, and synthesizes technology news into actionable knowledge—delivered daily to you, stored in your vault, and published publicly.

## Principles
- KISS: Minimize moving parts
- DRY: One source of truth (canonical articles in Knowledge Layer)
- YAGNI: Build only what we use now
- Local-first: Develop locally, deploy anywhere
- Zero-trust ops: Test backup and restore before trusting production

## Success Metrics
- M3: Daily Brief delivers before 08:00 UTC, every weekday
- M4: QA News live and updated daily
- M5+: Retention and expansion into Weekly/Monthly/Search
- P1.0: System reproducible via restore procedure

## Current Status
- M1 (Telegram): ✅ Complete
- M2 (Daily Brief MVP): ✅ Complete
- M3 (Reddit Radar): ✅ Complete
- M4 (Knowledge Layer + QA News): ✅ Complete, operationalizing
- M5-M6: Planned (Weekly, Monthly, VPS)
- P1.0 (Production Readiness): In progress
```

- [ ] **Step 2: Create `docs/ARCHITECTURE.md`**

```markdown
# PAIOS Architecture

## System Overview

Sources (GitHub, Reddit, Dev.to, etc.)
    │
    ▼
n8n (Processing Layer)
├─ M1: Telegram delivery
├─ M2-M3: Daily Brief (scoring, ranking)
├─ M4: Knowledge Layer (canonical articles storage)
    ├─ persist-articles: Store from M3 → canonical_articles Data Table
    └─ export-latest-news: Read Data Table → latest.json (08:05 UTC daily)
    │
    ▼
Consumers
├─ Telegram (decisions)
├─ Vault (archive)
└─ QA News (public site)

## Components

### n8n Workflows
- **M3 Daily Brief:** Fetch/score/synthesize → Telegram + Vault
- **persist-articles:** M3 output → canonical_articles (30-day dedup)
- **export-latest-news:** Latest 100 articles (score ≥50) → qa-news/public/latest.json
- **test workflows:** Validate pipeline with sample data

### Storage
- **canonical_articles (n8n Data Table):** 12 fields (id, title, summary, url, source, category, publishedAt, tags, addedAt, score, seenCount, dedupKey)
- **latest.json:** Daily export for QA News (generated 08:05 UTC)
- **Vault (Obsidian):** Archive of briefs, notes, decisions

### Consumers
- **Telegram:** Push notifications (decisions, alerts)
- **Vault:** Pull archive (git-backed)
- **QA News:** Static site (GitHub Pages, https://qa-news.rcieskelski.dev)

## Data Flow

1. **08:00 UTC:** M3 Daily Brief runs
   - Fetch from sources
   - Score and rank articles
   - Call persist-articles sub-workflow
2. **persist-articles:** Dedup check (30-day window), INSERT/UPDATE canonical_articles
3. **08:05 UTC:** export-latest-news runs
   - Query canonical_articles (score ≥ 50, limit 100)
   - Shape to latest.json format
   - Write to qa-news/public/latest.json
   - Auto-commit to GitHub
4. **GitHub Actions:** QA News rebuilds (next push or scheduled)
```

- [ ] **Step 3: Create `docs/ROADMAP.md`**

```markdown
# PAIOS Roadmap

## Completed

| Milestone | Status | Delivery |
|-----------|--------|----------|
| M1: Telegram | ✅ Complete | Bot setup, message delivery |
| M2: Daily Brief MVP | ✅ Complete | GCal + GitHub + Claude |
| M3: Reddit Radar | ✅ Complete | Feed monitoring, scoring, routing |
| M4: Knowledge Layer + QA News | ✅ Complete | canonical_articles, export pipeline, public site |

## In Progress

| Milestone | Work | Timeline |
|-----------|------|----------|
| P1.0: Production Readiness | Ops docs, restore procedures, VPS planning | This week |
| M4 Operationalization | Import workflows to n8n, wire M3, test locally | Parallel with P1.0 |

## Upcoming

| Milestone | Goal | Dependencies |
|-----------|------|---|
| M5: Weekly Review | Weekly synthesis of articles + project status | M4 live |
| M6: Monthly Recap | Monthly trends + achievement review | M5 |
| M7: Project Intelligence | Detect stale projects, inactive branches | M6 |
| M8: VPS Migration | Deploy to OVH, production backup/restore | P1.0 complete |

## Success Criteria

- **M3:** Daily Brief before 08:00 UTC, every weekday
- **M4:** QA News updated daily, latest.json current
- **M5+:** Articles persisted, weekly synthesis delivered
- **P1.0:** System reproducible via restore procedure
- **M8:** Production on VPS with automated backup/restore tested
```

- [ ] **Step 4: Create `docs/DEPLOYMENT.md`**

```markdown
# Deployment Guide

## Local Deployment (macOS Docker)

### Prerequisites
- Docker Desktop running
- Git repos cloned: paios, paios-vault
- .env file with credentials

### Steps

1. **Start Docker Compose**
   ```bash
   docker-compose up -d
   ```
   Containers: n8n, (postgres if configured)

2. **Import Workflows**
   - Access n8n UI at http://localhost:5678
   - Import JSONs: persist-articles, export-latest-news, test workflows
   - Import M3 workflow from git

3. **Configure Environment**
   - Set EXPORT_FILE_PATH: /path/to/qa-news/public/latest.json
   - Set TELEGRAM_BOT_TOKEN, Vault mount path
   - Verify .env file in n8n container

4. **Enable Scheduling**
   - M3: Cron at 08:00 UTC
   - export-latest-news: Cron at 08:05 UTC
   - test-persist: Manual trigger (for testing)

5. **Verify**
   - Check n8n logs: `docker-compose logs -f n8n`
   - Test workflow manually
   - Verify latest.json generates

### Troubleshooting
- Workflow fails: Check n8n logs, verify API keys
- latest.json not updating: Verify EXPORT_FILE_PATH, check git credentials
- Telegram not sending: Check bot token, verify network access

---

## VPS Deployment (OVH Target)

### Prerequisites
- OVH VPS provisioned (Ubuntu 22.04)
- Cloudflare DNS configured (CNAME for domains)
- SSH access to VPS

### Overview
Same as local, but:
- Ubuntu server instead of macOS Docker
- Persistent volumes for backups
- Tailscale for secure access
- Restic for automated backups

*See RESTORE_PROCEDURE.md for step-by-step VPS setup.*

---

## Migration Path (Local → VPS)

1. Operationalize locally (M4 + workflows tested)
2. Backup local state (Restic)
3. Provision VPS
4. Restore to VPS (follow restore procedure)
5. Update Cloudflare DNS to point to VPS
6. Enable production scheduling on VPS
7. Keep local as dev environment
```

- [ ] **Step 5: Create `docs/OPERATIONS.md`**

```markdown
# Operations Guide

## Daily Operations

### Morning Checklist (09:00 UTC)
- [ ] Check n8n: Any workflow errors overnight?
  ```bash
  docker-compose logs --since 1h n8n | grep -i error
  ```
- [ ] Verify Telegram: Did daily brief arrive by 08:00?
- [ ] Spot-check vault: Latest brief file exists?
  ```bash
  ls -la paios-vault/daily/ | tail -5
  ```

### Weekly Operations

- [ ] Review workflow execution logs
- [ ] Check disk usage (backups growing?)
  ```bash
  du -sh ~/paios-vault ~/paios
  ```
- [ ] Manual restore test (optional, on test data)
- [ ] Review any workflow errors, update if needed

### Monthly Operations

- [ ] Full system health check (see TROUBLESHOOTING.md)
- [ ] Review costs (OVH, API services)
- [ ] Backup audit (Restic snapshots, size, retention)

---

## Monitoring

### Logs to Watch

**n8n:**
```bash
docker-compose logs -f n8n
```
Look for: Workflow failures, API errors, timeout warnings

**Vault:**
```bash
cd paios-vault && git log --oneline | head -20
```
Look for: Daily commits, no gaps > 24h

**System:**
```bash
docker-compose ps
```
Look for: All containers running, no restarts

### Health Checks

- **n8n API:** `curl http://localhost:5678/api/v1/audit/logs` (verify response)
- **Workflows:** Manual trigger of persist-articles → check data insertion
- **Export:** Verify latest.json timestamp matches current date

---

## Incident Response

### Workflow Failed
1. Check logs: `docker-compose logs n8n`
2. Identify error (API key expired? Missing field?)
3. Fix and re-run
4. Verify success before leaving

### Backup Not Running
1. Check Restic status: `restic snapshots`
2. Verify credentials (.env)
3. Run manual backup: `restic backup ~/paios-vault`
4. Schedule check: cron or n8n trigger status

### Telegram Not Sending
1. Verify token in .env (not expired)
2. Test: `curl -X POST https://api.telegram.org/botXXX/sendMessage -d "chat_id=XXX&text=test"`
3. Check network access (firewall, proxy)
4. Verify Telegram API limits (not rate-limited)

### Vault Git Sync Issues
1. Check git status: `cd paios-vault && git status`
2. Fix conflicts: `git pull --rebase` (or manual merge)
3. Commit and push: `git add . && git commit -m "fix: sync" && git push`
4. Verify: `git log --oneline | head -5`
```

- [ ] **Step 6: Create `docs/BACKUP_RESTORE.md`**

```markdown
# Backup and Restore Strategy

## Backup Strategy

### What Gets Backed Up
1. n8n Data Table (canonical_articles)
2. Vault (paios-vault git repo)
3. n8n workflow definitions
4. Configuration (.env)

### Backup Tool: Restic
- Automated snapshots (daily or on-demand)
- Incremental backups (efficient storage)
- Compression and encryption
- Multiple retention policies

### Backup Frequency
- Daily automated backup (00:00 UTC)
- Retention: 30 days
- Test restore: Weekly (manual)

---

## Restore Procedures

*See RESTORE_PROCEDURE.md for detailed step-by-step.*

### Local Restore (5-10 min)
```bash
docker-compose down
docker-compose up -d
# Import workflows (manual or automated)
# Verify n8n workflows present
```

### From Backup (Restic)
```bash
restic restore <snapshot-id> --target /restore-point
# Verify files, copy to correct locations
# Restart containers
```

### VPS Restore
See RESTORE_PROCEDURE.md for full process (30-45 min)

---

## Restore Testing

### Monthly Restore Test
1. Provision a temporary test VPS (same OS as production)
2. Follow restore procedure
3. Verify workflows run, latest.json generates
4. Decommission test VPS
5. Document result: PASS/FAIL + timestamp
```

- [ ] **Step 7: Create `docs/CONFIGURATION.md`**

```markdown
# Configuration Guide

## Environment Variables

### n8n Configuration
```
N8N_ENCRYPTION_KEY=<random-32-chars>
N8N_USER_MANAGEMENT_JWT_SECRET=<random-32-chars>
DATABASE_URL=<postgres-url-or-empty>
```

### PAIOS Configuration
```
PAIOS_VAULT_PATH=/path/to/paios-vault
EXPORT_FILE_PATH=/path/to/qa-news/public/latest.json
TELEGRAM_BOT_TOKEN=<bot-token-from-telegram>
TELEGRAM_CHAT_ID=<your-chat-id>
```

### Backup Configuration
```
RESTIC_PASSWORD=<backup-password>
RESTIC_REPOSITORY=s3://bucket-name/paios
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
```

### Tailscale (VPS only)
```
TAILSCALE_AUTH_KEY=<auth-key-from-tailscale>
```

## .env.example Template

```bash
# .env.example — Copy to .env and fill in your values
N8N_ENCRYPTION_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
N8N_USER_MANAGEMENT_JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL=postgresql://user:pass@localhost/paios
PAIOS_VAULT_PATH=/opt/paios-vault
EXPORT_FILE_PATH=/opt/paios/qa-news/public/latest.json
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
RESTIC_PASSWORD=
RESTIC_REPOSITORY=
```

## Secrets Management

- Never commit .env (add to .gitignore)
- Store secrets in secure location (1Password, Vault)
- Rotate tokens quarterly
- Use environment-specific .env files (local, staging, prod)
```

- [ ] **Step 8: Create `docs/TROUBLESHOOTING.md`**

```markdown
# Troubleshooting Guide

## Common Issues

### n8n Won't Start
**Symptom:** `docker-compose up` fails or n8n container crashes

**Diagnosis:**
```bash
docker-compose logs n8n | head -50
```

**Solutions:**
- Verify Docker is running
- Check .env file is correct (N8N_ENCRYPTION_KEY set)
- Verify port 5678 not in use: `lsof -i :5678`
- Remove stale volumes: `docker volume prune`

### Workflow Fails to Execute
**Symptom:** Workflow starts but exits with error

**Diagnosis:**
```bash
docker-compose logs n8n | grep -A 10 "workflow execution"
```

**Solutions:**
- Check API keys in workflow (expired? wrong value?)
- Verify network access to external APIs
- Test credentials manually (e.g., curl to API)
- Check workflow inputs/outputs match expected schema

### Latest.json Not Updating
**Symptom:** QA News shows stale data

**Diagnosis:**
1. Check if export-latest-news ran: `docker-compose logs n8n | grep export-latest-news`
2. Verify EXPORT_FILE_PATH correct: `ls -la $(cat .env | grep EXPORT_FILE_PATH)`
3. Check git push: `cd qa-news && git log --oneline | head -5`

**Solutions:**
- Verify export workflow enabled
- Check EXPORT_FILE_PATH in .env
- Verify git credentials (ssh key, token)
- Test export manually: trigger workflow in n8n UI

### Telegram Not Receiving Messages
**Symptom:** No notifications from n8n

**Diagnosis:**
1. Verify token: `curl https://api.telegram.org/botXXX/getMe` (should return bot info)
2. Test manually: `curl -X POST https://api.telegram.org/botXXX/sendMessage -d "chat_id=YYY&text=test"`
3. Check workflow: `docker-compose logs n8n | grep telegram`

**Solutions:**
- Verify TELEGRAM_BOT_TOKEN in .env (not expired)
- Verify TELEGRAM_CHAT_ID correct (get from bot: /start, note group/channel ID)
- Check Telegram rate limits (max ~30 msg/sec per bot)
- Verify network allows outbound HTTPS

### Vault Git Sync Failing
**Symptom:** Vault commits not pushing, git errors in logs

**Diagnosis:**
```bash
cd paios-vault && git status
git log --oneline -5
git remote -v
```

**Solutions:**
- Verify git credentials (ssh key, PAT)
- Check git remote URL correct
- Manual sync: `git pull --rebase && git push`
- Verify network access to GitHub

---

## Performance Issues

### High Memory Usage
```bash
docker stats
```
If n8n > 1GB: Check for large data transfers, long-running workflows

**Solutions:**
- Restart n8n: `docker-compose restart n8n`
- Optimize workflow (reduce data processing)
- Increase Docker memory limit

### Slow Workflow Execution
Check external API latency: time individual API calls in workflow

**Solutions:**
- Add retry logic with backoff
- Parallelize independent steps
- Cache results when possible
```

- [ ] **Step 9: Create `docs/SECURITY.md`**

```markdown
# Security Guide

## Credentials & Secrets

### Storage
- Never commit secrets to git
- Use .env (git-ignored) for local development
- Use Kubernetes secrets / OVH secrets manager for production

### Rotation
- Telegram bot token: Rotate yearly or if compromised
- Database password: Rotate quarterly
- Restic backup password: Store securely, rotate annually
- Tailscale auth key: Revoke unused keys regularly

### Access Control
- Telegram: Private chat only, no public channels
- Vault: Private GitHub repo, no read access from workflows
- n8n: Local access only (no public exposure)
- OVH: SSH keys only, no passwords

---

## API Security

### Rate Limiting
- Telegram: 30 msg/sec per bot (built-in limit)
- GitHub: Check rate limits with `gh api user`
- Reddit: Respect user-agent requirements, backoff on 429s

### Credentials in Workflows
- Never hardcode tokens in workflow definitions
- Use n8n environment variables or secrets
- Audit: Check n8n workflows for exposed credentials

---

## Network Security

### Local Development
- n8n accessible only on localhost (not exposed)
- Vault on local machine (not accessible remotely)

### VPS Production
- Tailscale for remote access (encrypted, authenticated)
- No direct SSH exposure (firewall + Tailscale only)
- Cloudflare for public domains (DDoS protection)

---

## Backup Security

### Encryption
- Restic backups encrypted with RESTIC_PASSWORD
- S3 backups use encryption at rest (AWS)
- Transport: HTTPS only

### Restore Safety
- Test restores in isolated environment (not production)
- Verify checksum after restore
- Audit: Who has access to backups?

---

## Monitoring

### Security Events to Watch
- Failed login attempts (n8n logs)
- Unusual API usage (rate limit hits)
- Failed git commits (vault access issues)
- Workflow execution failures (error patterns)

### Audit Trail
- n8n logs: `docker-compose logs n8n`
- Vault history: `cd paios-vault && git log`
- GitHub Actions: Deployment history
```

- [ ] **Step 10: Commit all 9 docs**

```bash
git add docs/VISION.md docs/ARCHITECTURE.md docs/ROADMAP.md \
        docs/DEPLOYMENT.md docs/OPERATIONS.md docs/BACKUP_RESTORE.md \
        docs/CONFIGURATION.md docs/TROUBLESHOOTING.md docs/SECURITY.md
git commit -m "docs(P1.0-D1): Add 9 production documentation files"
```

---

## Task P1-D2: Deployment Plan

[Content continues as per earlier plan section...]

[Content for D2, D3, D4, D5, and Phase 2 tasks would follow in full plan file]
