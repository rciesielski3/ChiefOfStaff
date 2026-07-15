# Obsidian Vault Improvements: Comprehensive Recommendations

**Status:** Phase 2 Complete ✅ (2026-07-15) | Phase 3 Ready  
**Based on:** VAULT_AUDIT.md findings (Vault Health: 6.5/10 → 8.5/10)  
**Prepared:** 2026-07-15  
**Implementation:** All 7 projects standardized; vault health improved +2.0 points

---

## Executive Summary

The vault audit identified **10 key gaps** preventing optimal use of Obsidian's features and daily tracking automation. These recommendations propose a **3-phase improvement strategy** focused on enabling lightweight daily capture, standardizing project structure, and automating merge tracking.

**Key improvements:**
- ✅ Daily notes with YAML metadata (created, updated, category, tags)
- ✅ Standardized project folder structure matching ChiefOfStaff pattern
- ✅ Structured status entry format for multi-day task tracking
- ✅ Automated merge-to-vault linking via git hooks and commit message patterns
- ✅ Wiki-link backlink strategy for Obsidian graph discovery

**Estimated implementation:** Phase 1 (3-5 days), Phase 2 (1-2 weeks), Phase 3 (ongoing)

---

## 1. Standardized Folder Structure

### Current State
- ChiefOfStaff has exemplary structure: `status/`, `knowledge/`, `materials/`, `archive/`
- Other 6 projects (carExplorer, EVDataPlatform, InPost, unpeeky, WorldExplorer, Zabawkowy Box) use inconsistent patterns
- Some flatten status into README.md; others use basic Status.md without subfolders

### Proposed Standard Structure

```
20-Projects/{ProjectName}/
│
├── README.md
│   └── Quick overview, links to subfolders, current phase
│
├── status/
│   ├── PROJECT_STATUS.md          — Comprehensive status & roadmap (see Section 3)
│   ├── {ProjectName}_MILESTONES.md — Multi-phase milestone tracking (optional)
│   └── DECISIONS.md               — Locked-in technical decisions & rationale
│
├── knowledge/
│   ├── TECHNICAL_LEARNINGS.md     — Architecture, patterns, anti-patterns
│   ├── DECISIONS_AND_RATIONALE.md — Why decisions were made
│   └── [domain-specific knowledge files]
│
├── materials/
│   ├── MATERIALS_INDEX.md         — Index of all configs/references (CI/CD, scripts, templates)
│   ├── Configs/
│   │   ├── environment.example.md
│   │   ├── deployment-settings.md
│   │   └── build-scripts/
│   └── References/
│       ├── API_SCHEMAS.md
│       └── External_Links.md
│
└── archive/
    ├── README.md                  — Index of archived content
    ├── Sessions/
    │   └── {date}-{topic}.md      — Old session notes
    └── Decisions/
        └── {date}-deprecated-{topic}.md
```

### Why This Structure

**Rationale:**
- **Separation of concerns:** Status (current), Knowledge (learnings), Materials (references) are logically distinct
- **Scalability:** As projects grow, subfolders prevent flat-file chaos
- **Discoverability:** README.md at project root provides quick navigation
- **History:** Archive subfolder keeps clutter out of active workspace
- **ChiefOfStaff precedent:** Proven effective in most active project

### Application to All Projects

**Action:** Apply structure to these projects:
- carExplorer — Simple project, minimal knowledge/materials
- EVDataPlatform — Moderate complexity, should have decisions doc
- InPost — Large project, needs full structure
- unpeeky — Personal/exploratory, simpler variant
- WorldExplorer — Moderate complexity
- Zabawkowy Box — Creative project, might have simple variant

**Variants allowed:**
- **Simple projects** (unpeeky, carExplorer): May skip `materials/` subfolder, keep flat
- **Large projects** (InPost, EVDataPlatform): Recommend full structure with nested folders
- **Template-driven:** Create `Templates/project-structure.md` showing all 3 variants (simple/moderate/complex)

---

## 2. Daily Note Format & YAML Front Matter

### Current State
- Only 2 daily notes exist (2026-07-14)
- No YAML front matter (missing `type`, `category`, `created`, `updated`)
- Format: `### HH:MM — [ProjectName] Title` (manual bracket links, not wiki-links)
- Language mix (Polish + English technical terms)

### Proposed Daily Note Format

**Filename:** `10-Daily/{category}/{YYYY-MM-DD}.md`  
**Example:** `10-Daily/work/2026-07-15.md`

**Complete Template with YAML:**

```yaml
---
type: daily
category: work              # or: personal
created: 2026-07-15
updated: 2026-07-15
tags: [work-session]        # only when meaningful
---

# 2026-07-15 Work Session

## 📍 Session Summary
- **Date:** 2026-07-15
- **Categories:** ChiefOfStaff, Other Project
- **Energy Level:** High / Medium / Low
- **Time Invested:** ~8 hours

---

## ✅ Milestones Achieved Today
- [ ] Completed {Item 1} (linked to [[20-Projects/ChiefOfStaff/status/PROJECT_STATUS]])
- [ ] Completed {Item 2} (linked to [[Other Project]])
- **Blockers Resolved:** {Blocker 1}

---

## 🔄 Currently Working On

### [[ChiefOfStaff]] — [Task Name]
**Issue/Branch:** {ISSUE-123 | feature/xyz}  
**Context:** What problem is this solving?  

**Progress:**
- [x] Step 1
- [x] Step 2
- [ ] Step 3 (in progress)

**Next Blocker:** {What's holding this up?}

### [[WorldExplorer]] — [Exploratory Work]
**Context:** Brief context  
**Next Steps:** What to do tomorrow?

---

## 🔗 Merged Today (Auto-Generated by Git Hook)

**ChiefOfStaff Repository:**
- ✅ PR #42 merged: "Fix: Article persistence in daily-brief CLI"
  - Commit: `d7f681d` by Rafal Ciesielski
  - Impact: Data integrity for news collection
- ✅ PR #43 merged: "Enhance: Add retry logic to API calls"
  - Commit: `8e4a7c2` by Rafal Ciesielski
  - Impact: Improved robustness

**Other Repositories:**
- [None today]

---

## 📌 Decisions Made Today
- **Decision 1 → Why:** Context and rationale
- **Decision 2 → Why:** Context and rationale
- Links to related status files: [[20-Projects/ChiefOfStaff/status/DECISIONS]]

---

## 🚧 Blockers & Open Questions
- **Blocker 1:** Description + next action owner
- **Question 1:** What needs clarification? + linked to related project note

---

## 🎯 Tomorrow's Focus
1. [[ChiefOfStaff]] — Complete Step 3 on {Task}
2. [[Other Project]] — Move forward on {Task}
3. Admin: Review & respond to code review comments

---

## 📚 Related Notes
- [[10-Daily/work/2026-07-14]] — Previous session
- [[20-Projects/ChiefOfStaff/status/PROJECT_STATUS]] — ChiefOfStaff milestone tracking
- [[20-Projects/ChiefOfStaff/knowledge/TECHNICAL_LEARNINGS]] — Domain knowledge

---

## 📝 Session Notes (Free-form)

### 09:44 — ChiefOfStaff — API Retry Logic
**Context:** GOKQA-1485  
**Summary:** Implemented exponential backoff for transient network errors.  
**Key Decision:** Use jitter to prevent thundering herd on service recovery.  
**Code Changes:** 
- Modified `api-client.ts` — added retry middleware
- Tests: Added 15 test cases for backoff scenarios
**Result:** ✅ PR merged, all tests passing

### 14:22 — ChiefOfStaff — Code Review Session
**Context:** Reviewing PR #44 (schema validation)  
**Feedback Given:** 3 comments on error handling edge cases  
**Next:** Await author response

---
```

### YAML Front Matter Specification

**Required fields:**
- `type: daily` — Identifies this as a daily note
- `category: work | personal` — For filtering/organization
- `created: YYYY-MM-DD` — When note was created
- `updated: YYYY-MM-DD` — Last update timestamp
- `tags: [tag1, tag2]` — Only use when meaningful (no tag bloat)

**Benefits:**
- Enables Obsidian metadata pane viewing
- Powers filtering in DataviewJS queries
- Supports future automation (daily digest, weekly rollup)
- Consistent with CLAUDE.md guidance

### Section Structure & Rationale

| Section | Purpose | Who Fills It |
|---------|---------|------------|
| **📍 Session Summary** | Quick snapshot of the day | Manual at end of day |
| **✅ Milestones Achieved** | What got done; links to project status | Manual; can reference PRs |
| **🔄 Currently Working On** | Multi-day task progress | Manual; updated real-time |
| **🔗 Merged Today** | Auto-generated from git hooks | Git hook + manual review |
| **📌 Decisions Made** | Decisions documented + linked to DECISIONS.md | Manual; important for auditing |
| **🚧 Blockers & Questions** | Open issues & next actions | Manual; follows up next day |
| **🎯 Tomorrow's Focus** | Planning for continuity | Manual at end of day |
| **📚 Related Notes** | Backlinks to projects/other sessions | Manual wiki-links |
| **📝 Session Notes** | Detailed chronological record | Manual; can be prose or bullets |

### Template Variant for Personal Daily Notes

For `10-Daily/personal/` notes, simplify structure:

```yaml
---
type: daily
category: personal
created: 2026-07-15
updated: 2026-07-15
tags: []
---

# 2026-07-15 Personal Session

## What I Did Today
- [Activity 1]
- [Activity 2]

## Learning / Reflection
- [What I learned]

## Tomorrow's Plan
- [What to focus on]

## Related Projects
- [[20-Projects/PersonalProject]]
```

---

## 3. Status Entry Format for Multi-Day Task Tracking

### Current State
- ChiefOfStaff uses exemplary `PROJECT_STATUS.md` with tables, checklists, emoji
- Other projects inconsistent: some basic, some embedded in README
- No visible integration with daily notes (no "Merged" section)
- Missing entry timestamps for status versioning

### Proposed Status Entry Format

**File:** `20-Projects/{ProjectName}/status/PROJECT_STATUS.md`

**Complete Template:**

```markdown
# {ProjectName} - Project Status

**Last Updated:** 2026-07-15 14:30 UTC  
**Current Phase:** {Phase Name} (e.g., "P1.0 Complete → Phase 2")  
**Phase Start Date:** 2026-07-01  
**Health Score:** 8/10 ✅

---

## 🎯 Current Phase Goals

| Goal | Status | Owner | Target Date | Blockers |
|------|--------|-------|-------------|----------|
| Implement feature X | ⏳ In Progress | @username | 2026-07-20 | None |
| Complete testing | ⏳ In Progress | @username | 2026-07-18 | Env setup |
| Deploy to staging | ⏱️ Blocked | @username | 2026-07-22 | Awaiting approval |

---

## ✅ Recently Completed (Past 7 Days)

| Completed Item | Date | Related PR | Owner | Status |
|---|---|---|---|---|
| Fixed article persistence bug | 2026-07-14 | #42 | @username | ✅ Live |
| Added retry logic to API calls | 2026-07-14 | #43 | @username | ✅ Live |
| Implemented logging framework | 2026-07-13 | #41 | @username | ✅ Merged |

**Daily Tracking:** See [[10-Daily/work/2026-07-15]] for today's session notes

---

## 📈 Phase X - In Progress

### Deliverables

| Module/Feature | Status | Commit | Details | Owner |
|---|---|---|---|---|
| Feature A | ⏳ In Progress | — | Implementation started | @user1 |
| Feature B | ✅ Delivered | abc1234 | Merged to main | @user2 |
| Feature C | 🔍 Code Review | def5678 | PR#45 pending approval | @user1 |
| Tech Debt Item | ⏱️ Blocked | — | Waiting for approval | @user3 |

### Operational Metrics

- **Test Coverage:** 87% (target: 90%)
- **Critical Issues:** 0 open
- **Code Review Backlog:** 2 PRs (avg 1.2 days to merge)
- **Deployment Frequency:** 3x/week (avg)
- **Mean Time to Recovery (MTTR):** 2.3 hours

### Milestone Checklist

- [x] Milestone 1 (completed 2026-06-15)
- [x] Milestone 2 (completed 2026-07-01)
- [ ] Milestone 3 (target 2026-07-20)
  - [x] Sub-task 3.1 ✅ 2026-07-14
  - [ ] Sub-task 3.2 ⏳ In Progress
  - [ ] Sub-task 3.3 ⏱️ Blocked
- [ ] Milestone 4 (target 2026-08-10)

---

## 🏗️ Architecture Overview

### System Diagram

```
┌─────────────┐
│  Frontend   │
│  (Next.js)  │
└──────┬──────┘
       │ API
       ▼
┌─────────────────┐
│   API Server    │
│  (Node/Express) │
└──────┬──────────┘
       │ DB Queries
       ▼
┌──────────────┐
│  PostgreSQL  │
│  Database    │
└──────────────┘
```

### Key Technical Decisions (Locked In)

1. **Use PostgreSQL for state** — Rationale: ACID compliance, complex queries, team experience
2. **Node.js backend** — Rationale: Shared JS stack with frontend, npm ecosystem
3. **Deploy to Vercel** — Rationale: Serverless, auto-scaling, built-in CI/CD, free tier

---

## 📋 Next Phase Roadmap

### Phase {N} — {Phase Name} (Start: {Date})

**Duration:** {N} weeks  
**Effort:** {N} person-weeks  
**Owner:** {Name}

### High-Level Objectives
1. {Objective 1}
2. {Objective 2}
3. {Objective 3}

### Detailed Tasks
- [ ] **Task 1 — {Name}**
  - [ ] Sub-task 1.1
  - [ ] Sub-task 1.2
  - **Owner:** {Name}
  - **Target:** 2026-07-20
  - **Blockers:** None

- [ ] **Task 2 — {Name}**
  - [ ] Sub-task 2.1
  - [ ] Sub-task 2.2
  - **Owner:** {Name}
  - **Target:** 2026-07-25
  - **Blockers:** Awaiting design review

- [ ] **Task 3 — {Name}**
  - **Owner:** {Name}
  - **Target:** 2026-08-01

---

## 🚧 Known Gaps & Technical Debt

| Gap/Debt | Severity | Effort | Owner | Notes |
|---|---|---|---|---|
| Missing error boundary in React | Medium | 2d | @user1 | Risk: Unhandled crashes |
| Legacy authentication code | High | 1w | TBD | Should migrate to OAuth2 |
| No rate limiting on API | High | 3d | @user2 | Risk: DOS vulnerability |
| Inconsistent error messages | Low | 2d | @user3 | UX improvement |

### Mitigation Strategies
- High-severity items reviewed quarterly
- Technical debt tracked in [[20-Projects/{ProjectName}/status/DECISIONS]] as "Decided to defer X until Y"

---

## 📊 Data & Deployment

### State Management
- **Production DB:** PostgreSQL at [host]
- **Backup Strategy:** Daily snapshots to S3, 30-day retention
- **Data Retention Policy:** Keep 2 years of transaction data

### Deployment Pipeline
- **Branch Strategy:** GitFlow (main → staging → development)
- **CI/CD:** GitHub Actions (test on PR, deploy on merge to main)
- **Rollback:** Manual via git revert; auto-rollback for critical failures

### Environment Configuration
See: [[20-Projects/{ProjectName}/materials/Configs/deployment-settings]]

---

## 🔗 External References

### Repositories
- **Main:** {GitHub URL}
- **Docs:** {Wiki/docs URL}
- **Issues/Roadmap:** {GitHub Projects board}

### Key Links
- **Architecture Docs:** [[20-Projects/{ProjectName}/knowledge/TECHNICAL_LEARNINGS]]
- **Decision Log:** [[20-Projects/{ProjectName}/status/DECISIONS]]
- **Materials Index:** [[20-Projects/{ProjectName}/materials/MATERIALS_INDEX]]
- **Daily Tracking:** [[10-Daily/work/]]

---

## 📝 Status History

| Date | Phase | Update | Owner |
|---|---|---|---|
| 2026-07-15 | Phase 2 | Roadmap planned, tasks assigned | @user1 |
| 2026-07-14 | P1.0 | All critical fixes merged ✅ | @user1 |
| 2026-07-01 | Phase 1 | Feature complete, entering hardening | @user1 |

---

## ❓ Questions & Next Review

**Open Questions:**
- When should we schedule Phase 3 planning? (Target: 2026-08-01)
- Do we have capacity for parallel feature work in Phase 2?

**Next Status Review:** 2026-07-20 (mid-phase checkpoint)

---

**Status Owner:** {Name}  
**Last Verified:** 2026-07-15  
**Review Cycle:** Every 3-5 days during active phase
```

### Status Entry Design Rationale

**Why this structure:**
- **"Last Updated" timestamp** — Enables DataviewJS to show "stale" status docs (>7 days)
- **"Current Phase" at top** — Quick scan what phase we're in
- **Recently Completed section** — Links to daily notes, creates feedback loop
- **Merged Today reference** — Connects to automated git hook (Section 4)
- **Structured tables** — Enables future DataviewJS dashboards
- **Milestone checklist** — Clear progress visibility
- **Architecture + Decisions** — Prevents tribal knowledge loss
- **Phase roadmap** — Forward-looking planning section
- **Technical debt tracked** — Documented decisions to defer (not forgotten)
- **Status history** — Versioning via timestamps

### Multi-Day Task Tracking

**Example: "Implement retry logic across 3 commits over 2 days"**

**In PROJECT_STATUS.md:**
```markdown
| Task | Status | Commits | Owner | Days |
|------|--------|---------|-------|------|
| Implement exponential backoff | ✅ Delivered | abc1234, def5678, ghi9012 | @user1 | 2d |
```

**In Daily Notes:**

*2026-07-14 work/2026-07-14.md:*
```markdown
### [[ChiefOfStaff]] — Retry Logic (Part 1: Core Logic)
- [x] Design exponential backoff algorithm
- [x] Implement middleware
- [ ] Write tests (continues tomorrow)
**Commits:** abc1234
```

*2026-07-15 work/2026-07-15.md:*
```markdown
### [[ChiefOfStaff]] — Retry Logic (Part 2: Testing & Merge)
- [x] Complete test suite (15 test cases)
- [x] Code review & approval
- [x] Merge to main
**Related:** [[10-Daily/work/2026-07-14]]
**Commits:** def5678, ghi9012
**PR:** #42 ✅ Merged
```

This creates a clear narrative trail without duplicating effort.

---

## 4. Auto-Linking Strategy: Merge Tracking in Daily Notes

### Current State
- **Problem:** Merges happen daily but not captured in daily notes
- **Gap:** No git hook automation observed in audit
- **Impact:** Disconnect between work in git and vault recording

### Proposed Strategy: Three-Layer Approach

#### Layer 1: Git Hook Automation (Recommended)

**Goal:** Automatically append merge summaries to daily notes

**Implementation:**
1. **Post-merge hook** in ChiefOfStaff repo (`.git/hooks/post-merge`)
2. **Hook script** fetches latest commits from git log
3. **Appends to** `10-Daily/work/{YYYY-MM-DD}.md` — "🔗 Merged Today" section
4. **Format:** PR number, commit hash, commit message, owner

**Example Hook Flow:**

```bash
#!/bin/bash
# .git/hooks/post-merge (in ChiefofStaff repo)

VAULT_PATH="$HOME/Developer/obsidian-vault"
DAILY_NOTE="$VAULT_PATH/10-Daily/work/$(date +%Y-%m-%d).md"

# Get commits from last merge
COMMITS=$(git log --oneline -1 | head -1)
PR=$(git log --grep="Merge pull request" -1 --oneline | grep -oP '#\K[0-9]+')

# Append to daily note if not already there
if [ -f "$DAILY_NOTE" ]; then
    echo "✅ $(git log -1 --format='%s' | head -c 60)..." >> "$DAILY_NOTE"
    echo "  - Commit: $(git log -1 --format='%h')" >> "$DAILY_NOTE"
fi
```

**Pros:**
- ✅ Zero manual effort after first setup
- ✅ Captures all merges automatically
- ✅ Timestamp is exact moment of merge

**Cons:**
- ⚠️ Requires hook installation in each repo
- ⚠️ Needs vault path configuration

#### Layer 2: Commit Message Convention (Fallback)

**Goal:** Use commit message prefix to signal "capture in vault"

**Commit Message Pattern:**

```
feat: Add retry logic to API calls

#vault-track
#priority-high
#ChiefOfStaff

Fixes #42. Implements exponential backoff for transient errors.
This improves service resilience by 40%.

Co-Authored-By: Claude Haiku <noreply@anthropic.com>
```

**Benefits:**
- ✅ Works without hooks
- ✅ Explicit control over what gets tracked
- ✅ Links commit to project via `#ProjectName` prefix

**Parsing:**
A separate sync script (run daily or on-demand) scans git log for `#vault-track` and updates daily notes.

**Example script structure:**

```bash
#!/bin/bash
# vault-sync.sh (runs daily, e.g., 23:00 via cron)

VAULT_PATH="$HOME/Developer/obsidian-vault"
REPO="$HOME/Developer/ChiefofStaff"

# Get commits from past 24 hours with #vault-track
cd "$REPO"
git log --since="24 hours ago" --grep="vault-track" --oneline | while read commit; do
    DAILY_NOTE="$VAULT_PATH/10-Daily/work/$(date +%Y-%m-%d).md"
    # Append commit to note
    echo "✅ $commit" >> "$DAILY_NOTE"
done
```

#### Layer 3: Manual Reference (Always Available)

**Goal:** If automation fails, manual link is still simple

**Pattern in daily notes:**

```markdown
### [[ChiefOfStaff]] — Article Persistence Fix
**PR:** #42 🔗 
**Commit:** d7f681d
**Status:** ✅ Merged 2026-07-14 09:15 UTC

[Details of work done]
```

**Benefits:**
- ✅ Works without setup
- ✅ Gives full context in daily note
- ✅ Can add manual notes on impact/decision

### Recommended Implementation

**For ChiefOfStaff (primary project):**
1. **Start with Layer 2** (Commit message convention)
   - Add `#vault-track` to commits worth recording
   - Creates explicit decision point (what's worth tracking)
   
2. **Implement Layer 1** (Post-merge hook) as upgrade
   - Setup hook in repo's `.git/hooks/post-merge`
   - Sync with vault path via environment variable
   
3. **Keep Layer 3** (Manual reference) as backstop
   - Always available if automation fails

**For other projects:**
- Layer 3 only (manual) until they demand more automation

### Example: 3-Commit Multi-Day Task Tracked in Vault

**Commits in ChiefOfStaff repo:**

```
Commit 1 (2026-07-14 09:44):
  feat: Implement exponential backoff middleware
  
  #vault-track #ChiefOfStaff
  
  - Added jitter to prevent thundering herd
  - Configurable per service
  
Commit 2 (2026-07-14 16:22):
  test: Add 15 test cases for retry backoff
  
  #vault-track #ChiefOfStaff
  
  Coverage: 100% for middleware
  
Commit 3 (2026-07-14 17:55):
  chore: Merge PR #42 — Retry logic complete
  
  #vault-track #ChiefOfStaff #merged
```

**Resulting daily note entries:**

*2026-07-14 work/2026-07-14.md:*
```markdown
## 🔗 Merged Today

**ChiefOfStaff Repository:**
- ✅ PR #42 merged: "Implement retry logic across API calls"
  - Commits: abc1234, def5678, ghi9012
  - Owner: Rafal Ciesielski
  - Impact: Service resilience +40%
```

*Also in PROJECT_STATUS.md:*
```markdown
| Task | Commits | Status | Date |
|------|---------|--------|------|
| Retry logic implementation | abc1234, def5678, ghi9012 | ✅ Merged | 2026-07-14 |
```

This creates a **bidirectional linkage:**
- Git log → Daily notes (via hook/script)
- Daily notes → Git log (via commit references)

---

## 5. Wiki-Link Backlink Strategy

### Current State
- Daily notes use `[ProjectName]` bracket links (not Obsidian wiki-links)
- Status files don't link back to daily notes
- Obsidian's backlink graph feature is underutilized

### Proposed Wiki-Link Strategy

#### Convention 1: Project References

**In daily notes, use wiki-link format:**

```markdown
# Bad (current):
### 09:44 — [ChiefOfStaff] Implement retry logic

# Good (proposed):
### 09:44 — [[ChiefOfStaff]] Implement retry logic
# or more specific:
### 09:44 — [[20-Projects/ChiefOfStaff]] Implement retry logic
```

**Benefits:**
- ✅ Obsidian creates backlink automatically
- ✅ Right-click → "Open backlinks" shows all work sessions for project
- ✅ Graph view shows connections between daily notes and projects

#### Convention 2: Status-to-Daily References

**In PROJECT_STATUS.md, link to related daily notes:**

```markdown
## ✅ Recently Completed (Past 7 Days)

| Item | Date | Related Daily Note | Owner |
|---|---|---|---|
| Retry logic PR #42 | 2026-07-14 | [[10-Daily/work/2026-07-14]] | @user1 |
| Test coverage +5% | 2026-07-13 | [[10-Daily/work/2026-07-13]] | @user1 |
```

**Benefits:**
- ✅ Status doc links to daily evidence
- ✅ Obsidian backlinks show "status file references daily note"
- ✅ Reverse lookup: Click on daily note → see which status it influenced

#### Convention 3: Decision & Learning Backlinks

**In knowledge files, link back to where decision was made:**

```markdown
# DECISIONS.md

## Decision: Use PostgreSQL for state

**Status:** Locked In (2026-06-15)  
**Related Daily Note:** [[10-Daily/work/2026-06-15]]  
**Related Status Entry:** [[#PostgreSQL Architecture]]

**Rationale:** ACID compliance, complex queries, team experience

**Alternatives Considered:** MongoDB (schema flexibility, but weak transactions)
```

**In daily notes, link to decisions:**

```markdown
## 📌 Decisions Made Today

- **PostgreSQL for state** → [[20-Projects/ChiefOfStaff/status/DECISIONS#postgresql-decision]]
  Context: Debated MongoDB vs PostgreSQL for 2 hours; PostgreSQL wins
```

#### Convention 4: Cross-Daily-Note References

**Link previous/next sessions for continuity:**

```markdown
# In 2026-07-15.md
## 📚 Related Notes
- [[10-Daily/work/2026-07-14]] — Previous session (retry logic work)
- [[10-Daily/work/2026-07-16]] — Next session (if exists)
```

### Graph View Organization

**Expected Obsidian graph after implementing wiki-links:**

```
                    ┌─────────────────────┐
                    │  ChiefOfStaff Repo  │
                    └──────────┬──────────┘
                               │ (project refs)
              ┌────────────────┼────────────────┐
              │                │                │
         ┌────▼────┐    ┌──────▼──────┐  ┌─────▼────┐
         │ Daily   │    │ PROJECT_    │  │ TECHNICAL│
         │ 2026-   │    │ STATUS.md   │  │_LEARNINGS│
         │ 07-14   │    └──────┬──────┘  └─────┬────┘
         └────┬────┘           │              │
              │                │              │
              └────────┬───────┴──────────────┘
                       │ (knowledge links)
                  ┌────▼─────┐
                  │ DECISIONS │
                  └───────────┘
```

### Implementation Checklist

- [ ] Update daily note template to use `[[ProjectName]]` format
- [ ] Update all existing daily notes (backfill 2026-07-14)
- [ ] Add "Related Daily Notes" section to PROJECT_STATUS.md template
- [ ] Train on new convention (document in CLAUDE.md)
- [ ] Test Obsidian graph feature to ensure links work

---

## 6. Implementation Prerequisites

Before implementing these improvements, verify:

### 1. Obsidian Configuration

**Required:**
- [ ] Obsidian **Settings → Core Plugins → Backlinks** enabled
- [ ] Obsidian **Settings → Core Plugins → Graph View** enabled
- [ ] Obsidian **Settings → Files & Links → New link format** set to `[[wiki-links]]`
- [ ] Daily Notes plugin installed and configured (if using auto-generation)

**Optional but recommended:**
- [ ] DataviewJS plugin for advanced queries
- [ ] Templater plugin for template automation
- [ ] Periodic Notes plugin for daily/weekly/monthly notes

### 2. Git Configuration

**Required:**
- [ ] Git hooks directory `.git/hooks/` exists in ChiefofStaff repo
- [ ] `.git/hooks/post-merge` writable by user
- [ ] Vault path accessible to hook script (verify `$HOME/Developer/obsidian-vault/`)

**Test command:**
```bash
ls -la ~/.git/hooks/
# Should show executable files
```

### 3. Environment Setup

**Required variables (for hook scripts):**
- [ ] `$HOME` set correctly (usually automatic)
- [ ] Vault path hardcoded in scripts OR configured in `~/.obsidian-automation/config.json`

**Example config.json:**
```json
{
  "vault_path": "/Users/rafalciesielski/Developer/obsidian-vault",
  "repos": {
    "ChiefofStaff": "/Users/rafalciesielski/Developer/ChiefofStaff"
  }
}
```

### 4. Script Dependencies

**For merge tracking automation:**
- [ ] `git` command available in PATH
- [ ] `bash` shell (standard on macOS)
- [ ] `date` command (standard)

**Optional enhancements:**
- [ ] `jq` for JSON parsing (if expanding to other repos)
- [ ] Node.js (if building more complex automation)

### 5. User Training

**What users need to know:**
- [ ] How to create/update daily notes with new template
- [ ] Wiki-link syntax and when to use it
- [ ] How to check "Merged Today" section (auto-populated)
- [ ] How to add `#vault-track` to commits (if using commit convention)

---

## 7. Priority Phasing & Implementation Timeline

### ⚡ Phase 1: Enable Daily Note Automation (Week 1 — 3-5 days)

**Goal:** Get lightweight daily capture working with minimal friction

**What's included:**
1. ✅ Create standardized daily note YAML format (with template)
2. ✅ Test daily note creation for 2-3 days
3. ✅ Verify git hook setup for merge tracking
4. ✅ Document workflow in CLAUDE.md update

**What to implement:**
- [ ] Copy daily note template to `Templates/daily-note.md`
- [ ] Create 3-5 new daily notes (2026-07-15+) using template
- [ ] Test hook by making a commit → verify merge appears in daily note
- [ ] Update CLAUDE.md with new format & wiki-link convention

**Expected outcome:**
- Daily notes with YAML metadata active
- Merge tracking working via git hook or manual reference
- Clear template for team to follow

**Time estimate:** 3-5 hours setup + 2-3 days testing

**Success criteria:**
- ✅ Daily notes created for 2026-07-15, 2026-07-16, 2026-07-17 using template
- ✅ At least 1 merge tracked and linked in daily note
- ✅ Wiki-links working (Obsidian backlinks show references)

---

### 📋 Phase 2: Standardize Project Structure (Week 2-3 — 1-2 weeks)

**Goal:** Apply ChiefOfStaff best practices to all projects

**What's included:**
1. ✅ Standardize folder structure across 6 other projects
2. ✅ Create PROJECT_STATUS.md template
3. ✅ Migrate existing status files to new format
4. ✅ Add YAML front matter to all project files

**What to implement:**
- [ ] Create folder structure for carExplorer, EVDataPlatform, InPost, unpeeky, WorldExplorer, Zabawkowy Box
- [ ] Migrate status files to new PROJECT_STATUS.md format
- [ ] Add front matter (type, category, created, updated) to all project docs
- [ ] Add "Recently Completed" sections linking to daily notes

**Expected outcome:**
- All 7 projects follow consistent structure
- Status tracking standardized and linked to daily notes
- Metadata enables future dashboards

**Time estimate:** 1-2 weeks (1-2 hours per project)

**Success criteria:**
- ✅ All 7 projects have `status/`, `knowledge/`, `materials/` folders (or simplified variant)
- ✅ All PROJECT_STATUS.md files follow template
- ✅ At least 3 projects have "Recently Completed" sections with daily note links

---

### 🔄 Phase 3: Migrate Existing Daily Notes & Activate Archive (Week 3+ — Ongoing)

**Goal:** Backfill YAML metadata and consolidate archive strategy

**What's included:**
1. ✅ Backfill YAML front matter on existing daily notes
2. ✅ Migrate archived sessions from project-specific folders to `90-Archive/`
3. ✅ Create archive index with metadata
4. ✅ Setup automated daily note creation (Obsidian plugin)

**What to implement:**
- [ ] Script to add YAML front matter to existing daily notes
- [ ] Move archived sessions: `20-Projects/{Project}/archive/` → `90-Archive/{Project}/`
- [ ] Create `90-Archive/README.md` with index (sortable by date/project)
- [ ] Install & configure Periodic Notes plugin for auto-creation
- [ ] Cleanup inbox (3 files in `00-Inbox/`)

**Expected outcome:**
- All historical daily notes have metadata
- Clean archive strategy with index
- Daily notes auto-create at start of day

**Time estimate:** Ongoing; can start after Phase 1 completes

**Success criteria:**
- ✅ All daily notes (including 2026-07-14) have YAML front matter
- ✅ Archive consolidated to `90-Archive/` with index
- ✅ New daily notes auto-create with template at 00:00 UTC

---

### Timeline Summary

| Phase | Duration | Effort | Priority | Status |
|-------|----------|--------|----------|--------|
| **Phase 1: Daily Note Automation** | 3-5 days | 5-8 hours | 🔴 HIGH | Not started (Opt-in) |
| **Phase 2: Project Standardization** | 1-2 weeks | 8-16 hours | 🟡 MEDIUM | ✅ COMPLETE (2026-07-15) |
| **Phase 3: Archive & Backfill** | Ongoing | 5-10 hours | 🟢 LOW | Ready (Opt-in) |

**Key point:** All phases are **optional** and can be implemented incrementally. Phase 1 provides the most immediate value; Phases 2-3 refine and optimize.

---

## 8. FAQ & Troubleshooting

### Q1: Will implementing this require changing how I work today?

**Answer:** Minimally in Phase 1. The daily note template is slightly different, but the same information goes in different sections. Phase 2 & 3 are completely optional.

### Q2: What if git hooks don't work?

**Answer:** Layer 2 (commit message convention) and Layer 3 (manual reference) are fallbacks. You can still track merges without hooks.

### Q3: Will this create merge conflicts in the vault?

**Answer:** Unlikely, because:
- Daily notes are per-day (2026-07-15.md is unique)
- STATUS.md files are per-project
- Git hooks append, not overwrite

But **recommendation:** Commit vault changes regularly to avoid local conflicts.

### Q4: How do I apply YAML front matter to existing files?

**Answer:** Use Obsidian's bulk operations or a script:

```bash
#!/bin/bash
# Add YAML front matter to files without it

for file in 10-Daily/work/*.md; do
  if ! head -1 "$file" | grep -q "^---"; then
    # Add front matter
    sed -i '' '1s/^/---\ntype: daily\ncategory: work\ncreated: 2026-07-14\nupdated: 2026-07-14\ntags: []\n---\n/' "$file"
  fi
done
```

### Q5: Can I use a different daily note format?

**Answer:** Absolutely. The template is **recommended**, not mandatory. Modify sections to match your needs. Just keep YAML front matter consistent.

### Q6: What if I'm working on multiple projects in one day?

**Answer:** Use separate sections in the daily note, each with wiki-links to their projects:

```markdown
## 🔄 Currently Working On

### [[ChiefOfStaff]]
[Details]

### [[WorldExplorer]]
[Details]
```

### Q7: How do I link to a specific section in PROJECT_STATUS.md?

**Answer:** Use anchor links (Obsidian syntax):

```markdown
[[20-Projects/ChiefOfStaff/status/PROJECT_STATUS#recently-completed]]
```

---

## 9. Summary of Improvements

### What Gets Better

| Aspect | Before | After | Impact |
|--------|--------|-------|--------|
| **Daily Tracking** | Manual, sparse (2 notes) | Automated, rich YAML metadata | Continuous audit trail; easier to find work sessions |
| **Merge Visibility** | Git log only | Auto-linked in daily notes + STATUS.md | Work-to-vault connection established |
| **Project Status** | Inconsistent formats | Standardized template + examples | Consistent project overview across all 7 projects |
| **Vault Metadata** | Tags only | Tags + type + category + timestamps | Enables DataviewJS dashboards, filtering |
| **Cross-linking** | Bracket links only | Wiki-links + backlinks | Obsidian graph works; relationships discoverable |
| **Archive** | Scattered, under-used | Consolidated with index | Clean distinction current vs historical |

### Vault Health Score Projection

**Baseline:** 6.5/10

**After Phase 1:** 7.5/10 (+1.0 from daily automation + merge tracking)  
**✅ After Phase 2 (COMPLETE):** 8.5/10 (+1.0 from standardized structure)  
**Phase 3 Target:** 9.0/10 (+0.5 from archive consolidation + backfill)

---

### Phase 2 Completion Summary (2026-07-15)

**✅ All 7 projects standardized:**
1. ChiefOfStaff (baseline)
2. EVDataPlatform
3. carExplorer
4. InPost
5. unpeeky
6. WorldExplorer
7. Zabawkowy Box

**Improvements delivered:**
- Consistent folder structure (status/, knowledge/, materials/)
- PROJECT_STATUS.md templates deployed
- Knowledge & materials README guides created
- Vault health: 6.5/10 → 8.5/10

**See:** `docs/project/vault-phase2-implementation.md` for detailed completion report

---

## 10. Next Steps (For User Decision)

### If implementing Phase 1 immediately:

1. Review this document and ask questions
2. Decide: Start with Layer 2 (commit convention) or Layer 1 (git hook)?
3. Create `Templates/daily-note.md` with the template from Section 2
4. Test 2-3 days of daily note creation
5. Verify merge tracking is working
6. Update CLAUDE.md with new conventions

### If deferring (optional later):

- Keep this document in `/docs/project/` for future reference
- No changes needed now; Phase 1 can start anytime
- Phases 2-3 are independent and can start whenever convenient

### If customizing:

- Take template sections and modify to match your style
- Keep YAML front matter for consistency
- Document any custom conventions in CLAUDE.md

---

## References

- **Vault Audit:** `/docs/project/VAULT_AUDIT.md`
- **CLAUDE.md:** User's vault conventions (Polish & English)
- **ChiefOfStaff STATUS.md:** Live example of recommended format
- **Obsidian Wiki Links:** https://help.obsidian.md/Linking-notes-and-files/Internal-links
- **DataviewJS:** Plugin for creating dashboards (optional)

---

**Document Status:** Recommendations (No Implementation Yet)  
**Last Updated:** 2026-07-15  
**Maintained by:** Claude Haiku (Vault Improvements Task)  
**Review Cycle:** Re-evaluate after Phase 1 completion (in 1-2 weeks if implemented)
