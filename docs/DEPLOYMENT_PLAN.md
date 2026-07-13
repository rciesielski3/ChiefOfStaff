# PAIOS Deployment Plan

**Status:** Production Ready  
**Version:** 1.0  
**Last Updated:** 2026-07-13

---

## Overview

This document describes the deployment architecture for PAIOS, covering both the current local setup (macOS Docker) and the target production environment (OVH VPS). It includes detailed procedures for provisioning, configuring, and migrating between environments.

**Key Principles:**
- Local development environment remains intact and self-contained
- VPS is the production target using identical Docker Compose configuration
- All infrastructure is version-controlled and reproducible
- Deployment unit is Docker Compose
- No manual configuration beyond .env files and domain setup

---

## 1. Local Architecture (Current State)

### Environment
- **Host OS:** macOS (Intel or Apple Silicon)
- **Container Platform:** Docker Desktop (latest stable)
- **Port Bindings:** n8n on `localhost:5678`, Vault on `localhost:8200`
- **Storage:** Local volumes mounted from `./volumes/` directory

### Components
```
n8n (localhost:5678)
├── Workflows (M1-M4)
├── Database (SQLite or PostgreSQL)
└── Scheduled jobs (cron timers)

Vault (localhost:8200)
├── Credentials storage
└── Secrets backend

Git repository
└── Workflows, configs, vault data
```

### Volume Structure
```
volumes/
├── n8n-data/          # n8n database, workflows, config
├── vault-file/        # Vault backend storage
├── backups/           # Restic backup cache
└── logs/              # Application logs (optional)
```

### Network Topology
- **localhost** networking
- Port 5678: n8n UI and API
- Port 8200: Vault UI and API
- No external inbound traffic (local-only access)

### Docker Compose Services
- `n8n`: Main workflow orchestration engine
- `vault`: Secrets management
- `postgres` (optional): External database for n8n (if configured)

**Startup Command:**
```bash
docker-compose up -d
```

**Verification:**
```bash
docker-compose ps
curl http://localhost:5678/api/v1/workflows   # Should return workflow list
```

---

## 2. VPS Architecture (Target)

### Environment
- **Host OS:** Ubuntu 22.04 LTS
- **Hosting:** OVH VPS (minimum: 2 CPU, 4GB RAM, 50GB SSD)
- **Container Platform:** Docker + Docker Compose (installed from official repo)
- **Access:** SSH key-based authentication, Tailscale tunnel

### Components
```
n8n (internal)
├── Workflows (M1-M4)
├── PostgreSQL database (persistent)
└── Scheduled jobs (cron timers)

Vault (internal)
├── Credentials storage
└── Secrets backend for n8n

Tailscale
└── Encrypted access from macOS

Backup service
├── Restic for incremental backups
└── S3-compatible storage (OVH Object Storage or local)

Cloudflare DNS
└── Domain resolution + SSL/TLS
```

### Volume Structure
```
/opt/paios/
├── docker-compose.yml
├── .env (production secrets)
├── volumes/
│   ├── n8n-data/          # Persistent n8n database
│   ├── vault-file/        # Persistent vault storage
│   ├── backups/           # Local backup staging area
│   └── logs/              # Persistent application logs
├── backup-config/
│   └── restic/            # Backup scripts and configuration
└── scripts/
    ├── backup.sh          # Backup execution script
    └── restore.sh         # Restore execution script
```

### Network Topology
- **Tailscale**: Encrypted VPN tunnel for remote access
- **Cloudflare DNS**: Public domain resolution with SSL/TLS
- **Ports (internal only):**
  - Port 5678: n8n (accessible via Tailscale)
  - Port 8200: Vault (accessible via Tailscale)
  - Port 22: SSH (key-based only)
- **No direct inbound** from public internet to application ports

### Docker Compose Services
- `n8n`: Workflow orchestration (PostgreSQL backend)
- `vault`: Secrets management
- `postgres`: Database for n8n (persistent, backed up)

**Startup Command:**
```bash
cd /opt/paios
docker-compose up -d
```

---

## 3. Docker Topology: Volumes, Networking & Ports

### Volume Mapping Strategy

**Local (macOS):**
```yaml
volumes:
  n8n-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./volumes/n8n-data
  
  vault-file:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: ./volumes/vault-file
```

**VPS (Ubuntu):**
```yaml
volumes:
  n8n-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/paios/volumes/n8n-data
  
  vault-file:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/paios/volumes/vault-file
  
  postgres-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /opt/paios/volumes/postgres-data
```

### Port Bindings

**Local Setup:**
- `127.0.0.1:5678 -> n8n:5678` (localhost only)
- `127.0.0.1:8200 -> vault:8200` (localhost only)

**VPS Setup:**
- `127.0.0.1:5678 -> n8n:5678` (internal only)
- `127.0.0.1:8200 -> vault:8200` (internal only)
- Access via Tailscale tunnel (no public ports)

### Container Networking

**Network Mode:** `bridge` (default)

```yaml
services:
  n8n:
    networks:
      - paios-net
    environment:
      N8N_PORT: 5678
      DB_TYPE: postgres
      DB_HOST: postgres
      DB_PORT: 5432
  
  vault:
    networks:
      - paios-net
  
  postgres:
    networks:
      - paios-net

networks:
  paios-net:
    driver: bridge
```

---

## 4. Environment Variables & Secrets Strategy

### Required .env Variables

**Common (both local and VPS):**
```bash
# n8n Configuration
N8N_PORT=5678
N8N_PROTOCOL=http
N8N_HOST=localhost  # Use Tailscale IP on VPS
N8N_PATH=/
WEBHOOK_URL=http://localhost:5678/  # Update for VPS

# Database
DB_TYPE=postgres
DB_HOST=postgres
DB_PORT=5432
DB_NAME=n8n
DB_USER=n8n
DB_PASSWORD=<generate-random-32-chars>

# Vault
VAULT_ADDR=http://vault:8200
VAULT_TOKEN=<generate-token>
VAULT_SKIP_VERIFY=true  # Only for dev/staging

# API Credentials (stored in Vault, referenced in n8n)
TELEGRAM_BOT_TOKEN=<from-vault>
OPENAI_API_KEY=<from-vault>
GITHUB_TOKEN=<from-vault>
```

**VPS-Specific:**
```bash
# Tailscale
TAILSCALE_AUTHKEY=<machine-auth-key>
TAILSCALE_HOSTNAME=paios-vps

# Backup Configuration
RESTIC_REPOSITORY=s3:s3.ovh.net/bucket/paios-backup
RESTIC_PASSWORD=<generate-random-32-chars>
AWS_ACCESS_KEY_ID=<OVH-object-storage>
AWS_SECRET_ACCESS_KEY=<OVH-object-storage>
```

### Secrets Management

**Storage Hierarchy:**
1. **Sensitive secrets** (API tokens, passwords): Store in Vault
2. **Infrastructure secrets** (.env file): Version-control encrypted or exclude from git
3. **Database passwords**: Generate randomly, store in .env, backed up with database

**.env File Handling:**
```bash
# .gitignore
.env              # Never commit
.env.local        # Personal overrides
.env.*.local      # Environment-specific

# Create .env.example with placeholders
cp .env.example .env
# Edit .env with actual values
```

### Secret Rotation Procedure

1. Generate new secret in Vault
2. Update n8n workflow/credentials to use new secret
3. Test with new secret
4. Deactivate old secret in Vault
5. Document rotation date in VAULT credentials

---

## 5. Cloudflare DNS Configuration

### Domain Setup

**Assumption:** Domain already configured in Cloudflare account.

**DNS Records for VPS:**

| Type | Name | Value | TTL | Notes |
|------|------|-------|-----|-------|
| A | paios.example.com | VPS-PUBLIC-IP | 3600 | Points to VPS |
| A | api.paios.example.com | VPS-PUBLIC-IP | 3600 | n8n API access |
| TXT | _acme-challenge | (certbot token) | 300 | SSL certificate validation |

### SSL/TLS Configuration

**Strategy:** Cloudflare Flexible SSL → n8n HTTP

1. In Cloudflare dashboard:
   - **SSL/TLS** → **Flexible** (Cloudflare handles SSL, backend is HTTP)
   - **Always Use HTTPS** → ON
   - **HSTS** → Enabled (max-age: 31536000)

2. VPS running n8n on HTTP (internal only)
3. Cloudflare decrypts HTTPS, forwards to n8n via Tailscale

**Alternative:** Full SSL with self-signed certificate on VPS
- VPS runs n8n on HTTPS (self-signed)
- Cloudflare forwards to HTTPS backend
- Higher security, requires cert management

### DNS Validation

```bash
# Verify resolution
nslookup paios.example.com
dig paios.example.com

# Test connectivity
curl -v https://paios.example.com/api/v1/workflows
```

---

## 6. Tailscale Usage: macOS to VPS Access

### Installation & Setup

**VPS (Ubuntu):**
```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up --authkey=<machine-key> --hostname=paios-vps
sudo tailscale set --advertise-routes=10.0.0.0/24  # If needed
```

**macOS:**
```bash
brew install tailscale
tailscale up
# Authenticate via browser
```

### Network Access

**Tailscale IP Assignment:**
- VPS gets assigned: `100.x.x.x` (example)
- macOS gets assigned: `100.y.y.y` (example)

**Access n8n on VPS via macOS:**
```bash
# Use Tailscale IP directly
https://100.x.x.x:5678/

# Or configure /etc/hosts (macOS)
echo "100.x.x.x paios.internal" >> /etc/hosts
https://paios.internal:5678/
```

### Configuration in n8n

Update `.env` on VPS:
```bash
N8N_HOST=100.x.x.x  # Tailscale IP
N8N_PROTOCOL=https  # If using HTTPS
WEBHOOK_URL=https://paios.example.com/  # Public Cloudflare URL
```

### Security Considerations

- Tailscale uses WireGuard with end-to-end encryption
- No inbound ports exposed to public internet
- Access only from authenticated Tailscale devices
- Disable Tailscale exit node (unless needed for specific workflows)

---

## 7. Backup & Restore Integration

### Backup Strategy

**Tool:** Restic (incremental, deduplicated, encrypted)

**Backup Schedule:**
- Daily at 02:00 UTC (off-peak)
- Weekly full backup verification
- Monthly backup to secondary storage

**Backup Scope:**
```
/opt/paios/volumes/
├── n8n-data/          # Workflows, execution logs
├── vault-file/        # Encrypted credentials
└── postgres-data/     # Database (most critical)
```

**Backup Configuration:**

```bash
# On VPS: /opt/paios/backup-config/restic-backup.sh
#!/bin/bash
set -e

export RESTIC_REPOSITORY="s3:s3.ovh.net/paios-backup"
export RESTIC_PASSWORD="<encryption-password>"
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

# Verify latest snapshot
restic check
```

**Cron Setup:**
```bash
sudo crontab -e
# Add: 0 2 * * * /opt/paios/backup-config/restic-backup.sh >> /var/log/paios-backup.log 2>&1
```

### Restore Procedure

**Full Restore (VPS recovery from backup):**

```bash
# Stop services
cd /opt/paios
docker-compose down

# Clear volumes
sudo rm -rf volumes/*

# Restore from backup
export RESTIC_REPOSITORY="s3:s3.ovh.net/paios-backup"
export RESTIC_PASSWORD="<encryption-password>"
export AWS_ACCESS_KEY_ID="<OVH-key>"
export AWS_SECRET_ACCESS_KEY="<OVH-secret>"

# List available snapshots
restic snapshots

# Restore latest snapshot
restic restore latest --target /opt/paios/volumes/

# Restore to specific date
restic restore <snapshot-id> --target /opt/paios/volumes/

# Restart services
docker-compose up -d

# Verify n8n
curl http://localhost:5678/api/v1/workflows
```

**Partial Restore (single workflow or credential):**

```bash
# Extract specific file from backup
restic restore <snapshot-id> \
  --include 'n8n-data/workflows/workflow-id.json' \
  --target /tmp/recovery/

# Copy recovered file to active volume
cp /tmp/recovery/opt/paios/volumes/n8n-data/workflows/workflow-id.json \
   /opt/paios/volumes/n8n-data/workflows/
```

### Backup Verification Checklist

- [ ] Restic initialization successful
- [ ] First backup completes without errors
- [ ] Backup size is reasonable (expected: 200MB-2GB)
- [ ] Restore test on separate VPS confirms data integrity
- [ ] Scheduled backup cron job running daily
- [ ] Monitoring alert configured if backup fails

---

## 8. Rollback Strategy

### Pre-Deployment Backup

Before any update or configuration change:

```bash
# Backup current state
restic backup /opt/paios/volumes/ --tag "pre-deployment-$(date +%s)"

# Note snapshot ID
restic snapshots | head -1
```

### Rollback Procedure (Quick)

**Step 1: Stop current version**
```bash
cd /opt/paios
docker-compose down
```

**Step 2: Revert code changes**
```bash
git log --oneline | head -5
git reset --hard <previous-commit>
```

**Step 3: Restore data from pre-deployment backup**
```bash
restic restore <pre-deployment-snapshot-id> --target /opt/paios/
```

**Step 4: Restart services**
```bash
docker-compose up -d
```

**Step 5: Verify**
```bash
docker-compose ps
curl http://localhost:5678/api/v1/workflows
```

### Database-Specific Rollback

If database corruption detected during update:

```bash
# Stop n8n only (keep postgres running)
docker-compose stop n8n

# Create backup of corrupted database
docker exec paios-postgres pg_dump -U n8n n8n > /tmp/corrupted-backup.sql

# Restore database from backup
docker exec -i paios-postgres psql -U n8n n8n < /tmp/postgres-backup-$(date +%s).sql

# Restart n8n
docker-compose up -d n8n
```

### Rollback Testing

**Monthly rollback drill:**
1. Provision temporary test VPS
2. Restore from 30-day-old backup
3. Verify workflows execute correctly
4. Decommission test VPS

---

## 9. Monitoring & Alerting

### Health Checks

**n8n Endpoint:**
```bash
curl -s http://localhost:5678/api/v1/health | jq '.status'
```

**Container Status:**
```bash
docker-compose ps
docker stats --no-stream
```

**Disk Space:**
```bash
df -h /opt/paios/volumes/
du -sh /opt/paios/volumes/*
```

### Monitoring Script

Create `/opt/paios/scripts/monitor.sh`:

```bash
#!/bin/bash

THRESHOLD_DISK=80  # Alert if > 80% full
THRESHOLD_CPU=75   # Alert if > 75%

# Check disk usage
DISK_USAGE=$(df /opt/paios | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt $THRESHOLD_DISK ]; then
  echo "ALERT: Disk usage at ${DISK_USAGE}%" | \
    curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"PAIOS Disk Alert: ${DISK_USAGE}%\"}" \
    $TELEGRAM_WEBHOOK_URL
fi

# Check n8n health
if ! curl -s http://localhost:5678/api/v1/health | grep -q "ok"; then
  echo "ALERT: n8n health check failed" | \
    curl -X POST -H 'Content-type: application/json' \
    --data '{"text":"PAIOS Alert: n8n health check failed"}' \
    $TELEGRAM_WEBHOOK_URL
fi

# Check backup age
LATEST_BACKUP=$(restic snapshots --json | jq -r '.[0].time')
BACKUP_AGE=$(( ($(date +%s) - $(date -d "$LATEST_BACKUP" +%s)) / 3600 ))
if [ $BACKUP_AGE -gt 25 ]; then  # Alert if > 25 hours
  echo "ALERT: Backup is ${BACKUP_AGE} hours old" | \
    curl -X POST -H 'Content-type: application/json' \
    --data "{\"text\":\"PAIOS Alert: Backup is ${BACKUP_AGE}h old\"}" \
    $TELEGRAM_WEBHOOK_URL
fi
```

**Add to crontab:**
```bash
# Run every 6 hours
0 */6 * * * /opt/paios/scripts/monitor.sh
```

### Alerting Integration

Send alerts to Telegram (via n8n webhook):

```bash
# Test alert
curl -X POST \
  -H "Content-type: application/json" \
  -d '{"text":"PAIOS: Test alert at $(date)"}' \
  $TELEGRAM_WEBHOOK_URL
```

---

## 10. Migration Checklist

### Pre-Migration (Local Environment)

- [ ] All M1-M4 workflows tested locally
- [ ] Backup created and restore tested
- [ ] .env configured with production secrets
- [ ] Cloudflare DNS records created
- [ ] OVH VPS provisioned and initial SSH access verified

### VPS Provisioning

- [ ] OVH account active
- [ ] VPS provisioned: Ubuntu 22.04 LTS, 2CPU/4GB RAM/50GB SSD
- [ ] Root SSH access verified
- [ ] Non-root user created (paios)
- [ ] Firewall configured (SSH only)
- [ ] fail2ban or similar installed

### VPS Environment Setup

- [ ] Docker installed: `curl -fsSL https://get.docker.com | sh`
- [ ] Docker Compose installed: `curl -L https://github.com/docker/compose/releases/download/latest/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose`
- [ ] Repository cloned to `/opt/paios`
- [ ] .env file created with production values
- [ ] Tailscale installed and authenticated
- [ ] SSH keys configured for git access

### Docker Deployment

- [ ] `docker-compose pull` (download latest images)
- [ ] `docker-compose up -d` (start services)
- [ ] `docker-compose ps` (verify all running)
- [ ] `curl http://localhost:5678/api/v1/workflows` (test n8n)
- [ ] n8n UI accessible via Tailscale IP

### Data & Workflow Import

- [ ] Workflows imported into VPS n8n
- [ ] Credentials updated (API keys, tokens)
- [ ] Telegram notification tested
- [ ] M3 workflow scheduled (08:00 UTC)
- [ ] M4 workflows scheduled (08:05, 09:00 UTC)
- [ ] First workflow execution succeeds

### DNS & Public Access

- [ ] Cloudflare DNS resolves to VPS IP
- [ ] HTTPS connection works: `curl https://paios.example.com`
- [ ] n8n accessible via public domain (if configured)
- [ ] SSL certificate valid (check expiration)

### Backup Configuration

- [ ] Restic initialized and repository created
- [ ] First backup executed successfully
- [ ] Cron job configured for daily backups
- [ ] Backup verification script running
- [ ] Monitoring alerts configured

### Post-Migration Verification

- [ ] Run full workflow cycle (M3 → M4 → qa-news)
- [ ] Verify output in Vault and on public display page
- [ ] Check backup size and age
- [ ] Test restore procedure on temporary VPS
- [ ] Monitor logs for 24 hours (no errors)
- [ ] Decommission local n8n (optional, keep for fallback)

### Fallback Plan

- [ ] Local backup taken before DNS cutover
- [ ] Local n8n remains running for 48 hours post-migration
- [ ] DNS rollback procedure documented (Cloudflare UI steps)
- [ ] Communication to users about potential downtime (if applicable)

---

## Troubleshooting

### n8n Won't Start
```bash
# Check logs
docker-compose logs n8n | tail -50

# Verify database connection
docker exec paios-n8n n8n server --help

# Restart with clean state (caution)
docker-compose down
rm -rf volumes/n8n-data/*
docker-compose up -d
```

### Backup Failures
```bash
# Check Restic status
restic snapshots

# Test S3 connectivity
restic list blobs

# Re-initialize if corrupted
restic init  # Creates new repository
```

### Tailscale Connection Lost
```bash
# VPS troubleshooting
sudo tailscale status
sudo systemctl restart tailscaled

# macOS troubleshooting
tailscale logout
tailscale up
```

### Disk Full
```bash
# Find large files
du -sh /opt/paios/volumes/* | sort -hr

# Clean old logs
find /opt/paios/volumes/logs -mtime +30 -delete

# Prune old backups
restic forget --keep-daily 30 --prune
```

---

## References

- [n8n Documentation](https://docs.n8n.io/)
- [Docker Compose Reference](https://docs.docker.com/compose/compose-file/)
- [Restic Backup Documentation](https://restic.readthedocs.io/)
- [Tailscale Setup Guide](https://tailscale.com/kb/1002/linux-server-setup)
- [Cloudflare DNS Documentation](https://developers.cloudflare.com/dns/)
- [OVH VPS Documentation](https://guides.ovh.com/server/)

---

**Document History:**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-13 | Initial comprehensive deployment plan (P1-D2) |

