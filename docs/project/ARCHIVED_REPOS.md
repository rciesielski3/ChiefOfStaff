# Archived Repositories — Archive Record

**Archive Date:** 2026-07-15  
**Archive Tag:** `archive-2026-07-15`  
**Status:** 4 Gen 1 repos archived, 2 active repos maintained  
**Context:** Transition from n8n/Docker (Gen 1) to TypeScript/GitHub Actions (Gen 2)

---

## Executive Summary

This document tracks the archival of four Generation 1 repositories as part of the post-P1.0 consolidation phase. All four repos were already archived on GitHub (between 2026-07-12 and 2026-07-14) and are now formally documented with rationale, recovery procedures, and migration notes.

**Active Repositories (KEEP):**
- ChiefofStaff — Main production project
- obsidian-vault — Knowledge base

**Archived Repositories (ARCHIVED):**
- paios
- paios-docs
- paios-vault-template
- paios-vault

---

## Archived Repositories

### 1. paios

**GitHub URL:** `https://github.com/rciesielski3/paios`

**Archive Date:** 2026-07-14 (archived on GitHub)  
**Tag:** `archive-2026-07-15`

**Purpose:** Original PAIOS framework using n8n orchestration and Docker Compose for daily briefings and knowledge management (Gen 1)

**Technology Stack:**
- n8n workflow platform
- Docker & Docker Compose
- PostgreSQL database
- Bash scripts for operations
- Workflow JSON exports (M1-M4 features)

**Why Archived:**
- Superseded by ChiefofStaff (TypeScript/Node.js rewrite)
- n8n approach replaced with GitHub Actions + Node.js CLIs
- Docker Compose deployment replaced with VPS strategy
- All functionality migrated to modern stack

**Last Commit:** 2026-07-14T18:55:48Z (5 commits total)

**Data Preservation:** ✅ Full git history preserved on GitHub (archived repo maintains all commits)

**Reference Documentation:**
- See `REPO_AUDIT.md` for detailed analysis
- See `CLEANUP_PLAN.md` for decision rationale

---

### 2. paios-docs

**GitHub URL:** `https://github.com/rciesielski3/paios-docs`

**Archive Date:** 2026-07-12 (archived on GitHub)  
**Tag:** `archive-2026-07-15`

**Purpose:** Official documentation for the PAIOS n8n framework (Gen 1) — setup, architecture, configuration, troubleshooting, and roadmap

**Documentation Contents:**
- QUICKSTART.md — 5-minute setup guide
- ARCHITECTURE.md — System design and data flow
- CONFIGURATION.md — Vault and workflow customization
- TROUBLESHOOTING.md — Common issues and solutions
- CONTRIBUTING.md — Contribution guidelines
- ROADMAP.md — Planned features (M5+)

**Why Archived:**
- Documentation superseded by ChiefofStaff/docs
- ChiefofStaff contains updated versions of all critical docs
- New stack (TypeScript) requires different setup and configuration
- Significant redundancy detected — no unique content worth preserving

**Overlap with ChiefofStaff/docs:**
- ChiefofStaff/docs includes ARCHITECTURE_REVIEW.md (more detailed)
- Updated CONFIGURATION.md (specific to TypeScript setup)
- New TROUBLESHOOTING.md (specific to new stack)
- New deployment docs (VPS_MIGRATION_PLAN.md, VPS_CHECKLIST.md)

**Last Commit:** 2026-07-12T18:54:10Z (1 commit total)

**Data Preservation:** ✅ Full git history preserved on GitHub (archived repo maintains all commits)

**Reference Documentation:**
- See `REPO_AUDIT.md` for detailed overlap analysis
- See `CLEANUP_PLAN.md` for decision rationale

---

### 3. paios-vault-template

**GitHub URL:** `https://github.com/rciesielski3/paios-vault-template`

**Archive Date:** 2026-07-12 (archived on GitHub)  
**Tag:** `archive-2026-07-15`

**Purpose:** Public template repository for users to create private PAIOS vaults (Gen 1) — configuration examples, prompts, and query templates

**Template Contents:**
- system/config/ — YAML configuration examples
- system/prompts/ — Markdown templates for synthesis
- system/queries/ — SQL query examples
- daily/ — Example output structure

**Why Archived:**
- Template for n8n-based PAIOS framework (no longer active)
- Superseded by ChiefofStaff's configuration model
- Reference material only (not an actual vault)
- ChiefofStaff handles configuration via JSON/YAML files directly in repo

**Active Vault Alternative:** `/Users/rafalciesielski/Developer/obsidian-vault` (Obsidian-based, actively maintained)

**Last Commit:** 2026-07-12T18:54:05Z (1 commit total)

**Data Preservation:** ✅ Full git history preserved on GitHub (archived repo maintains all commits)

**Reference Documentation:**
- See `REPO_AUDIT.md` for detailed analysis
- See `CLEANUP_PLAN.md` for decision rationale

---

### 4. paios-vault

**GitHub URL:** `https://github.com/rciesielski3/paios-vault` (private)

**Archive Date:** 2026-07-14 (archived on GitHub)  
**Tag:** `archive-2026-07-15`

**Privacy:** Private repository

**Purpose:** Instance vault for n8n-based PAIOS system (Gen 1) — contains personal configurations, prompts, and knowledge base

**Expected Contents:**
- Real API keys and configurations (private)
- Custom prompts for synthesis
- Query results and generated briefs
- Personal knowledge graph

**Why Archived:**
- Instance vault for n8n-based PAIOS (superseded)
- Replaced by obsidian-vault (Obsidian-based, modern approach)
- No longer needed for ChiefofStaff operations
- Different architecture requires different vault organization

**Active Vault Alternative:** `/Users/rafalciesielski/Developer/obsidian-vault` (Obsidian-based, Git-backed, publicly accessible)

**Last Commit:** 2026-07-14T19:46:40Z (details not inspected — private repo)

**Data Preservation:** ✅ Full git history preserved on GitHub (archived repo maintains all commits, private archive)

**Reference Documentation:**
- See `REPO_AUDIT.md` for decision rationale
- See `CLEANUP_PLAN.md` for archive decision

---

## Migration Notes: Gen 1 → Gen 2

### Framework Architecture

| Aspect | Gen 1 (paios) | Gen 2 (ChiefofStaff) |
|--------|---------------|---------------------|
| **Orchestration** | n8n workflows | GitHub Actions |
| **Language** | Workflow JSON | TypeScript/Node.js |
| **Deployment** | Docker Compose (local) | VPS (planned) |
| **Database** | PostgreSQL | NDJSON files + GitHub |
| **Knowledge Base** | paios-vault (git) | obsidian-vault (Obsidian) |
| **Testing** | Manual verification | Jest (157 tests) |
| **CI/CD** | Manual runs | Automated GitHub Actions workflows |

### Key Architectural Decisions

1. **Orchestration:** Replaced n8n workflows with GitHub Actions
   - Reason: Simpler deployment, serverless, no separate orchestration layer needed
   - Benefits: Reduced operational overhead, easier to version control

2. **Language:** Shifted to TypeScript/Node.js
   - Reason: Type safety, better testing, native CLI tools
   - Benefits: Improved reliability, easier debugging, modern tooling

3. **Persistence:** NDJSON + GitHub instead of PostgreSQL
   - Reason: Simpler setup, GitHub as single source of truth
   - Benefits: No database maintenance, articles versioned in git

4. **Knowledge Base:** Obsidian vault instead of git-backed vault
   - Reason: Better UX, local-first, richer linking
   - Benefits: More powerful note-taking, better knowledge navigation

### Features Migration

| Feature | Gen 1 | Gen 2 |
|---------|-------|-------|
| M3 (Daily Brief) | n8n workflow | daily-brief.ts CLI |
| M4 (Export News) | n8n workflow | export-latest-news.ts CLI |
| Article Persistence | PostgreSQL | canonical_articles.ndjson |
| Knowledge Layer | paios-vault | obsidian-vault |
| CI/CD | Manual | GitHub Actions (automated) |

---

## Recovery Procedures

### Unarchive a Repository (if needed)

All archival decisions are **fully reversible**:

1. Navigate to archived repo on GitHub (e.g., https://github.com/rciesielski3/paios)
2. Click **Settings** (top-right gear icon)
3. Scroll to **Danger Zone** section
4. Click **Unarchive this repository**
5. Confirm the action

**Time to restore:** ~2 minutes per repo  
**Data integrity:** Guaranteed — all commits and history preserved

### Clone an Archived Repo Locally (if needed)

```bash
# Clone archived repo
git clone https://github.com/rciesielski3/paios.git /path/to/clone

# History is fully intact
cd /path/to/clone
git log --oneline | head -10
```

### Remove Archive Tag (if needed)

```bash
# Remove archive tag from a repo
gh api repos/rciesielski3/paios/git/refs/tags/archive-2026-07-15 -X DELETE
```

---

## Verification Checklist

Task 1.3 completion verification:

- ✅ Archive directory created: `/Users/rafalciesielski/Developer/archive/`
- ✅ All 4 paios-* repos verified as archived on GitHub
- ✅ ARCHIVED_REPOS.md created with full documentation
- ✅ CLAUDE.md updated with repository structure section
- ✅ Recovery procedures documented
- ✅ Git history preserved for all archived repos
- ✅ No local directories affected (repos not cloned locally)
- ✅ ChiefofStaff and obsidian-vault remain active and unaffected

---

## Files Referenced

- **REPO_AUDIT.md** — Complete audit findings and detailed analysis
- **CLEANUP_PLAN.md** — Cleanup decision documentation and rationale
- **CLAUDE.md** — Project guidelines and repository structure (updated)
- Active repos on GitHub:
  - https://github.com/rciesielski3/ChiefOfStaff (active)
  - https://github.com/rciesielski3/obsidian-vault (active)
- Archived repos on GitHub:
  - https://github.com/rciesielski3/paios (archived 2026-07-14)
  - https://github.com/rciesielski3/paios-docs (archived 2026-07-12)
  - https://github.com/rciesielski3/paios-vault (archived 2026-07-14, private)
  - https://github.com/rciesielski3/paios-vault-template (archived 2026-07-12)

---

**Archive Status:** Complete  
**Last Updated:** 2026-07-15  
**Next Phase:** Follow-up cleanup (vault organization, GitHub rationalization)
