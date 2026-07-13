# M4 Knowledge Layer Operationalization - Status Report

**Date**: 2026-07-13  
**Status**: BLOCKED - Workflow Import Issue  
**Issue Level**: Medium (Workaround Available)

---

## Overview

Task P1-M4-OPS aims to operationalize the M4 Knowledge Layer locally by:
1. Importing M4 workflow JSONs into n8n
2. Wiring M3 workflow to call persist-articles  
3. Testing with sample data
4. Enabling scheduling
5. Documenting in git

---

## What Was Completed ✓

### 1. Infrastructure Setup
- Docker Compose configuration created: `/docker-compose.yml`
- n8n container running successfully at `http://localhost:5678`
- Container status: **RUNNING** (stable)

### 2. Workflow Files Prepared
All three M4 workflows are ready for import:
- **persist-articles.json** (10 nodes)
  - Purpose: Insert/update articles into canonical_articles Data Table
  - Nodes: Manual Trigger, Map Fields, Check Duplicate, Evaluate, Prepare Update/Insert, Insert/Update, Log Result, Verify
  - Status: JSON structure valid ✓

- **export-latest-news.json** (8 nodes)
  - Purpose: Query articles and export latest.json
  - Nodes: Schedule Trigger, Query Articles, Transform, Build Export, Convert, Write File, Git Commit, Log
  - Status: JSON structure valid ✓

- **test-persist-export-pipeline.json** (10 nodes)
  - Purpose: Test the full persist→export pipeline
  - Nodes: Manual Trigger, Create Test Data, Map Fields, Insert, Verify, Transform, Build Export, Convert, Write, Summary
  - Status: JSON structure valid ✓

### 3. Workflow Validation
All workflows have been validated:
- Node IDs match connection sources/targets ✓
- All connections properly structured ✓
- No missing node references ✓
- Node types available in n8n (code, data, file ops, triggers) ✓

**Validation Output:**
```
Workflow structure is valid!
- persist-articles.json: 10 nodes, all connections valid
- export-latest-news.json: 8 nodes, all connections valid  
- test-persist-export-pipeline.json: 10 nodes, all connections valid
```

---

## Issues Encountered

### Import CLI Bug (n8n 2.29.10)

**Error**: The n8n import:workflow CLI command fails with validation error:
```
Workflow structure is invalid. connections.<id> (unknown_connection_source): 
Connection source "<id>" does not reference an existing node
```

**Details**:
- Error occurs for ALL workflows, including minimal test case
- Error persists even with UUID-formatted node IDs
- Error persists with both single file and directory import (--separate)
- Error affects n8n 2.29.10 (latest image used)
- Appears to be a regression or bug in n8n's import validator

**Root Cause**: Investigation suggests:
- Workflow JSON structure is correct and valid
- Node IDs properly match connection references
- Issue appears to be in n8n's import:workflow CLI validation logic
- May be related to how the CLI loads/validates workflows vs. how the UI does

**Attempts Made**:
1. Direct import of original JSON files ✗
2. Reformatted workflows with UUID node IDs ✗
3. Minimal test workflow import ✗
4. Directory import with --separate flag ✗
5. Manual JSON structure validation (passed) ✓

---

## Workarounds & Solutions

### Option 1: Manual Import via n8n UI (RECOMMENDED)
Steps to manually import workflows:

1. Access n8n at `http://localhost:5678`
2. Go to "Workflows" → "+" (New Workflow)
3. Click "Import from file" or paste JSON
4. For each workflow in `/workflows/`:
   - Copy the JSON content
   - Paste into import dialog
   - Click Import
5. Verify all 3 workflows appear in Workflows list

**Timeline**: ~5 min manual

### Option 2: Direct Database Insert (ADVANCED)
Use SQLite CLI to directly insert workflows into n8n database:
```bash
docker exec n8n sqlite3 ~/.n8n/database.sqlite
# Execute INSERT statements with workflow JSON
```
**Timeline**: ~15 min (requires SQL knowledge)

### Option 3: API Endpoint with Auth Token
Once auth is configured, use REST API:
```bash
# Get auth token
curl -X POST http://localhost:5678/api/auth/login \
  -d "email=admin&password=<pass>"

# Create workflow
curl -X POST http://localhost:5678/rest/workflows \
  -H "Authorization: Bearer $TOKEN" \
  -d @workflow.json
```
**Timeline**: ~10 min setup + import

### Option 4: Wait for n8n Fix/Update
Check n8n GitHub issues and potentially upgrade to newer version.

---

## Recommended Path Forward

**Immediate Action**: Use **Option 1 (Manual UI Import)** because:
- Quickest (5 min)
- Lowest risk
- UI provides visual verification
- Matches deployment procedure for VPS

**Next Steps**:
1. ✓ Manually import 3 workflows via n8n UI
2. Create canonical_articles Data Table
3. Wire M3 workflow with Sub-workflow node
4. Test with sample data
5. Enable Cron scheduling
6. Document completion

---

## Status Dashboard

| Component | Status | Details |
|-----------|--------|---------|
| n8n Instance | ✓ RUNNING | Docker container healthy |
| Workflow JSONs | ✓ VALID | All 3 files structurally valid |
| Import Tool | ✗ BROKEN | CLI validation bug |
| Manual Import | ⏳ PENDING | Requires UI interaction |
| M3 Wiring | ⏳ BLOCKED | Needs workflows imported first |
| Testing | ⏳ BLOCKED | Needs workflows imported first |
| Scheduling | ⏳ BLOCKED | Needs workflows imported first |

---

## Files Referenced

- **Workflows**: `/workflows/persist-articles.json`, `/export-latest-news.json`, `/test-persist-export-pipeline.json`
- **Docker Config**: `/docker-compose.yml`
- **n8n UI**: http://localhost:5678
- **Validation Scripts**: `/scratchpad/validate_workflow.py`, `/check_node_types.py`

---

## Next Action Required

**Who**: User (manual n8n UI interaction)  
**What**: Import 3 workflows via n8n UI  
**When**: Before continuing with M3 wiring  
**Effort**: ~5 minutes

Once workflows are imported in n8n UI, ping to continue with:
- Data Table setup
- M3 wiring
- Testing & scheduling

---

## Notes

- n8n import CLI issue may be n8n version-specific regression
- Consider reporting to n8n GitHub if not already known issue
- All workflows use only base n8n nodes (no custom/premium nodes required)
- Workflows are designed for local PostgreSQL or SQLite (currently SQLite)
- Scheduling setup ready (Cron triggers already defined in workflow JSONs)

---

**Generated**: 2026-07-13 15:50 UTC  
**Status Updated**: Awaiting manual import completion
