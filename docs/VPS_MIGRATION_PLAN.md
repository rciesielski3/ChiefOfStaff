# VPS Migration Plan

**Status:** Production Ready  
**Version:** 1.0  
**Last Updated:** 2026-07-13  
**Target Environment:** OVH VPS (Ubuntu 22.04 LTS)

---

## Overview

This document provides a comprehensive, step-by-step guide for migrating PAIOS from local macOS Docker development environment to production on OVH VPS. The migration preserves all data, workflows, and configuration through careful backup/restore procedures.

**Key Principles:**
- Local development environment remains as fallback
- Zero data loss: Full backup before any VPS operations
- Gradual transition: DNS switchover after verification
- Automated backups: Restic on VPS ensures recoverability
- Infrastructure-as-code: Docker Compose enables reproducible deployments

---

## 1. Pre-Migration Requirements

### Local Environment Validation

Before beginning migration, ensure local PAIOS is fully operational:

- [ ] All M1-M4 workflows imported and tested
- [ ] Daily Brief (M3) runs successfully at 08:00 UTC
- [ ] Knowledge Layer (M4) persists articles and exports latest.json
- [ ] Telegram notifications delivering correctly
- [ ] Vault repository syncing to GitHub
- [ ] Docker Compose starts cleanly: `docker-compose up -d`
- [ ] All containers healthy: `docker-compose ps` shows "Up"

**Test Command:**
```bash
docker-compose logs n8n | tail -20  # No ERROR lines in recent logs
curl http://localhost:5678/api/v1/workflows  # Should return workflow list
```

### Secrets & Credentials Audit

- [ ] All API tokens verified and valid
- [ ] Telegram bot token confirmed active
- [ ] GitHub SSH keys working: `git -C paios-vault pull` succeeds
- [ ] Cloudflare API token (if used) valid
- [ ] OVH object storage credentials prepared (for Restic backups)

### Infrastructure Prerequisites

**OVH VPS Provisioning:**
- [ ] OVH account active and subscribed
- [ ] VPS ordered: Ubuntu 22.04 LTS, 2+ CPU, 4+ GB RAM, 50+ GB SSD
- [ ] VPS deployed and powered on
- [ ] Initial root SSH access verified

**Domain & DNS:**
- [ ] Domain registered and transferred to Cloudflare
- [ ] Cloudflare account configured
- [ ] DNS zone active in Cloudflare
- [ ] Initial NS records pointing to Cloudflare

**Backup Infrastructure:**
- [ ] OVH Object Storage bucket created (or S3-compatible alternative)
- [ ] Access keys obtained and securely stored
- [ ] S3 URL format known: `s3://bucket/paios-backup` or `s3:s3.ovh.net/bucket`

---

## 2. VPS Environment Setup

### Initial VPS Configuration

**Step 1: SSH Access & Security**

```bash
# Connect to VPS with root credentials (initial)
ssh root@VPS_IP

# Create non-root user
useradd -m -s /bin/bash -G docker paios
passwd paios  # Set strong password

# Configure SSH keys (copy your public key)
mkdir -p /home/paios/.ssh
cp ~/.ssh/id_rsa.pub /home/paios/.ssh/authorized_keys
chown -R paios:paios /home/paios/.ssh
chmod 700 /home/paios/.ssh
chmod 600 /home/paios/.ssh/authorized_keys

# Disable root login
sed -i 's/^#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh
```

**Step 2: System Updates & Utilities**

```bash
apt-get update && apt-get upgrade -y
apt-get install -y \
  curl wget git vim htop \
  ca-certificates apt-transport-https \
  software-properties-common fail2ban

# Enable fail2ban
systemctl enable fail2ban
systemctl start fail2ban
```

**Step 3: Firewall Configuration**

```bash
# Install UFW (if not present)
apt-get install -y ufw

# Allow SSH, HTTP, HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable

# Verify
ufw status
```

### Docker Installation

```bash
# Install Docker from official repository
curl -fsSL https://get.docker.com | sh

# Add paios user to docker group
usermod -aG docker paios

# Verify installation (as paios user)
su - paios
docker --version
docker run hello-world
```

### Docker Compose Installation

```bash
# Install Docker Compose v2
curl -L "https://github.com/docker/compose/releases/download/$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep 'tag_name' | cut -d'"' -f4)/docker-compose-$(uname -s)-$(uname -m)" \
  -o /usr/local/bin/docker-compose

chmod +x /usr/local/bin/docker-compose

# Verify
docker-compose --version
```

### Tailscale Installation & Setup

Tailscale provides secure access from macOS development environment to VPS.

```bash
# As root
curl -fsSL https://tailscale.com/install.sh | sh

# Authenticate (generates Tailscale IP)
tailscale up --authkey=<machine-auth-key> --hostname=paios-vps

# Note the assigned Tailscale IP (e.g., 100.64.x.x)
tailscale ip -4

# Verify connectivity from macOS
# On macOS: tailscale ip -4
# Should see both macOS and VPS IPs
```

### Repository Setup

```bash
# As paios user
cd /home/paios

# Clone PAIOS repository
git clone git@github.com:rafalciesielski/paios.git
cd paios

# Verify Docker Compose file
docker-compose config > /dev/null && echo "✅ docker-compose.yml valid"
```

---

## 3. Data Migration Strategy

### Backup Before Migration

```bash
# On local macOS (before any VPS operations)
cd ~/projects/paios  # Adjust to your path

# Create timestamped backup
BACKUP_TS=$(date +%Y%m%d-%H%M%S)
mkdir -p ~/backups/paios-pre-migration

# Backup Docker volumes
docker-compose down
tar -czf ~/backups/paios-pre-migration/volumes-$BACKUP_TS.tar.gz volumes/

# Backup database dump (if using PostgreSQL)
docker-compose up -d postgres
docker exec paios-postgres pg_dump -U n8n -d n8n > ~/backups/paios-pre-migration/database-$BACKUP_TS.sql
docker-compose down

# Backup git repositories
tar -czf ~/backups/paios-pre-migration/paios-vault-$BACKUP_TS.tar.gz ../paios-vault/

echo "✅ Backup complete: ~/backups/paios-pre-migration/$BACKUP_TS"
```

### Data Transfer to VPS

**Option A: Git-Based (Recommended)**

Since workflows and configuration are version-controlled:

```bash
# On VPS
cd /opt/paios

# Clone from GitHub (workflows already in git)
git clone git@github.com:rafalciesielski/paios.git .

# Database and volumes will be recreated/restored separately
```

**Option B: Direct Backup Restore**

If using Restic for backups:

```bash
# On macOS: Create initial backup
restic init --repo s3://bucket/paios-backup
restic backup ./volumes/

# On VPS: Restore from backup
restic restore latest --target /opt/paios/volumes/
```

### Environment Configuration

```bash
# On VPS, create .env file with production values
cat > /opt/paios/.env << 'EOF'
# n8n Configuration
N8N_PORT=5678
N8N_PROTOCOL=http
N8N_HOST=paios-vps  # Tailscale hostname
N8N_PATH=/
WEBHOOK_URL=https://paios.example.com/

# Database
DB_TYPE=postgres
DB_HOST=postgres
DB_PORT=5432
DB_NAME=n8n
DB_PASSWORD=<secure-password>

# Vault
VAULT_ADDR=http://vault:8200
VAULT_TOKEN=<vault-token>

# PAIOS Configuration
PAIOS_VAULT_PATH=/opt/paios-vault
EXPORT_FILE_PATH=/opt/paios/qa-news/public/latest.json

# Telegram
TELEGRAM_BOT_TOKEN=<from-vault>
TELEGRAM_CHAT_ID=<your-chat-id>

# Backup (Restic)
RESTIC_REPOSITORY=s3:s3.ovh.net/bucket/paios-backup
RESTIC_PASSWORD=<secure-password>
AWS_ACCESS_KEY_ID=<OVH-key>
AWS_SECRET_ACCESS_KEY=<OVH-secret>

# Tailscale
TAILSCALE_HOSTNAME=paios-vps
EOF

# Secure the file
chmod 600 /opt/paios/.env
```

---

## 4. Docker Deployment on VPS

### Pull & Start Containers

```bash
cd /opt/paios

# Pull latest images
docker-compose pull

# Start containers in background
docker-compose up -d

# Monitor startup (wait 30-60 seconds for n8n initialization)
docker-compose logs -f n8n

# Verify all services running
docker-compose ps
```

Expected output:
```
NAME           STATUS
paios-n8n      Up 2 minutes
paios-postgres Up 2 minutes
paios-vault    Up 2 minutes
```

### Verify Services

```bash
# n8n API health
curl -s http://localhost:5678/api/v1/health | jq '.status'

# Database connectivity
docker exec paios-postgres psql -U n8n -d n8n -c "SELECT version();"

# Vault status
curl -s http://localhost:8200/v1/sys/health | jq '.sealed'
```

---

## 5. Workflow Import & Configuration

### Import Workflows to VPS n8n

Access n8n UI via Tailscale:

```bash
# On macOS terminal
TAILSCALE_IP=$(tailscale ip -4 | grep "100\.")  # Get VPS Tailscale IP
# Open browser: https://$TAILSCALE_IP:5678
```

**Manual Import Steps:**
1. Log into n8n UI
2. Menu → Import → Select workflow JSON files
3. Import in order:
   - M1 (Telegram)
   - M2 (Daily Brief)
   - M3 (Reddit Radar)
   - M4 workflows (persist-articles, export-latest-news)

**Automated Import** (if using workflow-as-code):
```bash
# If workflows are in git and have an import script
cd /opt/paios
./scripts/import-workflows.sh
```

### Verify Workflow Configuration

```bash
# Check credentials are loaded
curl -s http://localhost:5678/api/v1/credentials | jq '.[].name'

# Verify scheduled timings
curl -s http://localhost:5678/api/v1/workflows | jq '.[] | {name, active}'
```

---

## 6. Cloudflare DNS Configuration

### DNS Records Setup

In Cloudflare dashboard:

| Type | Name | Value | TTL | Proxy | Notes |
|------|------|-------|-----|-------|-------|
| A | paios.example.com | VPS-PUBLIC-IP | 3600 | Proxied | Public access to VPS |
| A | api.paios.example.com | VPS-PUBLIC-IP | 3600 | Proxied | API access (optional) |
| TXT | _acme-challenge | (certbot token) | 300 | DNS Only | SSL validation (if needed) |

### SSL/TLS Configuration

In Cloudflare dashboard → SSL/TLS:

- **Mode:** Flexible (Cloudflare handles HTTPS, backend is HTTP)
- **Always Use HTTPS:** Enabled
- **HSTS:** Enabled (max-age: 31536000)
- **Minimum TLS Version:** TLS 1.2

### DNS Validation

```bash
# Wait 1-2 minutes for DNS propagation
nslookup paios.example.com
dig paios.example.com

# Test HTTPS connectivity
curl -v https://paios.example.com/api/v1/health

# Expected: 200 OK response
```

---

## 7. Backup & Recovery Setup

### Restic Initialization

```bash
# On VPS as paios user
export RESTIC_REPOSITORY="s3:s3.ovh.net/bucket/paios-backup"
export RESTIC_PASSWORD="<secure-password>"
export AWS_ACCESS_KEY_ID="<OVH-key>"
export AWS_SECRET_ACCESS_KEY="<OVH-secret>"

# Initialize backup repository
restic init

# Verify initialization
restic snapshots  # Should return empty list (no backups yet)
```

### First Backup

```bash
# Create first backup
restic backup /opt/paios/volumes/ \
  --exclude='/opt/paios/volumes/logs/*' \
  --exclude='/opt/paios/volumes/backups/*' \
  --tag initial \
  --tag "$(date +%Y-%m-%d)"

# Verify backup
restic snapshots

# Expected output:
# ID        Time                 Host        Tags
# xxxxxxxx  2026-07-13 10:30:00  paios-vps   initial, 2026-07-13
```

### Automated Backup Script

```bash
# Create backup script
sudo tee /opt/paios/backup-config/restic-backup.sh > /dev/null << 'EOF'
#!/bin/bash
set -e

export RESTIC_REPOSITORY="s3:s3.ovh.net/bucket/paios-backup"
export RESTIC_PASSWORD="<secure-password>"
export AWS_ACCESS_KEY_ID="<OVH-key>"
export AWS_SECRET_ACCESS_KEY="<OVH-secret>"

# Create snapshot
restic backup /opt/paios/volumes/ \
  --exclude='/opt/paios/volumes/logs/*' \
  --exclude='/opt/paios/volumes/backups/*' \
  --tag daily \
  --tag "$(date +%Y-%m-%d)"

# Prune old backups (keep 30 days)
restic forget --keep-daily 30 --prune

# Verify integrity
restic check

# Log result
echo "✅ Backup completed at $(date)" >> /var/log/paios-backup.log
EOF

chmod +x /opt/paios/backup-config/restic-backup.sh
```

### Cron Scheduling

```bash
# Add to crontab
sudo crontab -e

# Add line (daily backup at 02:00 UTC)
0 2 * * * /opt/paios/backup-config/restic-backup.sh >> /var/log/paios-backup.log 2>&1

# Verify cron job
sudo crontab -l
```

---

## 8. Verification & Testing

### Full Workflow Cycle Test

On VPS, manually trigger and verify M3 → M4 pipeline:

```bash
# Access n8n via Tailscale UI and manually trigger M3 workflow
# Monitor execution and verify:
# 1. M3 fetches articles from sources
# 2. Articles scored and ranked
# 3. persist-articles sub-workflow stores canonical articles
# 4. Telegram notification sent
# 5. Vault commits changes to GitHub
```

### Export Verification

```bash
# Verify latest.json generated
ls -lah /opt/paios/qa-news/public/latest.json

# Check content (should contain recent articles)
jq '.[] | {title, score}' /opt/paios/qa-news/public/latest.json | head -10

# Verify git commit
cd /opt/paios/qa-news
git log --oneline | head -5
```

### Scheduled Execution Verification

```bash
# Verify cron jobs for workflow scheduling
curl -s http://localhost:5678/api/v1/workflows | jq '.[] | select(.active) | {id, name}'

# Check n8n logs for scheduled executions
docker-compose logs --since 1h n8n | grep -i "trigger"
```

### Restore Procedure Test

After 24 hours of successful operation, test restore on temporary VPS:

```bash
# Provision temporary test VPS (same Ubuntu 22.04 setup)
# Follow steps 1-7 above, then:

# Restore from backup
export RESTIC_REPOSITORY="s3:s3.ovh.net/bucket/paios-backup"
export RESTIC_PASSWORD="<secure-password>"
export AWS_ACCESS_KEY_ID="<OVH-key>"
export AWS_SECRET_ACCESS_KEY="<OVH-secret>"

restic restore latest --target /opt/paios/volumes/

# Start containers
docker-compose up -d

# Verify n8n restored with all workflows
curl -s http://localhost:5678/api/v1/workflows | jq '.length'

# Decommission test VPS
```

---

## 9. DNS Switchover

### Pre-Switchover Checklist

Before pointing DNS to VPS production:

- [ ] All workflows tested and running on VPS
- [ ] Latest.json generating successfully
- [ ] Telegram notifications sending
- [ ] Vault syncing to GitHub
- [ ] First backup created and verified
- [ ] Restore procedure tested
- [ ] DNS records created in Cloudflare
- [ ] Monitoring alerts configured
- [ ] Local backup of all data complete
- [ ] Local n8n running as fallback

### Switchover Execution

```bash
# In Cloudflare dashboard:
# 1. Verify DNS records for paios.example.com point to VPS IP
# 2. Check SSL/TLS settings (Flexible mode with HTTPS)
# 3. Enable "Always Use HTTPS"
# 4. Verify HSTS enabled

# Test connectivity
curl -v https://paios.example.com/api/v1/health

# Monitor VPS logs for any issues
ssh paios@TAILSCALE_IP
docker-compose logs -f n8n
```

### Fallback Procedure

If VPS issues detected after switchover:

```bash
# Immediate: Revert DNS in Cloudflare
# 1. Disable proxy on A records (set to "DNS only")
# 2. Point to local machine IP (if publicly accessible)
# 3. OR keep local n8n running on localhost backup

# Communication
# Notify users of switchback via Telegram

# Post-Incident
# Investigate logs: docker-compose logs n8n
# Fix issue
# Re-test before switching back
```

---

## 10. Post-Migration Operations

### Monitoring & Alerting Setup

```bash
# Create monitoring script
sudo tee /opt/paios/scripts/monitor.sh > /dev/null << 'EOF'
#!/bin/bash

# Check n8n health
if ! curl -s http://localhost:5678/api/v1/health | grep -q "ok"; then
  echo "ALERT: n8n health check failed" | \
    curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"PAIOS Alert: n8n is down"}' \
    $TELEGRAM_WEBHOOK_URL
fi

# Check disk usage
DISK_USAGE=$(df /opt/paios | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt 80 ]; then
  echo "ALERT: Disk usage at ${DISK_USAGE}%" | \
    curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"PAIOS Alert: Disk at ${DISK_USAGE}%\"}" \
    $TELEGRAM_WEBHOOK_URL
fi

# Check backup age
LATEST_BACKUP=$(restic snapshots --json | jq -r '.[0].time')
BACKUP_AGE=$(( ($(date +%s) - $(date -d "$LATEST_BACKUP" +%s)) / 3600 ))
if [ $BACKUP_AGE -gt 25 ]; then
  echo "ALERT: Backup is ${BACKUP_AGE} hours old" | \
    curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"PAIOS Alert: Backup ${BACKUP_AGE}h old\"}" \
    $TELEGRAM_WEBHOOK_URL
fi
EOF

chmod +x /opt/paios/scripts/monitor.sh

# Add to crontab (every 6 hours)
# 0 */6 * * * /opt/paios/scripts/monitor.sh >> /var/log/paios-monitor.log 2>&1
```

### Decommissioning Local Environment (Optional)

After 48 hours of successful VPS operation:

```bash
# On macOS (OPTIONAL - keep for fallback if needed)
# Option 1: Keep running as dev environment
docker-compose up -d

# Option 2: Stop but preserve volumes for recovery
docker-compose down
# volumes/ remain for future recovery

# Option 3: Full cleanup (CAUTION - irreversible)
docker-compose down -v  # Removes volumes
```

### Daily Operations

See docs/OPERATIONS.md for:
- Morning checklist (09:00 UTC)
- Weekly reviews
- Monthly audits
- Incident response procedures

---

## References

- [n8n Documentation](https://docs.n8n.io/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Restic Backup Guide](https://restic.readthedocs.io/)
- [Tailscale Linux Setup](https://tailscale.com/kb/1002/linux-server-setup)
- [Cloudflare DNS Guide](https://developers.cloudflare.com/dns/)
- [OVH VPS Documentation](https://guides.ovh.com/server/)

---

**Document History:**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-13 | Initial comprehensive VPS migration plan (P1-VPS-PLAN) |
