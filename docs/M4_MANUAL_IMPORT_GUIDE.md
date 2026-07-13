# M4 Workflows - Manual Import Guide

**Quick Start**: If n8n import CLI fails, use this manual UI method (5 minutes)

---

## Prerequisites

- n8n running locally: http://localhost:5678
- All workflow JSON files present in `/workflows/` directory
- Browser with access to localhost

---

## Import Steps

### Step 1: Open n8n Workflows Panel

1. Visit http://localhost:5678 in your browser
2. Click on **"Workflows"** in the left sidebar
3. You should see an empty workflows list (or existing workflows)

### Step 2: Import First Workflow (persist-articles.json)

1. Click **"+"** button (top right, or "+ New Workflow")
2. Look for **"Import"** option or similar
3. Select **"Upload JSON"** or **"Import from file"**
4. Browse to: `/workflows/persist-articles.json`
5. Click **Import** or **Open**
6. Verify:
   - Workflow name: "Persist Articles to Knowledge Layer"
   - Nodes: ~10 nodes visible
   - Click **Save** or **Done**

### Step 3: Import Second Workflow (export-latest-news.json)

1. Click **"+"** again for new workflow
2. Select **"Import"** → **"Upload JSON"**
3. Browse to: `/workflows/export-latest-news.json`
4. Import and save
5. Verify:
   - Workflow name: "Export Latest News"
   - Nodes: ~8 nodes visible

### Step 4: Import Third Workflow (test-persist-export-pipeline.json)

1. Click **"+"** for new workflow
2. Select **"Import"** → **"Upload JSON"**
3. Browse to: `/workflows/test-persist-export-pipeline.json`
4. Import and save
5. Verify:
   - Workflow name: "Test Persist-Export Pipeline"
   - Nodes: ~10 nodes visible

### Step 5: Verify All Workflows

After importing all three:

1. In Workflows list, you should see:
   - ✓ Persist Articles to Knowledge Layer
   - ✓ Export Latest News
   - ✓ Test Persist-Export Pipeline

2. Click each to verify it opens correctly
3. Check that nodes and connections are intact

---

## If Import Dialog Not Visible

**Alternative Method:**

1. In Workflows list, look for **"Open in new tab"** option
2. Or look for **"File"** menu → **"Import"**
3. Or click on workflow name → **"Settings"** → **"Import"**

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No import button visible | Look for "..." menu or "Settings" dropdown |
| File upload doesn't work | Copy/paste JSON directly into editor |
| Nodes not showing after import | Refresh browser (Cmd+R / Ctrl+F5) |
| Workflow appears empty | Check browser console for errors, try re-importing |

---

## Creating Data Table (If Needed)

Before running workflows, create the `canonical_articles` Data Table:

1. Click **"Data"** in left sidebar (or top menu)
2. Click **"+ Create"** or **"Create new Table"**
3. Name: `canonical_articles`
4. Add fields (in order):
   - `id`: String (Primary Key, Unique)
   - `title`: String
   - `summary`: String (Long Text)
   - `url`: String
   - `source`: String
   - `category`: String
   - `publishedAt`: DateTime
   - `tags`: String
   - `addedAt`: DateTime
   - `score`: Number
   - `seenCount`: Integer
   - `dedupKey`: String (Unique)
5. Click **Create**

---

## Next Steps After Import

1. ✓ All workflows imported
2. Wire M3 (Daily Brief) to call persist-articles workflow
3. Test with sample data (use test-persist-export-pipeline)
4. Enable scheduling (Cron triggers)
5. Document completion

---

## Questions?

If workflows don't import or show errors:
1. Check n8n logs: `docker compose logs n8n`
2. Verify JSON files aren't corrupted: `cat /workflows/*.json | head`
3. Try a different workflow file first
4. Restart n8n: `docker compose restart n8n`
