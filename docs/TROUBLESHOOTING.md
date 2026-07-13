# Troubleshooting Guide

## Common Issues

### n8n Won't Start
**Symptom:** `docker-compose up` fails or n8n container crashes

**Diagnosis:**
```bash
docker-compose logs n8n | head -50
```

**Solutions:**
- Verify Docker is running
- Check .env file is correct (N8N_ENCRYPTION_KEY set)
- Verify port 5678 not in use: `lsof -i :5678`
- Remove stale volumes: `docker volume prune`

### Workflow Fails to Execute
**Symptom:** Workflow starts but exits with error

**Diagnosis:**
```bash
docker-compose logs n8n | grep -A 10 "workflow execution"
```

**Solutions:**
- Check API keys in workflow (expired? wrong value?)
- Verify network access to external APIs
- Test credentials manually (e.g., curl to API)
- Check workflow inputs/outputs match expected schema

### Latest.json Not Updating
**Symptom:** QA News shows stale data

**Diagnosis:**
1. Check if export-latest-news ran: `docker-compose logs n8n | grep export-latest-news`
2. Verify EXPORT_FILE_PATH correct: `ls -la $(cat .env | grep EXPORT_FILE_PATH)`
3. Check git push: `cd qa-news && git log --oneline | head -5`

**Solutions:**
- Verify export workflow enabled
- Check EXPORT_FILE_PATH in .env
- Verify git credentials (ssh key, token)
- Test export manually: trigger workflow in n8n UI

### Telegram Not Receiving Messages
**Symptom:** No notifications from n8n

**Diagnosis:**
1. Verify token: `curl https://api.telegram.org/botXXX/getMe` (should return bot info)
2. Test manually: `curl -X POST https://api.telegram.org/botXXX/sendMessage -d "chat_id=YYY&text=test"`
3. Check workflow: `docker-compose logs n8n | grep telegram`

**Solutions:**
- Verify TELEGRAM_BOT_TOKEN in .env (not expired)
- Verify TELEGRAM_CHAT_ID correct (get from bot: /start, note group/channel ID)
- Check Telegram rate limits (max ~30 msg/sec per bot)
- Verify network allows outbound HTTPS

### Vault Git Sync Failing
**Symptom:** Vault commits not pushing, git errors in logs

**Diagnosis:**
```bash
cd paios-vault && git status
git log --oneline -5
git remote -v
```

**Solutions:**
- Verify git credentials (ssh key, PAT)
- Check git remote URL correct
- Manual sync: `git pull --rebase && git push`
- Verify network access to GitHub

---

## Performance Issues

### High Memory Usage
```bash
docker stats
```
If n8n > 1GB: Check for large data transfers, long-running workflows

**Solutions:**
- Restart n8n: `docker-compose restart n8n`
- Optimize workflow (reduce data processing)
- Increase Docker memory limit

### Slow Workflow Execution
Check external API latency: time individual API calls in workflow

**Solutions:**
- Add retry logic with backoff
- Parallelize independent steps
- Cache results when possible
