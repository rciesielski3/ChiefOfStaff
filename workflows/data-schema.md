# Knowledge Layer Data Schema

## Overview

The PAIOS Knowledge Layer is the canonical repository of all discovered, curated, and deduplicated articles across source feeds (GitHub, Reddit, Dev.to, HackerNews, etc.).

This document defines the schema for the primary data table: `canonical_articles`. This table is the single source of truth for article metadata, scores, and deduplication tracking.

---

## Data Table: `canonical_articles`

### Purpose
Store all articles in the Knowledge Layer with full metadata, relevance scores, and deduplication tracking.

### Fields

| Field Name | Type | Required | Description |
|---|---|---|---|
| `id` | String | Yes | Unique identifier for each article (primary key). Format: UUID or `source-{hash}` |
| `title` | String | Yes | Article title (display text, not normalized) |
| `summary` | String (Long Text) | Yes | Article summary or excerpt (plaintext, up to 1000 chars recommended) |
| `url` | String | Yes | Full URL to the original article |
| `source` | String | Yes | Origin platform: `GitHub`, `Reddit`, `Dev.to`, `HackerNews`, etc. |
| `category` | String (Enum) | Yes | Content category: `test-automation`, `ai`, `engineering`, `qa-practice`, `tooling` |
| `publishedAt` | DateTime | Yes | Article publication date (ISO 8601 format, UTC) |
| `tags` | Array/String | No | Structured tags or comma-separated tag list (e.g., `"Python,Testing,CI/CD"`) |
| `addedAt` | DateTime | Yes | Timestamp when article was added to Knowledge Layer (ISO 8601 format, UTC) |
| `score` | Number (0-100) | Yes | Relevance score assigned by pipeline (0 = low relevance, 100 = high relevance) |
| `seenCount` | Integer | No | Deduplication counter: how many times this article was seen across sources (default: 1) |
| `dedupKey` | String | Yes | Deduplication key: `${source}\|${normalizeTitle(title)}` (e.g., `GitHub\|how-to-write-better-tests`) |

---

## Data Types & Constraints

### `id` (String, Primary Key)
- **Uniqueness**: Must be unique per article
- **Format**: UUIDs are recommended; alternatively `{source}-{hash}` where hash is deterministic
- **Indexed**: Yes (primary key)

### `title` (String)
- **Max Length**: 500 characters
- **Normalization**: Stored as-is; *not* normalized
- **Indexed**: Yes (for search/display)

### `summary` (String, Long Text)
- **Max Length**: 2000 characters
- **Format**: Plaintext (no HTML/Markdown)
- **Purpose**: Snippet for display in frontends

### `url` (String)
- **Format**: Valid HTTPS URL
- **Indexed**: Yes (for dedup checks, duplicate detection)
- **Validation**: Must start with `https://` or `http://`

### `source` (String)
- **Enum Values**: `GitHub`, `Reddit`, `Dev.to`, `HackerNews`, `Twitter`, `Lobsters`, `CSS-Tricks`, `Medium`, `Newsletter`, `Blog`, `Other`
- **Case Sensitivity**: Match exactly as listed
- **Indexed**: Yes

### `category` (String, Enum)
- **Allowed Values**: 
  - `test-automation` — Test frameworks, automation best practices
  - `ai` — AI/LLM tools, prompt engineering, RAG
  - `engineering` — Architecture, deployment, performance
  - `qa-practice` — QA processes, testing strategies, team practices
  - `tooling` — Tools, scripts, utilities
- **Indexed**: Yes (for faceted browsing)

### `publishedAt` (DateTime)
- **Format**: ISO 8601 UTC (e.g., `2024-07-13T09:30:00Z`)
- **Timezone**: Always UTC
- **Indexed**: Yes (for recency sorting)

### `tags` (Array / String)
- **Format**: Either a true array `["tag1", "tag2"]` or comma-separated string `"tag1,tag2"`
- **Purpose**: Free-form keywords for search/navigation
- **Optional**: Can be empty

### `addedAt` (DateTime)
- **Format**: ISO 8601 UTC (e.g., `2024-07-13T09:30:00Z`)
- **Timezone**: Always UTC
- **Default**: Current timestamp when record is inserted
- **Indexed**: Yes (for "newly added" feeds)

### `score` (Number, 0–100)
- **Range**: 0 to 100 (floating-point)
- **Meaning**:
  - 0–20: Low relevance (noise, off-topic)
  - 21–50: Moderate relevance (useful context)
  - 51–80: High relevance (directly applicable)
  - 81–100: Critical relevance (must-read)
- **Assignment**: Determined by pipeline heuristics (keyword match, engagement, source weight)
- **Indexed**: Yes (for relevance ranking)

### `seenCount` (Integer)
- **Range**: 1 to N
- **Meaning**: How many times this article appeared across different sources or ingestion runs
- **Default**: 1 (first time seen)
- **Purpose**: Signal of cross-platform importance; incremented during dedup merge

### `dedupKey` (String)
- **Format**: `${source}|${normalizeTitle(title)}`
- **Example**: `GitHub|how-to-write-better-tests`
- **Normalization Function** (`normalizeTitle`):
  ```
  1. Convert to lowercase
  2. Remove leading/trailing whitespace
  3. Replace non-alphanumeric chars (except hyphens) with hyphens
  4. Collapse consecutive hyphens to single hyphen
  5. Remove trailing hyphens
  ```
- **Purpose**: Unique per (source, title) pair; used to detect duplicate ingestion
- **Indexed**: Yes (unique constraint to prevent re-insert)

---

## Indexing Strategy

**Primary Indexes**:
- `id` (primary key)
- `dedupKey` (unique, prevent duplicates)

**Secondary Indexes** (for query performance):
- `source` (filter by platform)
- `category` (faceted browsing)
- `publishedAt` (sort by date)
- `addedAt` (sort by recency in Knowledge Layer)
- `score` (sort by relevance)
- `url` (find by original link)

---

## Example Record

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "How to Write Better Tests for Your CI/CD Pipeline",
  "summary": "A comprehensive guide to testing practices in continuous integration. Covers unit tests, integration tests, and end-to-end testing strategies.",
  "url": "https://dev.to/example/how-to-write-better-tests",
  "source": "Dev.to",
  "category": "test-automation",
  "publishedAt": "2024-07-12T14:30:00Z",
  "tags": "Python,Testing,CI/CD,GitHub Actions",
  "addedAt": "2024-07-13T09:15:00Z",
  "score": 87,
  "seenCount": 2,
  "dedupKey": "Dev.to|how-to-write-better-tests-for-your-ci-cd-pipeline"
}
```

---

## Usage Notes

### Insertion Workflow
1. **Fetch** article metadata from source feed (RSS, API, scraper)
2. **Normalize** title using `normalizeTitle()` 
3. **Compute** `dedupKey = ${source}|${dedupKey(title)}`
4. **Check** if `dedupKey` exists in `canonical_articles`
   - If yes: increment `seenCount`, update `publishedAt` if newer
   - If no: insert new record with `seenCount = 1`
5. **Score** using pipeline heuristics (keyword match, engagement, source weight)

### Query Patterns
- **Find by URL**: `WHERE url = ?`
- **Find by dedup**: `WHERE dedupKey = ?`
- **Latest by source**: `WHERE source = ? ORDER BY publishedAt DESC LIMIT 10`
- **Top by score**: `WHERE category = ? ORDER BY score DESC LIMIT 20`
- **Recently added**: `ORDER BY addedAt DESC LIMIT 10`

---

## Version History

- **v1.0** (2024-07-13): Initial schema for Knowledge Layer
  - Baseline fields for article metadata
  - Deduplication via `dedupKey`
  - Relevance scoring (0–100)
  - Source and category tracking
