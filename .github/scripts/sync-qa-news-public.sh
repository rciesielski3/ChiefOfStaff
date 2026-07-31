#!/bin/bash
set -e

# Sync QA-News exports to public directory for deployment
# This script is run after export-latest-news, export-weekly-highlights, export-monthly-recap
# in the export-qa-news workflow to make exported data available for GitHub Pages deployment

echo "📤 Syncing QA-News exports to public directory..."

# Check if data files exist
if [ ! -f "qa-news/data/latest-news.json" ]; then
  echo "❌ Error: qa-news/data/latest-news.json not found"
  exit 1
fi

# Create public directory if it doesn't exist
mkdir -p qa-news/public

# Sync latest news to public/latest.json
# The export-latest-news produces { date, updatedAt, items: Article[] }
# But the app expects { date, updatedAt, articles: QANewsArticle[] }
# This script transforms the format

echo "Converting export format to app format..."

# Read the latest-news.json and transform items -> articles
jq '{date, updatedAt, articles: [.items[] | {id, title, summary: (.summary // ""), url, source, category: "engineering", publishedAt, tags: (.tags // []), priority: "MEDIUM", reason: (.tags // []), score: 50}]}' qa-news/data/latest-news.json > qa-news/public/latest.json

echo "✅ Synced to qa-news/public/latest.json"

# Sync weekly highlights
if [ -f "qa-news/data/weekly-highlights.json" ]; then
  cp qa-news/data/weekly-highlights.json qa-news/public/weekly-highlights.json
  echo "✅ Synced to qa-news/public/weekly-highlights.json"
fi

# Sync monthly recap
if [ -f "qa-news/data/monthly-recap.json" ]; then
  cp qa-news/data/monthly-recap.json qa-news/public/monthly-recap.json
  echo "✅ Synced to qa-news/public/monthly-recap.json"
fi

echo "📤 Sync complete"
