# QA-News Empty Tabs Fix

> **For agentic workers:** Execute all 4 tasks as specified.

**Goal:** Fix QA-News showing empty tabs when articles haven't been freshly fetched by syncing export CLI outputs to build-time data directories.

**Root Cause:** Export CLIs write to `qa-news/public/` (static site publication) but QA-News build reads from `qa-news/data/` at build time. Since `qa-news/data/` is not updated by export flow, the next build reads stale or missing files.

**Architecture:** Update all 3 export CLIs (latest, weekly, monthly) to write to both directories with matching content and filenames, ensuring build-time data loading finds current exports.

**Tech Stack:** TypeScript, Node.js, fs/promises, atomic file writing

---

## Global Constraints

- TypeScript strict mode enforced
- All tests passing before commit
- No external dependencies beyond `package.json`
- Commits prefixed `fix:` (no AI co-author)

---

## File Structure

| File | Purpose | Change Type |
|------|---------|------------|
| `src/cli/export-latest-news.ts` | Add dual-write to public + data | Modify |
| `src/cli/export-weekly-highlights.ts` | Add dual-write to public + data | Modify |
| `src/cli/export-monthly-recap.ts` | Add dual-write to public + data | Modify |
| `qa-news/data/latest-news.json` | Build-time input (synced from export) | Create |
| `qa-news/data/weekly-highlights.json` | Build-time input (synced from export) | Create |
| `qa-news/data/monthly-recap.json` | Build-time input (synced from export) | Create |

---

## Tasks

### Task 1: Update export-latest-news to dual-write

**Files:**
- Modify: `src/cli/export-latest-news.ts`
- Test: Manual CLI execution

**Interfaces:**
- Consumes: 50 articles from ArticleStore
- Produces: `qa-news/public/latest.json` AND `qa-news/data/latest-news.json` (identical content)

- [ ] **Step 1: Read current export-latest-news.ts**

Understanding the existing structure.

- [ ] **Step 2: Add writeToDataDirs helper function**

After imports (line ~6), add:

```typescript
async function writeToDataDirs(
  data: ArticleWithMetadata[],
  publicFile: string,
  dataFile: string
): Promise<void> {
  const publicDir = path.dirname(publicFile);
  const dataDir = path.dirname(dataFile);
  
  await fs.promises.mkdir(publicDir, { recursive: true });
  await fs.promises.mkdir(dataDir, { recursive: true });
  
  const content = JSON.stringify(data, null, 2);
  
  await fs.promises.writeFile(publicFile, content, 'utf-8');
  await fs.promises.writeFile(dataFile, content, 'utf-8');
}
```

- [ ] **Step 3: Update main() to use dual-write**

Replace the existing `await fs.promises.mkdir` and `await fs.promises.writeFile` logic with:

```typescript
await writeToDataDirs(
  articlesWithMetadata,
  path.join('qa-news', 'public', 'latest.json'),
  path.join('qa-news', 'data', 'latest-news.json')
);
```

- [ ] **Step 4: Update logging**

Update the WORKFLOW_COMPLETE log to show both output paths.

- [ ] **Step 5: Test the CLI**

```bash
npx ts-node src/cli/export-latest-news.ts
```

Verify both files exist:
- `qa-news/public/latest.json` 
- `qa-news/data/latest-news.json`

Verify both contain identical content.

- [ ] **Step 6: Commit**

```bash
git add src/cli/export-latest-news.ts
git commit -m "fix: write latest-news export to both public and data directories"
```

---

### Task 2: Update export-weekly-highlights to dual-write

**Files:**
- Modify: `src/cli/export-weekly-highlights.ts`
- Test: Manual CLI execution

**Interfaces:**
- Consumes: Weekly highlights from ArticleStore
- Produces: `qa-news/public/weekly.json` AND `qa-news/data/weekly-highlights.json` (identical content)

- [ ] **Step 1: Add same writeToDataDirs helper function**

(Identical to Task 1)

- [ ] **Step 2: Update main() to use dual-write**

Replace existing write logic with:

```typescript
await writeToDataDirs(
  weeksWithArticles,
  path.join('qa-news', 'public', 'weekly.json'),
  path.join('qa-news', 'data', 'weekly-highlights.json')
);
```

- [ ] **Step 3: Test the CLI**

```bash
npx ts-node src/cli/export-weekly-highlights.ts
```

Verify both files exist and have identical content.

- [ ] **Step 4: Commit**

```bash
git add src/cli/export-weekly-highlights.ts
git commit -m "fix: write weekly-highlights export to both public and data directories"
```

---

### Task 3: Update export-monthly-recap to dual-write

**Files:**
- Modify: `src/cli/export-monthly-recap.ts`
- Test: Manual CLI execution

**Interfaces:**
- Consumes: Monthly recap from ArticleStore
- Produces: `qa-news/public/monthly.json` AND `qa-news/data/monthly-recap.json` (identical content)

- [ ] **Step 1: Add same writeToDataDirs helper function**

(Identical to Tasks 1-2)

- [ ] **Step 2: Update main() to use dual-write**

Replace existing write logic with:

```typescript
await writeToDataDirs(
  monthsWithArticles,
  path.join('qa-news', 'public', 'monthly.json'),
  path.join('qa-news', 'data', 'monthly-recap.json')
);
```

- [ ] **Step 3: Test the CLI**

```bash
npx ts-node src/cli/export-monthly-recap.ts
```

Verify both files exist and have identical content.

- [ ] **Step 4: Commit**

```bash
git add src/cli/export-monthly-recap.ts
git commit -m "fix: write monthly-recap export to both public and data directories"
```

---

### Task 4: Verify QA-News build with synced data

**Files:**
- Modify: None (verification only)
- Test: Build-time integration

**Interfaces:**
- Consumes: qa-news/data/* files (written by Tasks 1-3)
- Produces: QA-News static export with content rendered

- [ ] **Step 1: Clean QA-News build artifacts**

```bash
cd qa-news && npm run clean && cd ..
```

- [ ] **Step 2: Run all 3 export CLIs to populate data directories**

```bash
npx ts-node src/cli/export-latest-news.ts
npx ts-node src/cli/export-weekly-highlights.ts
npx ts-node src/cli/export-monthly-recap.ts
```

Verify all 3 data files exist in `qa-news/data/`:
- `latest-news.json`
- `weekly-highlights.json`
- `monthly-recap.json`

- [ ] **Step 3: Rebuild QA-News**

```bash
cd qa-news && npm run build && cd ..
```

Verify build succeeds without errors.

- [ ] **Step 4: Verify content is rendered**

Check the generated index.html contains article content:
- Search HTML for "Latest News"
- Search HTML for article titles
- Verify no empty tabs or placeholder text

- [ ] **Step 5: Report results**

Document build success, verify pages contain expected content, confirm fix works.

---

## Summary

**Total: 4 Tasks**

1. ✅ Update export-latest-news to dual-write
2. ✅ Update export-weekly-highlights to dual-write
3. ✅ Update export-monthly-recap to dual-write
4. ⏳ Verify QA-News build with synced data

**Expected Outcome:** All export CLIs write to both directories, QA-News build reads from `qa-news/data/`, and pages render with content instead of empty tabs.

**Test:** After merging, empty tabs should no longer appear unless articles are truly missing (intentional behavior).
