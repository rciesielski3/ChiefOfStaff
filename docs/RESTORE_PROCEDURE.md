# PAIOS Restore Procedure

Complete step-by-step guide to rebuild PAIOS from scratch in both local (development) and VPS (production) environments. These procedures assume no prior project knowledge and are designed to be executable by operations team members unfamiliar with the codebase.

**Estimated Time:**
- Local Restore: 10-15 minutes
- VPS Restore: 30-45 minutes

---

## Part 1: Local Restore (macOS Docker)

Complete this procedure to restore PAIOS on your local development machine or to recover from a corrupted local environment.

### Prerequisites

- macOS 10.15 or later
- Internet connection
- Git installed and configured
- Administrator access to your machine
- At least 10 GB free disk space

### Step 1: Install Docker Desktop

1. Download Docker Desktop from https://www.docker.com/products/docker-desktop
2. Install Docker Desktop following the official installation guide
3. Start Docker Desktop from Applications
4. Verify Docker is running: Open Terminal and run:
   ```bash
   docker --version
   docker compose version
   ```
   Expected output: Docker version 20.10+ and Docker Compose version 2.0+

### Step 2: Clone Repositories

Clone the required repositories into a working directory:

```bash
# Create a working directory for PAIOS
mkdir -p ~/paios
cd ~/paios

# Clone the main PAIOS repository
git clone <PAIOS_REPO_URL> paios
cd paios

# Verify you're on the main branch
git branch
```

### Step 3: Create Environment Configuration

Create a `.env` file in the PAIOS root directory with all required variables:

```bash
# Copy the example configuration
cp .env.example .env

# Edit .env with your specific values
# Required variables must be set:
# - TELEGRAM_BOT_TOKEN: Your Telegram bot API token
# - TELEGRAM_CHAT_ID: Your Telegram chat ID for messages
# - OPENAI_API_KEY: OpenAI API key for LLM features
# - Other variables as specified in .env.example
```

**Important:** Do not commit `.env` to version control. It contains secrets.

Verify all required variables are present:
```bash
grep -E "^[A-Z_]+=" .env | wc -l
```

### Step 4: Start Docker Compose

Start the PAIOS system using Docker Compose:

```bash
# From the paios directory
docker compose up -d

# Verify all containers are running
docker compose ps
```

Expected output: All containers showing "Up" status
- n8n: The workflow automation engine
- postgres: Database for n8n and vault storage

**Note:** The current MVP deployment (verified 2026-07-14) does not include a vault service. Vault integration (git-based document storage) can be added in future iterations if needed.

### Step 5: Import n8n Workflows

Access n8n and import workflows:

1. Open n8n in your browser: http://localhost:5678
2. Log in with your n8n credentials (or set them up if first time)
3. Import workflows from the repository:
   ```bash
   # Create workflows directory in n8n container
   docker compose exec n8n mkdir -p /home/node/.n8n/workflows
   
   # Copy workflow JSON files into n8n container
   docker cp workflows/*.json n8n:/home/node/.n8n/workflows/
   
   # Or use n8n UI to import: Settings > Import Workflows
   ```

**Key workflows to verify:**
- M3 Daily Brief: Scheduled workflow that runs daily
- M4 QA News: Knowledge layer and article persistence
- M3-M4 Integration: Ensures M3 output feeds into M4

### Step 6: Verify Core Functions

Verify that all core functions are operational:

```bash
# Verify database connectivity
docker compose exec postgres psql -U paios -d paios -c "\dt"

# Check n8n logs for errors
docker compose logs n8n | tail -30

# Verify n8n API is responsive
curl -s http://localhost:5678 | head -c 100

# Check database table count (should be 100+)
docker compose exec postgres psql -U paios -d paios -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';"

# Verify latest.json export file exists
test -f qa-news/public/latest.json && echo "✓ latest.json exists" || echo "✗ latest.json not found"

# Optional: Check vault commits (only if vault service is deployed)
# docker compose exec vault git log --oneline | head -5

# Optional: Test Telegram connectivity
# Send a test message from n8n workflow UI in browser
# Expected: Message appears in your Telegram chat
```

### Step 7: Enable Scheduled Jobs

Enable daily scheduled workflows in n8n UI:

1. Navigate to n8n UI: http://localhost:5678
2. For each workflow that should run on a schedule:
   - Open the workflow
   - Click "Settings" (gear icon)
   - Enable "Active" toggle
   - Verify the cron schedule matches requirements:
     - M3 Daily Brief: 08:00 UTC
     - M4 Export: 08:05 UTC

### Verification Checklist

Verify the restore is complete:

- [ ] Docker containers running (`docker compose ps`)
- [ ] n8n accessible at http://localhost:5678
- [ ] Workflows imported and visible in n8n UI
- [ ] Database tables created (100+ tables via psql)
- [ ] latest.json export file exists (qa-news/public/latest.json)
- [ ] Scheduled jobs are enabled in n8n
- [ ] No errors in Docker logs (`docker compose logs`)
- [ ] All volumes mounted correctly (`docker compose exec n8n ls -la /home/node/.n8n`)
- [ ] (Optional) Telegram test message sent successfully
- [ ] (Optional) Vault storage has git history (only if vault service deployed)

### Rollback (If Something Goes Wrong)

If the restore fails, clean up and start over:

```bash
# Stop and remove all containers and volumes
docker compose down -v

# Alternatively, remove Docker volumes manually to start fresh
# docker volume rm paios_n8n_data paios_postgres_data

# Start from Step 4 (Start Docker Compose)
docker compose up -d
```

---

## Part 2: VPS Restore (Ubuntu 22.04 on OVH)

Complete this procedure to restore PAIOS on a production VPS. This is the primary deployment target for PAIOS and represents the production environment.

### Prerequisites

- OVH VPS instance running Ubuntu 22.04 LTS
- SSH access to the VPS with root or sudo privileges
- Cloudflare DNS access (for domain configuration)
- Internet connection with adequate bandwidth for backup restoration
- At least 50 GB free disk space (for application and backups)
- Access to backup storage (Restic repository or S3 bucket)

### Step 1: Provision and Access VPS

#### 1.1 Verify VPS Status

Confirm your OVH VPS is provisioned and running:

```bash
# From your local machine, SSH into the VPS
ssh root@<VPS_IP_ADDRESS>

# Verify Ubuntu version
lsb_release -a
# Expected: Ubuntu 22.04 LTS

# Verify available disk space
df -h /
# Expected: At least 50 GB available

# Verify available memory
free -h
# Expected: At least 4 GB RAM
```

#### 1.2 Update System Packages

Update the VPS to the latest patches:

```bash
sudo apt-get update
sudo apt-get upgrade -y
sudo apt-get autoremove -y
```

#### 1.3 Configure Hostname and Timezone

```bash
# Set hostname (replace PAIOS-VPS with your desired name)
sudo hostnamectl set-hostname paios-vps

# Set timezone to UTC
sudo timedatectl set-timezone UTC
sudo timedatectl
```

#### 1.4 Configure Firewall

Enable UFW and open required ports:

```bash
sudo ufw enable
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw allow 5678/tcp  # n8n (if exposing directly)
sudo ufw status
```

### Step 2: Install Docker and Docker Compose

#### 2.1 Install Docker Engine

```bash
# Remove old versions if present
sudo apt-get remove docker docker.io containerd runc || true

# Install Docker from official repository
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add current user to docker group (optional, for non-root access)
sudo usermod -aG docker $USER
newgrp docker

# Verify Docker installation
docker --version
docker run hello-world
```

#### 2.2 Install Docker Compose

```bash
# Download Docker Compose binary
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose

# Make executable
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker-compose --version
```

### Step 3: Clone Repositories to Production Directory

```bash
# Create production application directory
sudo mkdir -p /opt/paios
sudo chown -R $USER:$USER /opt/paios
cd /opt/paios

# Clone PAIOS repository
git clone <PAIOS_REPO_URL> .

# Verify clone was successful
git status
```

### Step 4: Configure Tailscale

Configure Tailscale for secure access from your local machine to the VPS:

#### 4.1 Install Tailscale

```bash
curl -fsSL https://tailscale.com/install.sh | sh

# Start Tailscale daemon
sudo systemctl start tailscale
sudo systemctl enable tailscale
```

#### 4.2 Authenticate with Tailscale

```bash
# Authenticate your VPS with your Tailscale account
sudo tailscale up

# Follow the provided URL to authenticate in your browser
# You will receive a Tailscale IP address (e.g., 100.x.x.x)

# Verify connection
sudo tailscale ip -4
```

#### 4.3 Test Tailscale Connectivity

From your local machine:

```bash
# Find your VPS Tailscale IP
tailscale list

# SSH via Tailscale IP (more secure than direct IP)
ssh root@<TAILSCALE_VPS_IP>
```

### Step 5: Create Production Environment Configuration

Create `.env` file with production secrets on the VPS:

```bash
cd /opt/paios

# Create .env with production values
cat > .env << 'EOF'
# n8n Configuration
N8N_ENCRYPTION_KEY=<GENERATE_SECURE_KEY>
N8N_DB_TYPE=postgres
N8N_DB_HOST=postgres
N8N_DB_NAME=paios
N8N_DB_USER=paios
N8N_DB_PASSWORD=<GENERATE_SECURE_PASSWORD>

# Telegram Configuration
TELEGRAM_BOT_TOKEN=<YOUR_TELEGRAM_BOT_TOKEN>
TELEGRAM_CHAT_ID=<YOUR_TELEGRAM_CHAT_ID>

# OpenAI Configuration
OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>

# Vault Configuration
VAULT_GIT_REPO=<GIT_REPO_URL>
VAULT_GIT_USERNAME=<GIT_USERNAME>
VAULT_GIT_TOKEN=<GIT_PERSONAL_ACCESS_TOKEN>

# Restic Backup Configuration
RESTIC_REPOSITORY=/backup/restic-repo
RESTIC_PASSWORD=<GENERATE_SECURE_PASSWORD>

# Domain Configuration
PAIOS_DOMAIN=<YOUR_DOMAIN>

# PostgreSQL
POSTGRES_USER=paios
POSTGRES_PASSWORD=<GENERATE_SECURE_PASSWORD>
POSTGRES_DB=paios
POSTGRES_HOST=postgres

EOF

# Verify the file is created and secured
ls -la .env
chmod 600 .env
```

**Important Security Notes:**
- Generate strong random passwords for `N8N_DB_PASSWORD`, `RESTIC_PASSWORD`, and `POSTGRES_PASSWORD`
- Use a long random string for `N8N_ENCRYPTION_KEY` (at least 32 characters)
- Do not commit `.env` to git
- Store backup copies of secrets in a secure vault (KeePass, 1Password, etc.)

### Step 6: Start Docker Compose on VPS

Start all services:

```bash
cd /opt/paios

# Start services in background
docker-compose up -d

# Verify all containers are running
docker-compose ps

# Expected output: All containers showing "Up" status
```

Monitor startup for any errors:

```bash
# Check logs for any startup issues
docker-compose logs -f n8n | head -50

# Check if n8n is accessible (wait 30 seconds for startup)
sleep 30
curl http://localhost:5678/rest/health
```

### Step 7: Import n8n Workflows

Import production workflows:

```bash
# Copy workflows to n8n container
docker-compose cp workflows/. n8n:/home/node/.n8n/workflows/

# Restart n8n to load workflows
docker-compose restart n8n

# Verify n8n is running
docker-compose logs n8n | grep -i "listening\|started"
```

Access n8n UI (via Tailscale):

```bash
# From your local machine, SSH tunnel to n8n via Tailscale
ssh -L 5678:localhost:5678 root@<TAILSCALE_VPS_IP>

# Then open in browser: http://localhost:5678
```

Verify workflows imported:
- [ ] M3 Daily Brief workflow present
- [ ] M4 QA News workflow present
- [ ] Integration between M3 and M4 configured

### Step 8: Restore Backups from Restic

Restore data from your backup repository:

```bash
# Set Restic environment variables
export RESTIC_REPOSITORY=/backup/restic-repo
export RESTIC_PASSWORD="<YOUR_RESTIC_PASSWORD>"

# List available snapshots
restic snapshots

# List contents of latest snapshot
restic ls latest

# Restore latest snapshot to restore directory
restic restore latest --target /opt/paios/restore

# Verify restore
ls -la /opt/paios/restore/
```

**Restore Data from Backup:**

If you have a previous backup, restore critical data:

```bash
# Restore vault data (document storage)
docker-compose exec vault git pull

# Restore PostgreSQL data (if backed up)
# This depends on your backup strategy - consult BACKUP_RESTORE.md

# Restore n8n settings and execution history
docker-compose exec n8n n8n db:import < /path/to/n8n_backup.db
```

### Step 9: Verify Core Functions on VPS

Verify that all systems are operational:

```bash
# Check Telegram connectivity
# Manually trigger test workflow in n8n UI
# Expected: Test message appears in your Telegram chat

# Verify database connectivity
docker-compose exec postgres psql -U paios -c "\dt"

# Check vault (should have commit history)
docker-compose exec vault git log --oneline | head -5

# Verify n8n API is accessible
curl http://localhost:5678/rest/health

# Check system resources
docker stats --no-stream
free -h
df -h /
```

### Step 10: Configure Cloudflare DNS

Point your domain to the VPS via Cloudflare DNS:

1. Log in to Cloudflare dashboard for your domain
2. Navigate to DNS settings
3. Add or update A record:
   - **Name:** paios (or your subdomain)
   - **Type:** A
   - **Content:** <VPS_PUBLIC_IP_ADDRESS>
   - **TTL:** Auto
   - **Proxy:** DNS only (initially)

4. Configure SSL/TLS:
   - Go to SSL/TLS settings
   - Set to "Full (strict)"
   - Configure origin server certificate if needed

5. Verify DNS propagation:
   ```bash
   nslookup paios.yourdomain.com
   dig paios.yourdomain.com
   ```

### Step 11: Test End-to-End Functionality

Test complete system operation:

```bash
# Test n8n accessibility from internet
curl https://paios.yourdomain.com/rest/health

# Or access via browser: https://paios.yourdomain.com

# Test workflow execution
# Manually trigger M3 workflow in n8n UI
# Wait for completion

# Verify M3 output in vault
docker-compose exec vault git log --all --grep="M3" | head -10

# Verify M4 integration (article persistence)
docker-compose exec postgres psql -U paios -c "SELECT COUNT(*) FROM articles;"

# Test Telegram notification
# Send test message from n8n workflow
# Expected: Message received in configured Telegram chat

# Verify scheduled jobs
# In n8n UI, check workflow schedules:
# - M3 Daily Brief: 08:00 UTC
# - M4 Export: 08:05 UTC
```

### Step 12: Set Up Automated Backups

Configure automatic backups using Restic:

```bash
# Create backup directory
sudo mkdir -p /backup/restic-repo
sudo chown $USER:$USER /backup/restic-repo

# Initialize Restic repository
export RESTIC_REPOSITORY=/backup/restic-repo
export RESTIC_PASSWORD="<YOUR_RESTIC_PASSWORD>"
restic init

# Create backup script
cat > /opt/paios/backup.sh << 'EOF'
#!/bin/bash
export RESTIC_REPOSITORY=/backup/restic-repo
export RESTIC_PASSWORD="your-password-here"

# Backup application and data
restic backup /opt/paios /var/lib/docker/volumes

# Clean old snapshots (keep last 30 days)
restic forget --keep-daily 30 --prune

EOF

chmod +x /opt/paios/backup.sh

# Schedule backup daily at 02:00 UTC
sudo crontab -e
# Add line: 0 2 * * * /opt/paios/backup.sh >> /var/log/paios-backup.log 2>&1
```

### Verification Checklist

Verify the VPS restore is complete and operational:

- [ ] VPS provisioned with Ubuntu 22.04 LTS
- [ ] SSH access working via direct IP and Tailscale
- [ ] Docker and Docker Compose installed
- [ ] Repositories cloned to /opt/paios
- [ ] `.env` configured with production secrets
- [ ] Tailscale configured and connected
- [ ] Docker Compose services running (`docker-compose ps`)
- [ ] n8n accessible at http://localhost:5678
- [ ] Workflows imported and visible in n8n UI
- [ ] Telegram test message sent successfully
- [ ] Backups restored (if restoring from previous backup)
- [ ] Vault has commit history
- [ ] PostgreSQL accessible and database exists
- [ ] Cloudflare DNS resolves domain to VPS IP
- [ ] System resources healthy (disk, memory, CPU)
- [ ] Scheduled jobs enabled (M3 at 08:00, M4 at 08:05 UTC)
- [ ] End-to-end test workflow executed successfully
- [ ] Automated backup job scheduled

### Rollback (If Something Goes Wrong)

If the VPS restore fails at any stage:

```bash
# Stop all containers without removing volumes
docker-compose stop

# To start fresh, remove everything
docker-compose down -v
docker volume prune -f

# Clean up application directory
cd /
sudo rm -rf /opt/paios

# Start from Step 3 (Clone Repositories)
```

---

## Troubleshooting

### Local Issues

**Docker won't start:**
- Verify Docker Desktop is installed and running
- Check System Preferences > Security & Privacy for Docker permissions
- Try restarting Docker Desktop

**n8n not accessible at http://localhost:5678:**
- Verify container is running: `docker-compose ps n8n`
- Check logs: `docker-compose logs n8n`
- Verify port 5678 is not in use: `lsof -i :5678`
- Try restarting: `docker-compose restart n8n`

**Workflows won't import:**
- Verify workflows directory structure matches n8n expectations
- Check n8n logs for import errors
- Use n8n UI import feature as fallback (Settings > Import)

**Telegram test fails:**
- Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` in `.env`
- Check Telegram bot is running (BotFather)
- Verify chat exists and bot is member

### VPS Issues

**SSH connection fails:**
- Verify VPS IP address is correct
- Check firewall allows port 22: `sudo ufw status`
- Verify SSH key permissions: `chmod 600 ~/.ssh/id_rsa`

**Docker Compose services won't start:**
- Check logs: `docker-compose logs`
- Verify `.env` has all required variables
- Ensure sufficient disk space: `df -h /`
- Check Docker daemon is running: `systemctl status docker`

**Backup restore fails:**
- Verify Restic repository exists: `ls -la /backup/restic-repo`
- Check Restic password is correct
- Verify sufficient disk space for restore
- Check backup file integrity: `restic check`

**Cloudflare DNS not resolving:**
- Verify DNS records in Cloudflare dashboard
- Wait for DNS propagation (up to 24 hours)
- Clear local DNS cache: `sudo dscacheutil -flushcache` (macOS)
- Test with: `nslookup paios.yourdomain.com`

---

## References

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [n8n Official Docs](https://docs.n8n.io/)
- [Restic Backup Guide](https://restic.readthedocs.io/)
- [Tailscale Setup](https://tailscale.com/docs/installation)
- [Cloudflare DNS Setup](https://developers.cloudflare.com/dns/)
- See also: `docs/OPERATIONS_CHECKLIST.md` for post-restore verification
- See also: `docs/BACKUP_RESTORE.md` for backup strategy details

---

**Last Updated:** 2026-07-13
**Status:** Production Ready
**Owner:** Operations Team
