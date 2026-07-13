# Setup Instructions: Knowledge Layer Data Table

## Overview

This document provides step-by-step instructions to set up the `canonical_articles` Data Table in n8n and execute the test workflow.

---

## Prerequisites

- n8n instance running (assumed at `http://localhost:3333`)
- Admin access to n8n UI
- `test-canonical-articles-insert.json` workflow file available for import

---

## Step 1: Access n8n and Create the Data Table

### 1.1 Open n8n UI

Navigate to: `http://localhost:3333`

### 1.2 Create a New Data Table

1. In the n8n UI, click on **Data** in the left sidebar (or top navigation)
2. Click **+ Create** or **Create new Table**
3. Name the table exactly: `canonical_articles`
4. Click **Create**

### 1.3 Add Fields to the Data Table

Add each field below with the specified type and settings:

| # | Field Name | Type | Settings |
|---|---|---|---|
| 1 | `id` | String | Primary Key ✓, Unique ✓ |
| 2 | `title` | String | Max: 500 chars |
| 3 | `summary` | String (Long Text) | Max: 2000 chars |
| 4 | `url` | String | - |
| 5 | `source` | String | - |
| 6 | `category` | String | - |
| 7 | `publishedAt` | DateTime | ISO format (UTC) |
| 8 | `tags` | String | - |
| 9 | `addedAt` | DateTime | ISO format (UTC) |
| 10 | `score` | Number | Range: 0-100 |
| 11 | `seenCount` | Integer | Default: 1 |
| 12 | `dedupKey` | String | Unique ✓ |

### 1.4 Verify Data Table Creation

1. Navigate to **Data** section
2. You should see `canonical_articles` table listed
3. Click on it to view the schema
4. Confirm all 12 fields are present with correct types

---

## Step 2: Import and Configure the Test Workflow

### 2.1 Import the Test Workflow

1. In n8n UI, go to **Workflows** section
2. Click **+ New** or **Import**
3. Upload `test-canonical-articles-insert.json`
4. Name it: `Test: Insert Sample Article into canonical_articles`
5. Click **Import**

### 2.2 Update the Workflow (if needed)

If the workflow nodes show warnings about missing Data Table:

1. Open the workflow editor
2. Find the node: **"Upsert to canonical_articles"**
3. In the node settings:
   - Ensure **Resource** is set to `Data`
   - Ensure **Data Table** is set to `canonical_articles`
   - Verify all column mappings are correct
4. Do the same for **"Verify Insert (Last 10 Articles)"** node

---

## Step 3: Execute the Test Workflow

### 3.1 Activate and Run

1. Open the test workflow
2. Click **Activate** (or **Save & Activate**)
3. Click the **Execute Workflow** button (play icon)
4. Or click **Test** in the editor

### 3.2 Verify the Result

1. Check the workflow execution log for success (no red errors)
2. The final node **"Verify Insert (Last 10 Articles)"** should output a list of records
3. You should see your test article in the output with fields like:
   - `title`: "How to Write Better Tests for Your CI/CD Pipeline"
   - `source`: "Dev.to"
   - `category`: "test-automation"
   - `score`: 87

### 3.3 Verify in Data Table UI

1. Navigate to **Data** → **canonical_articles**
2. You should see the inserted article as a row in the table
3. All 12 fields should be populated with correct values

---

## Step 4: Verify Data Integrity

### Expected Data in Table

After successful execution, you should see one row with:

```
id:        test-article-001
title:     How to Write Better Tests for Your CI/CD Pipeline
summary:   A comprehensive guide to testing practices...
url:       https://dev.to/example/how-to-write-better-tests
source:    Dev.to
category:  test-automation
publishedAt: 2024-07-12T14:30:00.000Z
tags:      Python,Testing,CI/CD,GitHub Actions
addedAt:   [current timestamp]
score:     87
seenCount: 1
dedupKey:  Dev.to|how-to-write-better-tests-for-your-ci-cd-pipeline
```

---

## Step 5: Next Steps

Once the data table and test workflow are verified:

1. **Create insert workflow** from various sources (GitHub, Reddit, Dev.to, HackerNews)
2. **Implement deduplication logic** using `dedupKey` to prevent duplicate inserts
3. **Add scoring pipeline** to calculate relevance scores
4. **Wire public API** to serve canonical_articles data to qa-news frontend

---

## Troubleshooting

### Issue: "Data Table 'canonical_articles' not found"

**Solution:**
- Verify data table exists in **Data** section
- Ensure exact name match: `canonical_articles` (lowercase)
- Recreate if necessary

### Issue: Workflow fails on Upsert node

**Solution:**
- Check that all columns in the node match field names exactly
- Verify the data table has all 12 fields
- Check that data types match (e.g., `score` must be Number, not String)

### Issue: DateTime fields show as null or invalid

**Solution:**
- Ensure dates are in ISO 8601 format: `YYYY-MM-DDTHH:mm:ss.sssZ`
- Verify timezone is UTC (Z suffix)
- Use n8n expressions like `new Date().toISOString()`

---

## File References

- **Schema Documentation**: `workflows/data-schema.md`
- **Test Workflow JSON**: `workflows/test-canonical-articles-insert.json`
- **Setup Instructions** (this file): `workflows/SETUP-INSTRUCTIONS.md`

---

## Success Criteria

✓ Data table `canonical_articles` exists in n8n  
✓ All 12 fields are present with correct types  
✓ Test workflow can be imported without errors  
✓ Test workflow executes successfully (manual trigger)  
✓ Sample article is inserted and visible in Data table UI  
✓ All schema constraints are enforced (primary key, unique, etc.)
