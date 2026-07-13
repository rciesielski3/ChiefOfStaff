# Operations Guide

## Daily Operations

### Morning Checklist (09:00 UTC)
- [ ] Check n8n: Any workflow errors overnight?
  ```bash
  docker-compose logs --since 1h n8n | grep -i error
  ```
- [ ] Verify Telegram: Did daily brief arrive by 08:00?
- [ ] Spot-check vault: Latest brief file exists?
  ```bash
  ls -la paios-vault/daily/ | tail -5
  ```

### Weekly Operations

- [ ] Review workflow execution logs
- [ ] Check disk usage (backups growing?)
  ```bash
  du -sh ~/paios-vault ~/paios
  ```
- [ ] Manual restore test (optional, on test data)
- [ ] Review any workflow errors, update if needed

### Monthly Operations

- [ ] Full system health check (see TROUBLESHOOTING.md)
- [ ] Review costs (OVH, API services)
- [ ] Backup audit (Restic snapshots, size, retention)

---

## Monitoring

### Logs to Watch

**n8n:**
```bash
docker-compose logs -f n8n
```
Look for: Workflow failures, API errors, timeout warnings

**Vault:**
```bash
cd paios-vault && git log --oneline | head -20
```
Look for: Daily commits, no gaps > 24h

**System:**
```bash
docker-compose ps
```
Look for: All containers running, no restarts

### Health Checks

- **n8n API:** `curl http://localhost:5678/api/v1/audit/logs` (verify response)
- **Workflows:** Manual trigger of persist-articles → check data insertion
- **Export:** Verify latest.json timestamp matches current date

---

## Incident Response

### Workflow Failed
1. Check logs: `docker-compose logs n8n`
2. Identify error (API key expired? Missing field?)
3. Fix and re-run
4. Verify success before leaving

### Backup Not Running
1. Check Restic status: `restic snapshots`
2. Verify credentials (.env)
3. Run manual backup: `restic backup ~/paios-vault`
4. Schedule check: cron or n8n trigger status

### Telegram Not Sending
1. Verify token in .env (not expired)
2. Test: `curl -X POST https://api.telegram.org/botXXX/sendMessage -d "chat_id=XXX&text=test"`
3. Check network access (firewall, proxy)
4. Verify Telegram API limits (not rate-limited)

### Vault Git Sync Issues
1. Check git status: `cd paios-vault && git status`
2. Fix conflicts: `git pull --rebase` (or manual merge)
3. Commit and push: `git add . && git commit -m "fix: sync" && git push`
4. Verify: `git log --oneline | head -5`
