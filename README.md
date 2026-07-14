# ChiefOfStaff

Automated intelligence aggregation and synthesis pipeline. Fetches RSS feeds, generates AI-summarized daily briefs, and exports curated articles to a knowledge base.

## Architecture

**M3 (Daily Brief)** — Fetches RSS feeds, normalizes articles, generates daily summaries via Claude API, persists to canonical article store.

**M4 (Knowledge Layer)** — Exports top articles from the store, validates data integrity, writes to JSON for downstream consumption.

**CI/CD** — GitHub Actions workflows orchestrate M3→M4 pipeline on schedule (08:00 & 08:05 UTC daily).

## Quick Start

```bash
# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, CLAUDE_API_KEY)

# Run tests
npm test

# Run Daily Brief CLI (M3)
npx ts-node src/cli/daily-brief.ts

# Run Export Latest News CLI (M4)
npx ts-node src/cli/export-latest-news.ts
```

## Features

- **Retry Logic** — Exponential backoff for transient RSS feed failures
- **Error Handling** — Structured logging, fail-fast on critical errors
- **Data Persistence** — NDJSON-based article store with deduplication
- **Validation** — Empty store detection, malformed data resilience
- **Monitoring** — ISO-8601 timestamps and structured logs for observability

## Project Structure

```
src/
  business-logic/     # Core logic (RSS fetch, article processing, export)
  cli/                # CLI entry points (daily-brief, export-latest-news)
tests/                # Jest test suites (157 tests)
.github/workflows/    # GitHub Actions CI/CD
data/                 # Article storage (canonical_articles.ndjson)
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot for daily brief delivery |
| `TELEGRAM_CHAT_ID` | Telegram chat destination |
| `CLAUDE_API_KEY` | Claude API for article summarization |
| `PAIOS_VAULT_PATH` | Path to Obsidian vault (optional) |

## Testing

```bash
npm test              # Run all tests (157 test cases)
npx tsc --noEmit      # Type checking
```

## Deployment

Workflows run automatically via GitHub Actions:
- `daily-brief.yml` — Executes M3 at 08:00 UTC
- `export-latest-news.yml` — Executes M4 at 08:05 UTC

All output is committed to the repository for version control.

## License

Internal project.
