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
