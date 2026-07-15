# Production Setup — Final Configuration Steps

**Status:** Code ready ✅ | Automation configured ✅ | **Awaiting: Secrets configuration** ⏳

---

## What You Need to Do (5 minutes)

### Step 1: Create GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens/new
2. **Token name:** `qa-news-deploy` (or your preference)
3. **Expiration:** 90 days (or No expiration for permanent)
4. **Scopes required:** Check `repo` (full control of private repositories)
5. Click **Generate token**
6. **Copy the token immediately** (you won't see it again)

### Step 2: Configure GitHub Actions Secrets

Go to: https://github.com/rciesielski3/ChiefOfStaff/settings/secrets/actions

**Add three secrets:**

| Secret Name | Value | Source |
|-------------|-------|--------|
| `QA_NEWS_TOKEN` | Your Personal Access Token from Step 1 | Paste the token you just created |
| `TELEGRAM_BOT_TOKEN` | From .env line 36 | `123456789:ABCDefGhIjKlMnOpQrStUvWxYzAbCdEf` |
| `TELEGRAM_CHAT_ID` | From .env line 37 | `987654321` |

**To add each secret:**
1. Click **New repository secret**
2. **Name:** (e.g., `QA_NEWS_TOKEN`)
3. **Value:** Paste the secret value
4. Click **Add secret**
5. Repeat for all 3 secrets

### Step 3: Verify Secrets Are Configured

Run this command to check:
```bash
gh secret list -R rciesielski3/ChiefOfStaff
```

Expected output:
```
QA_NEWS_TOKEN  Updated 2026-07-15
TELEGRAM_BOT_TOKEN  Updated 2026-07-15
TELEGRAM_CHAT_ID  Updated 2026-07-15
```

### Step 4: Test Production Pipeline (Optional)

Once secrets are configured, you can test manually:
```bash
# Trigger daily-brief workflow
gh workflow run daily-brief.yml -R rciesielski3/ChiefOfStaff

# Wait ~2-3 minutes
# Then check production website
curl https://qa-news.rciesielski.dev/ | grep -i article
```

Or visit https://qa-news.rciesielski.dev/ in your browser.

---

## What Happens After Secrets Are Configured

**Automatic (no action needed):**
- ✅ 2026-07-16 08:00 UTC: First scheduled run of daily-brief
- ✅ Articles automatically fetched from RSS feeds
- ✅ Articles exported to qa-news repo
- ✅ Vercel deploys to production
- ✅ https://qa-news.rciesielski.dev/ shows real articles

**Daily at 08:00 UTC, every day:**
- Fresh articles fetched and published automatically
- Zero manual intervention required

---

## Troubleshooting

**If workflow fails:**
1. Check GitHub Actions: https://github.com/rciesielski3/ChiefOfStaff/actions
2. Click on failed workflow
3. Check logs for error message
4. Common issues:
   - `QA_NEWS_TOKEN` invalid → Re-generate token in GitHub settings
   - `TELEGRAM_BOT_TOKEN` invalid → Update with correct value from .env
   - Auto-merge not enabled → Enable in GitHub repo settings (optional)

**If website doesn't update:**
1. Check qa-news repo: https://github.com/rciesielski3/qa-news/commits/main
2. Check if `public/latest.json` was updated recently
3. Check Vercel deployments: https://vercel.com

---

## Status

- **Code deployed:** ✅ (all tasks complete)
- **Automation ready:** ✅ (schedule configured, monitoring active)
- **Secrets needed:** ⏳ **You are here** — configure 3 secrets in GitHub Actions
- **Production live:** ⏳ (happens after secrets configured)

**Estimated time to production:** 5 minutes (just adding secrets) + automated start at 08:00 UTC tomorrow
