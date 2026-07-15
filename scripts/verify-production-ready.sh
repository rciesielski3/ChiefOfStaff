#!/bin/bash
echo "=== Production Readiness Check ==="

# Check secrets
echo "Checking GitHub Actions secrets..."
gh secret list -R rciesielski3/ChiefOfStaff | grep -E "QA_NEWS_TOKEN|TELEGRAM" && echo "✅ Secrets configured" || echo "❌ Secrets missing"

# Check workflow schedule
echo "Checking workflow schedule..."
grep "0 8 \* \* \*" .github/workflows/daily-brief.yml && echo "✅ Schedule active" || echo "❌ Schedule not found"

# Check production URL
echo "Checking production website..."
curl -s https://qa-news.rciesielski.dev/ > /dev/null && echo "✅ Website accessible" || echo "❌ Website not accessible"

# Check qa-news repo
echo "Checking qa-news repository..."
curl -s https://api.github.com/repos/rciesielski3/qa-news | jq .name && echo "✅ Repo accessible" || echo "❌ Repo not accessible"

echo ""
echo "=== Status Summary ==="
echo "If all checks show ✅, production is ready!"
echo "First automated run: 2026-07-16 08:00 UTC"
