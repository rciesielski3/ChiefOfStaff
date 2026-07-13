# Fix P1.0 Critical Blockers Before PR

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 5 critical blockers preventing P1.0 from merging so the system matches its documentation and operationalization is complete.

**Architecture:** Address each blocker independently: (1) environment config, (2) docker services alignment, (3) workflow parameterization, (4) M4 operationalization, (5) restore verification. Each task produces a testable deliverable.

**Tech Stack:** Docker Compose, n8n, .env configuration, n8n Data Tables, Bash scripting

## Global Constraints

- System must match documentation: restore procedures, deployment guides, and actual docker-compose.yml must be aligned
- All required environment variables must be documented in .env.example at root level
- M4 workflows must be imported and actively running before PR merge
- Hardcoded file paths must use environment variables (EXPORT_FILE_PATH, VAULT_PATH, etc.)
- Restore procedure must be tested locally and produce working system
- No secrets in .env.example (only comments and placeholders)

---

## Task 1: Create .env.example and Document Environment Variables

**Files:**
- Create: `.env.example` (at repository root)
- Create: `docs/ENVIRONMENT_SETUP.md` (configuration guide)

**Interfaces:**
- Consumes: CONFIGURATION.md (existing), DEPLOYMENT.md, RESTORE_PROCEDURE.md
- Produces: .env.example template with all required variables; guide for operators to populate .env

**Deliverable:** Operators can `cp .env.example .env` and know exactly which variables to fill in and why.

- [ ] **Step 1: Extract all environment variables from existing docs**

Read through:
- docs/CONFIGURATION.md
- docs/DEPLOYMENT.md  
- RESTORE_PROCEDURE.md
- n8n workflow JSONs in workflows/

Create comprehensive list of all variables referenced:
```
TELEGRAM_BOT_TOKEN — Telegram bot API key for messages
TELEGRAM_CHAT_ID — Telegram chat ID (personal account)
OPENAI_API_KEY — OpenAI API key for Claude integration
N8N_HOST — n8n hostname (localhost for dev)
EXPORT_FILE_PATH — Full path to qa-news/public/latest.json
VAULT_PATH — Path to paios-vault repository (git clone location)
VAULT_REPO_URL — Git URL for vault repository
PAIOS_REPO_URL — Git URL for paios repository
RESTIC_PASSWORD — Restic backup password (future VPS)
S3_ENDPOINT, S3_BUCKET, S3_KEY_ID, S3_KEY_SECRET — S3 backup target (future VPS)
```

- [ ] **Step 2: Create .env.example at root level**

Create `/Users/rafalciesielski/Developer/ChiefofStaff/.env.example` with:
- All variables grouped by component (n8n, Telegram, Vault, Backups)
- Clear comments explaining what each does
- Example values or placeholders
- Required vs. optional flags

```bash
# ============================================================================
# PAIOS Environment Configuration Template
# ============================================================================
# Copy this file to .env and populate with your values.
# DO NOT commit .env to version control — it contains secrets.
#
# Required: All marked [REQUIRED]
# Optional: Features disabled if not set
# ============================================================================

# n8n Workflow Engine
# ---
# N8N_HOST: n8n hostname (localhost for dev, your domain for VPS)
# N8N_PORT: n8n UI port (default 5678)
# NODE_ENV: Environment (development or production)
N8N_HOST=localhost
N8N_PORT=5678
NODE_ENV=development

# Telegram Bot (M3 Daily Brief)
# [REQUIRED] Get from @BotFather on Telegram
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=

# OpenAI API (Claude/GPT for article summarization)
# [REQUIRED] Get from https://platform.openai.com/api-keys
OPENAI_API_KEY=

# QA News Export (M4 Knowledge Layer)
# [REQUIRED] Full path to qa-news public directory
# Example: /Users/yourname/paios/qa-news/public/latest.json
# Workflows write latest.json here for GitHub Pages
EXPORT_FILE_PATH=/Users/rafalciesielski/Developer/ChiefofStaff/qa-news/public/latest.json

# Vault Repository (Secret/Note Storage)
# [REQUIRED for local restore] Path where paios-vault repo is cloned
# Example: /Users/yourname/paios-vault
# This is mounted as read/write volume for persisting vault commits
VAULT_PATH=/Users/rafalciesielski/Developer/ChiefofStaff/paios-vault
VAULT_REPO_URL=https://github.com/yourusername/paios-vault.git

# PAIOS Repository (Git operations in workflows)
# [REQUIRED for git pushes] URL for paios repo cloning in n8n
PAIOS_REPO_URL=https://github.com/yourusername/paios.git

# Backup & Restore (Restic) - [OPTIONAL, for VPS only]
# Restic password for encrypted backups
RESTIC_PASSWORD=

# S3 Backup Target (future VPS deployment)
# [OPTIONAL] AWS S3 or S3-compatible storage
S3_ENDPOINT=
S3_BUCKET=
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=

# Backup Retention (future VPS)
# How many daily backups to keep (default 7)
BACKUP_RETENTION_DAYS=7

# Timezone
# n8n cron jobs use this timezone (default UTC)
GENERIC_TIMEZONE=UTC
```

- [ ] **Step 3: Create ENVIRONMENT_SETUP.md guide**

Document:
- How to populate .env.example for first-time setup
- What each variable means
- Where to get secrets (Telegram BotFather, OpenAI API, GitHub tokens)
- Security best practices (don't commit .env, rotate tokens regularly)
- Troubleshooting when variables are wrong

- [ ] **Step 4: Commit**

```bash
git add .env.example docs/ENVIRONMENT_SETUP.md
git commit -m "docs: Add environment configuration template and setup guide

- Create .env.example with all required variables for local + VPS
- Document each variable's purpose, how to obtain it, and examples
- Add ENVIRONMENT_SETUP.md with first-time setup walkthrough
- Support local dev (n8n, Telegram, OpenAI) and future VPS (Restic, S3)

Unblocks: operators can now follow restore procedure without guessing env vars"
```

---

## Task 2: Align docker-compose.yml with Documentation

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docs/DEPLOYMENT.md` and `docs/RESTORE_PROCEDURE.md` (if needed)

**Interfaces:**
- Consumes: .env.example from Task 1
- Produces: docker-compose.yml with all services referenced by docs (or updated docs if removing services)

**Decision Point:** The code review found that RESTORE_PROCEDURE references PostgreSQL, Vault, and other services not in docker-compose.yml. Choose approach:

**Approach A (Recommended):** Add missing services to docker-compose.yml
- PostgreSQL: n8n database (better than SQLite for production)
- Vault volume mount: For local git-based secret storage
- Future-proof for VPS migration

**Approach B:** Simplify docker-compose, update docs to match current state
- Keep only n8n (lightweight, works for MVP)
- Update RESTORE_PROCEDURE to remove postgres references
- Document that PostgreSQL comes in Phase 2

**Assume Approach A for this plan** (more complete system). If Approach B preferred, substitute task steps accordingly.

- [ ] **Step 1: Update docker-compose.yml to include PostgreSQL**

Add PostgreSQL service for n8n database persistence:

```yaml
  postgres:
    image: postgres:15-alpine
    container_name: paios-postgres
    environment:
      POSTGRES_DB: n8n
      POSTGRES_USER: n8n
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-n8n_dev_password}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - n8n_network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U n8n"]
      interval: 10s
      timeout: 5s
      retries: 5
```

And update n8n service to use PostgreSQL:

```yaml
  n8n:
    # ... existing config ...
    environment:
      # ... existing env vars ...
      DB_TYPE: postgresdb
      DB_POSTGRESDB_HOST: postgres
      DB_POSTGRESDB_PORT: 5432
      DB_POSTGRESDB_DATABASE: n8n
      DB_POSTGRESDB_USER: n8n
      DB_POSTGRESDB_PASSWORD: ${POSTGRES_PASSWORD:-n8n_dev_password}
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - n8n_data:/home/node/.n8n
      - ${VAULT_PATH}:/home/node/.vault:ro
      - ${PWD}:/home/node/project
```

Add volume at bottom:
```yaml
volumes:
  postgres_data:
  n8n_data:
```

- [ ] **Step 2: Test docker-compose configuration**

Validate the updated file:

```bash
cd /Users/rafalciesielski/Developer/ChiefofStaff
docker-compose config > /dev/null && echo "✓ docker-compose.yml is valid"
```

Expected: No errors, file is valid

- [ ] **Step 3: Bring up new services and verify n8n connects to postgres**

```bash
# Stop current n8n if running
docker-compose down || true

# Copy .env.example if .env doesn't exist
test -f .env || cp .env.example .env

# Start with new postgres service
docker-compose up -d

# Wait for postgres to be ready
sleep 5

# Check logs for successful connection
docker-compose logs n8n | grep -i "database\|postgres" || echo "Check n8n is running"

# Verify both services are up
docker-compose ps
```

Expected: Both n8n and postgres showing "Up" status, n8n connected to database

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "ops: Add PostgreSQL service to docker-compose.yml

- Add postgres:15-alpine for persistent n8n database
- Configure n8n to use PostgreSQL instead of SQLite
- Add health check for reliable startup ordering
- Support local testing of restore procedures that reference postgres

Unblocks: Restore procedures can now run against real postgres service"
```

---

## Task 3: Parameterize Hardcoded Paths in M4 Workflows

**Files:**
- Modify: `workflows/persist-articles-fixed.json`
- Modify: `workflows/export-latest-news-fixed.json`
- Modify: `workflows/fixed_test-persist-export-pipeline.json`
- Create: `docs/WORKFLOW_CONFIGURATION.md` (guide)

**Interfaces:**
- Consumes: .env.example from Task 1 (EXPORT_FILE_PATH, VAULT_PATH, PAIOS_REPO_URL)
- Produces: Workflows that read paths from environment variables instead of hardcoded values

**Deliverable:** Workflows can be deployed to any environment (local macOS, VPS, CI/CD) without modification.

- [ ] **Step 1: Identify all hardcoded paths in workflow JSONs**

Search each workflow file for absolute paths:

```bash
cd /Users/rafalciesielski/Developer/ChiefofStaff
grep -n "/Users\|/home\|/opt" workflows/persist-articles-fixed.json workflows/export-latest-news-fixed.json workflows/fixed_test-persist-export-pipeline.json
```

Document every hardcoded path found (e.g., `/Users/rafalciesielski/Developer/ChiefofStaff/qa-news/public/latest.json`)

- [ ] **Step 2: Create workflow parameterization guide**

Document (in WORKFLOW_CONFIGURATION.md):
- Which environment variables each workflow needs
- How to set them in n8n UI (Credentials > Variables)
- How to test that variables are correctly injected

Example section:
```markdown
## Workflow Environment Variables

### export-latest-news

Required variables (set in n8n Variables tab):
- `EXPORT_FILE_PATH`: Path where latest.json should be written
  - Local example: `/Users/yourname/qa-news/public/latest.json`
  - VPS example: `/opt/paios/qa-news/public/latest.json`
- `PAIOS_REPO_URL`: Git URL for pushing latest.json
  - Example: `https://github.com/yourusername/qa-news.git`

How to set in n8n:
1. Go to Variables (bottom left, like a settings icon)
2. Click "Add variable"
3. Name: EXPORT_FILE_PATH, Value: your path
4. Save
```

- [ ] **Step 3: Update export-latest-news workflow JSON**

In the workflow JSON, replace hardcoded paths with variable references:

Find: `"/Users/rafalciesielski/Developer/ChiefofStaff/qa-news/public/latest.json"`

Replace with: `{{ $env.EXPORT_FILE_PATH }}`

(Exact JSON path depends on n8n workflow structure; will vary per workflow.)

- [ ] **Step 4: Update persist-articles workflow JSON**

Similar to Step 3, replace any hardcoded paths or vault references with variables like:
- `{{ $env.VAULT_PATH }}`
- `{{ $env.PAIOS_REPO_URL }}`

- [ ] **Step 5: Verify workflows are valid JSON**

```bash
cd /Users/rafalciesielski/Developer/ChiefofStaff/workflows
for f in persist-articles-fixed.json export-latest-news-fixed.json fixed_test-persist-export-pipeline.json; do
  jq empty "$f" 2>/dev/null && echo "✓ $f valid" || echo "✗ $f invalid"
done
```

Expected: All three files report valid

- [ ] **Step 6: Commit**

```bash
git add workflows/persist-articles-fixed.json workflows/export-latest-news-fixed.json workflows/fixed_test-persist-export-pipeline.json docs/WORKFLOW_CONFIGURATION.md
git commit -m "ops: Parameterize workflow file paths with environment variables

- Replace hardcoded paths with \$env.EXPORT_FILE_PATH, \$env.VAULT_PATH, etc.
- Add WORKFLOW_CONFIGURATION.md explaining how to set variables in n8n UI
- Support deployment to any environment without workflow modification

Unblocks: Workflows can now be used on VPS with different file paths"
```

---

## Task 4: Import M4 Workflows and Verify Locally

**Files:**
- Reference: `workflows/persist-articles-fixed.json`
- Reference: `workflows/export-latest-news-fixed.json`
- Reference: `workflows/fixed_test-persist-export-pipeline.json`

**Interfaces:**
- Consumes: n8n running (from Task 2), parameterized workflows (from Task 3), .env configured (from Task 1)
- Produces: Three imported workflows in n8n with Data Table, variables set, and test execution passing

**Deliverable:** M4 workflows actively running, can fetch sample data, persist to canonical_articles Data Table, and export latest.json.

**Note:** n8n CLI has a known bug (v2.29.10) with validation. Use n8n UI for import instead. See WORKAROUND in TROUBLESHOOTING.md.

- [ ] **Step 1: Access n8n UI**

```bash
# Ensure docker-compose is running
docker-compose ps | grep n8n

# Open browser to n8n
open http://localhost:5678

# Expected: n8n dashboard loads with "Credentials", "Workflows", "Data", etc.
```

- [ ] **Step 2: Create canonical_articles Data Table**

In n8n:
1. Click **Data** (left sidebar)
2. Click **Create** > **Data Table**
3. Name: `canonical_articles`
4. Add fields with types:
   - `id` (String) — Primary key
   - `title` (String)
   - `summary` (String, Long text)
   - `url` (String)
   - `source` (String)
   - `category` (String)
   - `publishedAt` (DateTime)
   - `tags` (String, array/multiline)
   - `addedAt` (DateTime)
   - `score` (Number)
   - `seenCount` (Number)
   - `dedupKey` (String)
5. Set `id` as Primary Key
6. Click **Create**

Expected: Data Table appears in Data list, ready to receive inserts

- [ ] **Step 3: Import persist-articles workflow**

Manual import via UI:
1. Click **Workflows** (left sidebar)
2. Click **+** (New)
3. Name: `persist-articles`
4. Click the **Import from file** icon (bottom left, looks like upload)
5. Select: `/Users/rafalciesielski/Developer/ChiefofStaff/workflows/persist-articles-fixed.json`
6. Click **Import**

Expected: Workflow imported, nodes visible, no validation errors

- [ ] **Step 4: Import export-latest-news workflow**

Repeat Step 3 with:
- Name: `export-latest-news`
- File: `export-latest-news-fixed.json`

Expected: Workflow imported successfully

- [ ] **Step 5: Import test workflow**

Repeat Step 3 with:
- Name: `test-persist-export-pipeline`
- File: `fixed_test-persist-export-pipeline.json`

Expected: All three workflows now in Workflows list

- [ ] **Step 6: Set environment variables in n8n**

1. Click **Variables** (bottom left icon, next to ?)
2. Add three variables:
   - Name: `EXPORT_FILE_PATH`, Value: `/Users/rafalciesielski/Developer/ChiefofStaff/qa-news/public/latest.json`
   - Name: `VAULT_PATH`, Value: `/Users/rafalciesielski/Developer/ChiefofStaff/paios-vault` (or wherever vault clone is)
   - Name: `PAIOS_REPO_URL`, Value: `https://github.com/yourusername/paios.git` (or your fork)
3. Click **Save**

Expected: Variables visible in Variables list

- [ ] **Step 7: Test import with manual workflow execution**

1. Open `test-persist-export-pipeline` workflow
2. Click **Execute Workflow** (play button, top right)
3. Monitor execution in n8n UI

Expected: Workflow runs without errors; check logs for:
- ✓ Data fetched
- ✓ Article persisted to canonical_articles table
- ✓ latest.json generated
- ✓ Git commit pushed (if configured)

If errors: Check TROUBLESHOOTING.md or WORKFLOW_CONFIGURATION.md for common issues

- [ ] **Step 8: Verify canonical_articles has sample data**

1. Go to **Data** (left sidebar)
2. Click `canonical_articles`
3. Expected: At least 1 row with article data (from test workflow)

- [ ] **Step 9: Verify latest.json was generated**

```bash
ls -lh /Users/rafalciesielski/Developer/ChiefofStaff/qa-news/public/latest.json
head -50 /Users/rafalciesielski/Developer/ChiefofStaff/qa-news/public/latest.json | jq .
```

Expected: File exists, contains JSON with `items` array with article objects

- [ ] **Step 10: Create local checkpoint (no commit yet)**

Document the successful import state for reference:

```bash
# Capture workflow export for verification
docker-compose exec n8n n8n export:workflow --all > /tmp/workflows-imported-snapshot.json 2>/dev/null || echo "Workflows imported via UI (not CLI)"

# Expected: Workflows are now in n8n database (via Data Table)
```

---

## Task 5: Test Restore Procedure Locally and Verify

**Files:**
- Reference: `docs/RESTORE_PROCEDURE.md` (Part 1: Local)
- Modify: `docs/RESTORE_PROCEDURE.md` (update based on test results)

**Interfaces:**
- Consumes: Complete system from previous tasks (docker-compose with postgres, .env.example, parameterized workflows, imported M4 workflows)
- Produces: Verified, tested restore procedure that actually works; updated documentation if gaps found

**Deliverable:** Restore procedure is proven to work on clean local environment (ideally on fresh Docker state).

**Note:** This is the final verification that P1.0 is production-ready.

- [ ] **Step 1: Create clean test environment (optional but recommended)**

To truly test restore, simulate clean state:

```bash
# Stop and remove current containers
docker-compose down -v  # -v removes volumes

# (Re-setup would follow restore procedure steps)
```

Alternative: Create separate test compose file. For this plan, assume testing against current running system.

- [ ] **Step 2: Follow RESTORE_PROCEDURE.md Part 1 step-by-step**

Execute each step as written:
1. Prerequisites check
2. Clone repositories (verify git access)
3. Create .env (copy from .env.example, populate)
4. Start Docker Compose (should now include postgres)
5. Import n8n workflows (from Task 4)
6. Verify Telegram connectivity
7. Test scheduled jobs

Record any failures or unclear steps

- [ ] **Step 3: Execute verification tests**

After restore procedure completes:

```bash
# Verify Docker containers
docker-compose ps
# Expected: n8n, postgres both "Up"

# Verify n8n is accessible
curl -s http://localhost:5678 | head -c 100
# Expected: HTML response (n8n UI)

# Verify workflows are running
docker-compose logs n8n | tail -20
# Expected: No error logs, workflow activity visible

# Verify latest.json exists
test -f /Users/rafalciesielski/Developer/ChiefofStaff/qa-news/public/latest.json && echo "✓ latest.json exists"

# Verify database has data
docker-compose exec postgres psql -U n8n -d n8n -c "SELECT COUNT(*) FROM n8n_data;" || echo "Check postgres connection"
```

Expected: All checks pass

- [ ] **Step 4: Document any gaps found**

If restore procedure references steps that don't work or reference non-existent services:
- Document the gap
- Specify exact command that failed
- Note whether it's a docs issue (fix wording) or implementation issue (need to add service)

Example:
```
Gap found: Step 6 references "docker-compose exec vault ..." but vault service doesn't exist in docker-compose.yml

Fix: Either add vault service to compose (Task 2) OR update RESTORE_PROCEDURE Step 6 to skip vault-specific steps for MVP
```

- [ ] **Step 5: Update RESTORE_PROCEDURE.md if needed**

For any gaps found in Step 4:
- Clarify ambiguous steps
- Remove references to services not in use (with explanation)
- Add explicit verification commands

Example edit:
```markdown
### Step 6: Verify Vault and Git Sync (VPS only)

*This step is skipped for local development. On VPS, vault stores encrypted secrets.*

For local testing: Skip to Step 7.
```

- [ ] **Step 6: Run QA News build to verify end-to-end**

```bash
cd /Users/rafalciesielski/Developer/ChiefofStaff/qa-news
npm run build
```

Expected: Build succeeds, latest.json data is used

- [ ] **Step 7: Final verification report**

Create RESTORE_VERIFICATION.md documenting:
- Date tested
- Environment (macOS Docker, specs)
- All steps followed successfully
- Any workarounds needed
- Time to complete (should match estimate in RESTORE_PROCEDURE)

Example:
```markdown
# Restore Procedure Verification Report

**Date:** 2026-07-13
**Environment:** macOS Sonoma, Docker Desktop 4.x
**Procedure:** RESTORE_PROCEDURE.md Part 1 (Local)

## Results
- ✓ Step 1: Prerequisites verified (Docker, Git)
- ✓ Step 2: Repositories cloned successfully
- ✓ Step 3: .env created from template
- ✓ Step 4: Docker Compose started (n8n + postgres)
- ✓ Step 5: Workflows imported via n8n UI
- ✓ Step 6: Test workflow executed successfully
- ✓ Step 7: latest.json generated with sample data

**Time to Complete:** 12 minutes (within 10-15 min estimate)

**Blockers Found:** None

**Documentation Accuracy:** Excellent (all steps matched actual system)

**Recommendation:** Restore procedure is production-ready. Operationalization complete.
```

- [ ] **Step 8: Commit**

```bash
git add docs/RESTORE_PROCEDURE.md docs/RESTORE_VERIFICATION.md
git commit -m "docs: Verify and finalize restore procedure

- Tested RESTORE_PROCEDURE.md Part 1 on clean local environment
- All steps verified working (12-minute completion time)
- Updated docs to clarify services and fix any ambiguities
- Added RESTORE_VERIFICATION.md proof of successful restore

Unblocks: System ready for VPS migration and production deployment"
```

---

## Success Criteria

After all 5 tasks complete, P1.0 blockers should be cleared:

- ✅ **Blocker 1:** .env.example created at root, all variables documented
- ✅ **Blocker 2:** docker-compose.yml includes all services (postgres, n8n, vault mounts), matches docs
- ✅ **Blocker 3:** M4 workflows imported and running with no hardcoded paths
- ✅ **Blocker 4:** Hardcoded paths replaced with environment variables
- ✅ **Blocker 5:** Restore procedure tested locally, verified working, documented

**Code review re-check:** All 5 critical blockers should now be PASS. System should be ready for PR.

---

## Execution Path

**Recommended approach:** Use superpowers:subagent-driven-development (parallel tasks 1-3, sequential 4-5 for dependency ordering).

**Timeline:**
- Task 1 (Env config): ~20 min
- Task 2 (Docker Compose): ~30 min
- Task 3 (Workflow params): ~25 min
- Task 4 (Import + verify): ~45 min
- Task 5 (Restore test): ~30 min

**Total:** ~2.5 hours to clear all blockers and have system production-ready.
