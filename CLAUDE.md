# ChiefofStaff — Project Guidelines

> Project-level instructions for Claude. Updated regularly to reflect project state, architecture, and development norms.

---

## Repository Structure (as of 2026-07-15)

### Active Repositories

#### 1. ChiefofStaff
- **Purpose:** Primary TypeScript application — Personal AI Chief of Staff system
- **Location:** `/Users/rafalciesielski/Developer/ChiefofStaff` (local) / `https://github.com/rciesielski3/ChiefOfStaff` (GitHub)
- **Status:** 🟢 Active production project
- **Last Commit:** 2026-07-14 (58 total commits)
- **Technology:** TypeScript, Node.js, Jest, GitHub Actions
- **Key Features:**
  - M3 (Daily Brief): RSS feed ingestion and article persistence
  - M4 (Knowledge Layer): Article export and structured output
  - CI/CD: Automated GitHub Actions workflows
  - Testing: 157 passing unit tests
- **Deployment:** VPS migration planned in follow-up phase

#### 2. obsidian-vault
- **Purpose:** Knowledge base for personal project documentation
- **Location:** `/Users/rafalciesielski/Developer/obsidian-vault` (local) / `https://github.com/rciesielski3/obsidian-vault` (GitHub)
- **Status:** 🟢 Active knowledge base in daily use
- **Last Commit:** 2026-07-14
- **Technology:** Obsidian + Git
- **Contents:**
  - Daily notes and status tracking
  - Project documentation (ChiefofStaff, WorldExplorer, etc.)
  - Playbooks and operational procedures
  - Personal knowledge graph
- **Usage:** Daily project documentation, milestone tracking, decision logging

---

### Archived Repositories (Historical Reference)

All four Gen 1 repositories are archived on GitHub (original archives between 2026-07-12 and 2026-07-14). Archive tags added 2026-07-15 for historical tracking.

#### 1. paios
- **Purpose:** Original n8n-based PAIOS framework (Gen 1, superseded)
- **GitHub:** `https://github.com/rciesielski3/paios` (archived)
- **Status:** 🏛️ Archived 2026-07-14
- **Reason:** Superseded by ChiefofStaff (TypeScript/GitHub Actions rewrite)
- **Technology:** n8n orchestration, Docker Compose, PostgreSQL
- **Last Commit:** 5 commits, 2026-07-14T18:55:48Z

#### 2. paios-docs
- **Purpose:** Documentation for n8n-based PAIOS framework (Gen 1, superseded)
- **GitHub:** `https://github.com/rciesielski3/paios-docs` (archived)
- **Status:** 🏛️ Archived 2026-07-12
- **Reason:** Documentation superseded by ChiefofStaff/docs (no unique content)
- **Last Commit:** 1 commit, 2026-07-12T18:54:10Z

#### 3. paios-vault-template
- **Purpose:** Public template for n8n-based vault (Gen 1, superseded)
- **GitHub:** `https://github.com/rciesielski3/paios-vault-template` (archived)
- **Status:** 🏛️ Archived 2026-07-12
- **Reason:** Template for n8n framework (no longer used; ChiefofStaff uses different config model)
- **Last Commit:** 1 commit, 2026-07-12T18:54:05Z

#### 4. paios-vault
- **Purpose:** Instance vault for n8n-based PAIOS (Gen 1, superseded, private)
- **GitHub:** `https://github.com/rciesielski3/paios-vault` (archived, private)
- **Status:** 🏛️ Archived 2026-07-14
- **Reason:** Instance vault for n8n-based system (superseded by obsidian-vault)
- **Last Commit:** 2026-07-14T19:46:40Z

---

### Developer Directory Organization

```
/Users/rafalciesielski/Developer/
├── ChiefofStaff/                 # ✅ Active (primary production project)
├── obsidian-vault/               # ✅ Active (knowledge base)
├── archive/                      # 📦 Archive folder (for future archived projects)
│   └── [archived-repos-if-moved] # (paios-* repos remain on GitHub, not moved locally)
├── [Other active projects]       # Various learning/exploration projects
└── [Legacy projects]             # Other work projects
```

**Archive Strategy:**
- 4 paios-* repos archived on GitHub (not moved locally to /archive/)
- All repos maintain full git history on GitHub
- Archive decisions fully reversible (can unarchive via GitHub UI)
- See `/docs/project/ARCHIVED_REPOS.md` for full archive rationale and recovery procedures

---

## Gen 1 → Gen 2 Transition

### Why We Changed

**From:** n8n orchestration + Docker Compose (Gen 1 / paios)  
**To:** TypeScript/Node.js + GitHub Actions (Gen 2 / ChiefofStaff)

**Reasons for Migration:**
1. **Simplicity:** Reduced operational complexity by removing Docker/n8n layer
2. **Type Safety:** TypeScript provides better reliability and IDE support
3. **Native Testing:** Jest framework with 157 automated tests
4. **Deployment:** VPS strategy simpler than Docker Compose
5. **Version Control:** Articles and configs versioned in Git
6. **Maintainability:** Easier to extend and debug in TypeScript

### Architecture Comparison

| Aspect | Gen 1 (paios) | Gen 2 (ChiefofStaff) |
|--------|---------------|---------------------|
| Orchestration | n8n workflows | GitHub Actions |
| Language | Workflow JSON | TypeScript/Node.js |
| Deployment | Docker Compose | VPS |
| Database | PostgreSQL | NDJSON + GitHub |
| Knowledge Base | paios-vault (git) | obsidian-vault (Obsidian) |
| Testing | Manual | Jest (157 tests) |

---

## Document References

### Project Status & Knowledge
- `/docs/project/REPO_AUDIT.md` — Comprehensive audit of all repos
- `/docs/project/CLEANUP_PLAN.md` — Archive decisions and rationale
- `/docs/project/ARCHIVED_REPOS.md` — Archive record with recovery procedures
- `/docs/project/project_status.md` — Current P1.0 delivery status

### Development Guidelines
- See project README.md for features and setup
- See /docs/ for architecture, configuration, and deployment guides

---

## Key Contacts & References

**User Email:** r.ciesielski3@gmail.com  
**Primary Repository:** https://github.com/rciesielski3/ChiefOfStaff  
**Knowledge Base:** https://github.com/rciesielski3/obsidian-vault

---

**Last Updated:** 2026-07-15  
**Status:** Post-P1.0 consolidation phase  
**Next Phase:** VPS deployment, vault optimization (Phase 2)
