# Deployment Guide

## Local Deployment (macOS Docker)

### Prerequisites
- Docker Desktop running
- Git repos cloned: paios, paios-vault
- .env file with credentials

### Steps

1. **Start Docker Compose**
   ```bash
   docker-compose up -d
   ```
   Containers: n8n, (postgres if configured)

2. **Import Workflows**
   - Access n8n UI at http://localhost:5678
   - Import JSONs: persist-articles, export-latest-news, test workflows
   - Import M3 workflow from git

3. **Configure Environment**
   - Set EXPORT_FILE_PATH: /path/to/qa-news/public/latest.json
   - Set TELEGRAM_BOT_TOKEN, Vault mount path
   - Verify .env file in n8n container

4. **Enable Scheduling**
   - M3: Cron at 08:00 UTC
   - export-latest-news: Cron at 08:05 UTC
   - test-persist: Manual trigger (for testing)

5. **Verify**
   - Check n8n logs: `docker-compose logs -f n8n`
   - Test workflow manually
   - Verify latest.json generates

### Troubleshooting
- Workflow fails: Check n8n logs, verify API keys
- latest.json not updating: Verify EXPORT_FILE_PATH, check git credentials
- Telegram not sending: Check bot token, verify network access

---

## VPS Deployment (OVH Target)

### Prerequisites
- OVH VPS provisioned (Ubuntu 22.04)
- Cloudflare DNS configured (CNAME for domains)
- SSH access to VPS

### Overview
Same as local, but:
- Ubuntu server instead of macOS Docker
- Persistent volumes for backups
- Tailscale for secure access
- Restic for automated backups

*See RESTORE_PROCEDURE.md for step-by-step VPS setup.*

---

## Migration Path (Local → VPS)

1. Operationalize locally (M4 + workflows tested)
2. Backup local state (Restic)
3. Provision VPS
4. Restore to VPS (follow restore procedure)
5. Update Cloudflare DNS to point to VPS
6. Enable production scheduling on VPS
7. Keep local as dev environment
