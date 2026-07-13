# VPS Migration Checklist

**Status:** Production Ready  
**Version:** 1.0  
**Last Updated:** 2026-07-13  
**Duration Estimate:** 2-4 hours for full migration  

This is a practical checklist for executing the VPS migration. Use it alongside VPS_MIGRATION_PLAN.md for detailed instructions.

---

## Pre-Migration Phase (Local Environment)

### Workflow Verification
- [ ] All M1-M4 workflows imported to local n8n
- [ ] M3 (Daily Brief) runs successfully at scheduled time
- [ ] M4 (persist-articles) stores articles to canonical_articles
- [ ] M4 (export-latest-news) generates latest.json with current date
- [ ] Telegram notifications delivering to chat
- [ ] Vault commits syncing to GitHub (git log shows recent commits)
- [ ] No ERROR lines in docker logs: `docker-compose logs n8n`

### Secrets & Credentials Audit
- [ ] Telegram bot token active (last used today or verified in Telegram)
- [ ] GitHub SSH key working: `git -C paios-vault pull` succeeds
- [ ] All API keys in .env file are current (not expired)
- [ ] Cloudflare API token valid (if using API)
- [ ] OVH object storage credentials obtained and tested

### Infrastructure Prerequisites
- [ ] OVH VPS ordered, deployed, and running
- [ ] VPS SSH access verified with root credentials
- [ ] OVH Object Storage bucket created (for Restic backups)
- [ ] S3 access credentials obtained from OVH
- [ ] Cloudflare account owns domain
- [ ] Cloudflare DNS zone configured and active

### Local Backup
- [ ] Full backup of Docker volumes created
  ```bash
  mkdir -p ~/backups/paios-pre-migration
  docker-compose down
  tar -czf ~/backups/paios-pre-migration/volumes-$(date +%s).tar.gz volumes/
  ```
- [ ] Database dump created (if using PostgreSQL)
  ```bash
  docker exec paios-postgres pg_dump -U n8n n8n > ~/backups/paios-pre-migration/database-$(date +%s).sql
  ```
- [ ] Backup files stored in secure location with timestamp
- [ ] Backup integrity verified (can extract archive successfully)

---

## VPS Initial Setup Phase

### SSH & Security
- [ ] Connected to VPS via SSH with root credentials
- [ ] Non-root user 'paios' created
- [ ] SSH public key copied to `/home/paios/.ssh/authorized_keys`
- [ ] SSH key permissions correct: `chmod 700 ~/.ssh && chmod 600 ~/.ssh/*`
- [ ] Root login disabled in `/etc/ssh/sshd_config`
- [ ] SSH service restarted after config change
- [ ] SSH login as paios user verified (no password required)

### System Configuration
- [ ] System updated: `apt-get update && apt-get upgrade -y`
- [ ] Essential utilities installed: curl, wget, git, vim, htop
- [ ] Firewall (UFW) installed and enabled
- [ ] SSH (port 22) allowed through firewall
- [ ] HTTP (port 80) allowed through firewall
- [ ] HTTPS (port 443) allowed through firewall
- [ ] fail2ban installed and running
- [ ] Firewall status verified: `ufw status`

### Docker Installation
- [ ] Docker installed from official repository
- [ ] Docker daemon running: `docker ps` succeeds
- [ ] paios user added to docker group: `usermod -aG docker paios`
- [ ] Docker permission working (no sudo required): `docker ps`
- [ ] Docker version confirmed: `docker --version`
- [ ] Hello World container runs: `docker run hello-world`

### Docker Compose Installation
- [ ] Docker Compose v2 installed to `/usr/local/bin/docker-compose`
- [ ] Docker Compose executable: `chmod +x /usr/local/bin/docker-compose`
- [ ] Docker Compose version confirmed: `docker-compose --version`
- [ ] docker-compose.yml validation passes: `docker-compose config > /dev/null`

### Tailscale Setup (Secure VPS Access)
- [ ] Tailscale installed on VPS: `curl -fsSL https://tailscale.com/install.sh | sh`
- [ ] Tailscale authenticated: `tailscale up --authkey=<key>`
- [ ] VPS assigned Tailscale IP (e.g., 100.64.x.x)
- [ ] Tailscale status verified: `tailscale status`
- [ ] Tailscale installed on macOS: `brew install tailscale`
- [ ] macOS authenticated to Tailscale: `tailscale up`
- [ ] Tailscale connectivity tested between macOS and VPS
- [ ] Noted both Tailscale IPs for reference

### Repository Setup
- [ ] GitHub SSH key configured on VPS (add public key to GitHub)
- [ ] Repository cloned to `/opt/paios`:
  ```bash
  mkdir -p /opt/paios
  cd /opt/paios
  git clone git@github.com:rafalciesielski/paios.git .
  ```
- [ ] Docker Compose file validated: `docker-compose config > /dev/null`
- [ ] Directory structure correct (volumes/, docker-compose.yml present)

---

## Data Migration Phase

### Environment Configuration
- [ ] `.env` file created at `/opt/paios/.env`
- [ ] All required variables populated:
  - [ ] `N8N_PORT=5678`
  - [ ] `N8N_PROTOCOL=http`
  - [ ] `N8N_HOST=paios-vps`
  - [ ] `DB_PASSWORD=<secure-random>`
  - [ ] `TELEGRAM_BOT_TOKEN=<token>`
  - [ ] `TELEGRAM_CHAT_ID=<id>`
  - [ ] `RESTIC_REPOSITORY=s3:...`
  - [ ] `RESTIC_PASSWORD=<password>`
  - [ ] `AWS_ACCESS_KEY_ID=<key>`
  - [ ] `AWS_SECRET_ACCESS_KEY=<secret>`
- [ ] File permissions secured: `chmod 600 /opt/paios/.env`
- [ ] No secrets hardcoded in docker-compose.yml (all reference .env)

### Data Transfer
- [ ] Workflows exported from local n8n (as JSON files)
- [ ] Workflow files copied to VPS git repo or separate storage
- [ ] Alternative: Using git to store workflow definitions verified
- [ ] Database (if using PostgreSQL) backed up on local
- [ ] N8n Data Table content backed up (via export or backup tool)

---

## Docker Deployment Phase

### Container Startup
- [ ] Changed to deployment directory: `cd /opt/paios`
- [ ] Docker images pulled: `docker-compose pull`
- [ ] Containers started: `docker-compose up -d`
- [ ] Services starting (wait 30-60 seconds for initialization)
- [ ] All containers running: `docker-compose ps` shows "Up" for all
- [ ] n8n initialization complete (check logs for ready message)

### Service Verification
- [ ] n8n health check passes:
  ```bash
  curl -s http://localhost:5678/api/v1/health | jq '.status'
  ```
- [ ] n8n workflow endpoint accessible:
  ```bash
  curl -s http://localhost:5678/api/v1/workflows | jq '.length'
  ```
- [ ] Database connection successful:
  ```bash
  docker exec paios-postgres psql -U n8n -d n8n -c "SELECT version();"
  ```
- [ ] Vault initialized and accessible:
  ```bash
  curl -s http://localhost:8200/v1/sys/health | jq '.sealed'
  ```
- [ ] All docker volumes mounted correctly: `docker inspect paios-n8n | grep -A 10 Mounts`

---

## Workflow Configuration Phase

### Workflow Import
- [ ] Noted VPS Tailscale IP (from `tailscale ip -4`)
- [ ] Accessed n8n UI via Tailscale: `https://100.x.x.x:5678`
- [ ] Logged into n8n with credentials
- [ ] M1 workflow (Telegram) imported
- [ ] M2 workflow (Daily Brief) imported
- [ ] M3 workflow (Reddit Radar) imported
- [ ] M4 persist-articles workflow imported
- [ ] M4 export-latest-news workflow imported
- [ ] All workflows appear in n8n UI workflow list

### Credential Configuration
- [ ] n8n credentials UI accessed: Menu → Credentials
- [ ] Telegram bot token added or verified
- [ ] GitHub token added or verified
- [ ] Reddit credentials added (if required)
- [ ] Any other API credentials from .env loaded
- [ ] Credentials test: Each credential can be verified in n8n UI

### Scheduling Verification
- [ ] M3 workflow scheduled for 08:00 UTC
- [ ] M4 export-latest-news scheduled for 08:05 UTC
- [ ] Scheduling visible in workflow settings
- [ ] No ERROR lines in logs: `docker-compose logs n8n | grep -i error`

---

## Cloudflare DNS Phase

### DNS Record Creation
- [ ] Logged into Cloudflare dashboard
- [ ] Navigated to DNS records for domain
- [ ] Created A record:
  - [ ] Name: `paios.example.com`
  - [ ] Value: VPS public IP address
  - [ ] TTL: 3600
  - [ ] Proxy: Proxied (orange cloud)
- [ ] Optional: Created API subdomain record if needed
- [ ] DNS records saved and visible in dashboard

### SSL/TLS Configuration
- [ ] Navigated to SSL/TLS settings in Cloudflare
- [ ] Set SSL/TLS mode to "Flexible"
- [ ] Enabled "Always Use HTTPS"
- [ ] Verified HSTS setting is enabled
- [ ] Set HSTS max-age to 31536000 seconds
- [ ] Minimum TLS version set to 1.2

### DNS Propagation
- [ ] Waited 1-2 minutes for DNS records to propagate
- [ ] DNS resolution verified:
  ```bash
  nslookup paios.example.com
  dig paios.example.com
  ```
- [ ] Should resolve to VPS public IP address
- [ ] HTTPS connectivity tested:
  ```bash
  curl -v https://paios.example.com/api/v1/health
  ```
- [ ] Response code 200 received (OK)

---

## Backup & Recovery Phase

### Restic Initialization
- [ ] SSH into VPS as paios user
- [ ] Exported Restic environment variables in shell or script
- [ ] Restic repository initialized:
  ```bash
  restic init
  ```
- [ ] No errors in initialization output
- [ ] Repository created in OVH Object Storage

### First Backup
- [ ] Created backup script at `/opt/paios/backup-config/restic-backup.sh`
- [ ] Script is executable: `chmod +x`
- [ ] Ran first backup manually:
  ```bash
  /opt/paios/backup-config/restic-backup.sh
  ```
- [ ] Backup completed without errors
- [ ] Backup appears in snapshot list:
  ```bash
  restic snapshots
  ```
- [ ] Snapshot size is reasonable (not 0 bytes)

### Cron Job Setup
- [ ] Edited crontab: `sudo crontab -e`
- [ ] Added backup cron job: `0 2 * * * /opt/paios/backup-config/restic-backup.sh`
- [ ] Verified cron entry: `sudo crontab -l`
- [ ] Permissions set for backup script accessibility
- [ ] Log file location created: `/var/log/paios-backup.log`
- [ ] Wait for first scheduled backup (should run at 02:00 UTC)

---

## Testing & Verification Phase

### Manual Workflow Execution
- [ ] Logged into n8n via Tailscale UI
- [ ] Manually triggered M3 workflow (Daily Brief)
- [ ] Workflow execution completed without errors
- [ ] Telegram notification received in chat
- [ ] Vault commit created in GitHub (git log shows new commit)

### Latest.json Verification
- [ ] Exported latest.json file location accessible on VPS
- [ ] File exists and has recent modification time:
  ```bash
  ls -lah /opt/paios/qa-news/public/latest.json
  ```
- [ ] File contains article data (not empty):
  ```bash
  wc -l /opt/paios/qa-news/public/latest.json
  ```
- [ ] File is valid JSON: `jq . latest.json > /dev/null`
- [ ] Articles contain expected fields: title, score, source, URL
- [ ] Commit pushed to qa-news repository on GitHub

### Database Verification
- [ ] Database queries work:
  ```bash
  docker exec paios-postgres psql -U n8n -d n8n -c "SELECT COUNT(*) FROM canonical_articles;"
  ```
- [ ] Article count is > 0
- [ ] Schema correct (all expected tables present)

### Container Health
- [ ] All containers still running: `docker-compose ps`
- [ ] No restart loops: `docker-compose ps | grep Restart`
- [ ] Memory usage reasonable: `docker stats --no-stream | head -5`
- [ ] Disk space not filling up: `df -h /opt/paios`

### Log Verification
- [ ] Last 24 hours of logs contain no ERROR:
  ```bash
  docker-compose logs --since 24h n8n | grep -i error
  ```
- [ ] No WARNING patterns indicating issues
- [ ] Scheduled execution logs show successful runs

### 24-Hour Operation Test
- [ ] Waited at least 24 hours for M3 to run automatically
- [ ] Verified M3 ran at 08:00 UTC (check n8n execution history)
- [ ] Verified export-latest-news ran at 08:05 UTC
- [ ] Verified latest.json updated with current date
- [ ] Verified no error notifications in Telegram
- [ ] Verified vault committed new articles (git log)

### Restore Procedure Test (Optional but Recommended)
- [ ] Provisioned temporary test VPS (same configuration)
- [ ] Followed VPS setup steps 1-7 above
- [ ] Ran restore from backup:
  ```bash
  restic restore latest --target /opt/paios/volumes/
  ```
- [ ] Started containers on test VPS
- [ ] Verified n8n restored with all workflows:
  ```bash
  curl -s http://localhost:5678/api/v1/workflows | jq '.length'
  ```
- [ ] Verified database restored:
  ```bash
  docker exec paios-postgres psql -U n8n -d n8n -c "SELECT COUNT(*) FROM canonical_articles;"
  ```
- [ ] Decommissioned test VPS
- [ ] Documented restore procedure works end-to-end

---

## DNS Switchover Phase

### Pre-Switchover Verification
- [ ] Checklist above complete through "Log Verification"
- [ ] All workflows tested and running on VPS
- [ ] Latest.json generating successfully for past 24 hours
- [ ] Telegram notifications working
- [ ] Vault syncing to GitHub
- [ ] First backup created successfully
- [ ] Monitoring script in place (if configured)
- [ ] Local backup of all data complete and verified
- [ ] Local n8n still running as fallback (if keeping for safety)

### Monitor Before Switchover
- [ ] Checked VPS logs one more time: `docker-compose logs --since 1h n8n`
- [ ] Verified no WARNING or ERROR patterns
- [ ] Checked disk usage: `df -h /opt/paios` (should be < 80%)
- [ ] Verified backup completed recently: `restic snapshots | head -1`

### Switchover Execution (Update Cloudflare DNS)
- [ ] Logged into Cloudflare dashboard
- [ ] Located DNS records for paios.example.com
- [ ] Verified A record points to VPS public IP
- [ ] Verified "Proxied" (orange cloud) is enabled
- [ ] Verified SSL/TLS mode is "Flexible"
- [ ] Verified "Always Use HTTPS" is ON
- [ ] No changes needed if already configured correctly above
- [ ] If changes made, waited 1-2 minutes for propagation

### Post-Switchover Verification
- [ ] Tested HTTPS connectivity from macOS:
  ```bash
  curl -v https://paios.example.com/api/v1/health
  ```
- [ ] Response code 200 received
- [ ] Monitored VPS logs for issues:
  ```bash
  ssh paios@TAILSCALE_IP
  docker-compose logs -f n8n
  ```
- [ ] No ERROR lines appearing in logs
- [ ] n8n UI accessible via public domain
- [ ] Waited 5-10 minutes to observe any error patterns

### Fallback Preparation
- [ ] Documented rollback procedure (in case issues arise)
- [ ] Keep local n8n running for 24-48 hours as safety net
- [ ] If rollback needed:
  - [ ] In Cloudflare, change A record to local machine IP (if public)
  - [ ] Or disable proxying temporarily
  - [ ] Or update DNS to fallback location
  - [ ] Restart local docker-compose
  - [ ] Test local n8n accessible

---

## Post-Migration Phase

### Monitoring Setup
- [ ] Created monitoring script: `/opt/paios/scripts/monitor.sh`
- [ ] Script checks n8n health every 6 hours
- [ ] Script checks disk usage
- [ ] Script checks backup age
- [ ] Script alerts via Telegram if issues detected
- [ ] Added to crontab: `0 */6 * * * /opt/paios/scripts/monitor.sh`
- [ ] Verified cron job: `sudo crontab -l`

### Daily Operations
- [ ] Morning checklist (09:00 UTC):
  - [ ] Check n8n logs for errors: `docker-compose logs --since 1h n8n`
  - [ ] Verify Telegram received daily brief
  - [ ] Spot-check vault latest commit: `git -C paios-vault log --oneline | head -1`
- [ ] Document procedure in docs/OPERATIONS.md

### Weekly Review
- [ ] Review workflow execution history in n8n UI
- [ ] Check disk usage growth: `du -sh /opt/paios/volumes/*`
- [ ] Verify backup size reasonable: `restic snapshots`
- [ ] Check error patterns: `docker-compose logs --since 7d n8n | grep -i error`

### Documentation
- [ ] Updated docs/OPERATIONS.md with VPS-specific procedures
- [ ] Created incident response runbook
- [ ] Documented rollback procedures
- [ ] Noted admin access procedures (Tailscale, SSH)

### Local Environment (Optional)
- [ ] If keeping local as fallback:
  - [ ] Local docker-compose still running
  - [ ] Local workflows still importing M3/M4 data
  - [ ] Local backups still being taken
- [ ] If decommissioning local (CAUTION):
  - [ ] Final backup of local volumes created
  - [ ] Docker volumes archived: `docker-compose down -v`
  - [ ] Confirmed all data on VPS and in backups before destroying

---

## Emergency Procedures

### If VPS Is Down
1. [ ] Check VPS status via OVH console
2. [ ] SSH into VPS and check docker: `docker-compose ps`
3. [ ] Check logs: `docker-compose logs n8n | tail -50`
4. [ ] Restart containers if needed: `docker-compose restart`
5. [ ] If persistent, restore from backup (see VPS_MIGRATION_PLAN.md section 8)
6. [ ] Fallback: Point DNS to local machine or use local n8n

### If DNS Resolution Fails
1. [ ] Verify DNS records in Cloudflare still configured
2. [ ] Check propagation: `nslookup paios.example.com`
3. [ ] Wait 1-2 minutes and retry
4. [ ] If still failing, temporarily point to local IP or Tailscale IP
5. [ ] Contact Cloudflare support if records disappeared

### If Backup Fails
1. [ ] Check Restic status: `restic snapshots`
2. [ ] Verify S3 credentials in .env: `echo $RESTIC_REPOSITORY`
3. [ ] Test S3 connectivity: `restic list blobs`
4. [ ] Re-run backup manually: `/opt/paios/backup-config/restic-backup.sh`
5. [ ] Check logs: `tail -50 /var/log/paios-backup.log`
6. [ ] If persistent, create local backup to external storage

### If Workflows Stop Running
1. [ ] Check n8n health: `curl http://localhost:5678/api/v1/health`
2. [ ] Check logs: `docker-compose logs n8n | tail -50`
3. [ ] Verify API credentials still valid
4. [ ] Manually trigger workflow to test
5. [ ] Restart n8n: `docker-compose restart n8n`
6. [ ] Verify scheduling still enabled in n8n UI

---

## Completion Sign-Off

Upon successful completion of all checklist items:

- [ ] VPS migration complete and verified
- [ ] All workflows running on VPS production
- [ ] DNS pointing to VPS
- [ ] Backups automated and tested
- [ ] Monitoring in place
- [ ] Local fallback available if needed
- [ ] Documentation updated

**Migration Completed By:** ___________________________  
**Date:** ___________________________  
**Verified By:** ___________________________  
**Date:** ___________________________  

---

**Document History:**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-13 | Initial comprehensive VPS migration checklist (P1-VPS-PLAN) |
