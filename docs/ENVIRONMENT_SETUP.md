# Environment Setup Guide

Complete guide to configuring environment variables for PAIOS local development and VPS deployment.

**Table of Contents:**
1. [Quick Start](#quick-start)
2. [Environment Variables Reference](#environment-variables-reference)
3. [Obtaining Required Credentials](#obtaining-required-credentials)
4. [Configuration by Deployment Type](#configuration-by-deployment-type)
5. [Security Best Practices](#security-best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Quick Start

### For Local Development

```bash
# 1. Copy the template
cp .env.example .env

# 2. Edit .env with your local values
# Required: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, OPENAI_API_KEY, paths
nano .env

# 3. Verify your .env file
grep -E "^[A-Z_]+=" .env | wc -l

# 4. Start PAIOS
docker-compose up -d

# 5. Verify environment is loaded
docker-compose exec n8n env | grep -E "N8N_|TELEGRAM_|EXPORT_"
```

### For VPS Deployment

```bash
# On your VPS:
cd /opt/paios
cp .env.example .env

# Edit with production values (see Configuration by Deployment Type)
# Use a secure editor or cat with heredoc to avoid history

# Set secure permissions
chmod 600 .env

# Start services
docker-compose up -d
```

---

## Environment Variables Reference

### n8n Configuration

#### N8N_ENCRYPTION_KEY
- **Type:** String (32+ random characters)
- **Required:** Yes
- **Description:** Encryption key for sensitive n8n data (credentials, execution history)
- **How to Generate:**
  ```bash
  openssl rand -base64 24
  # Output: example: 1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q
  ```
- **Deployment:** Same key should be used consistently for the same n8n instance

#### N8N_USER_MANAGEMENT_JWT_SECRET
- **Type:** String (32+ random characters)
- **Required:** Yes
- **Description:** Secret key for JWT token generation (user authentication)
- **How to Generate:**
  ```bash
  openssl rand -base64 24
  ```
- **Note:** Change this to force all users to re-authenticate

#### N8N_HOST
- **Type:** String
- **Required:** No (default: localhost)
- **Description:** Hostname n8n listens on
- **Local Development:** `localhost` or `0.0.0.0` (for Docker)
- **VPS:** `0.0.0.0` (to accept external connections via reverse proxy)

#### N8N_PORT
- **Type:** Integer
- **Required:** No (default: 5678)
- **Description:** Port n8n listens on
- **Local Development:** `5678`
- **VPS:** `5678` (accessed via reverse proxy or SSH tunnel)

#### N8N_PROTOCOL
- **Type:** String (http or https)
- **Required:** No (default: http)
- **Description:** Protocol for n8n server
- **Local Development:** `http`
- **VPS:** `http` (reverse proxy handles HTTPS)

#### N8N_BASIC_AUTH_ACTIVE
- **Type:** Boolean (true or false)
- **Required:** No (default: false)
- **Description:** Enable basic HTTP authentication
- **Local Development:** `false` (easier testing)
- **VPS:** `false` (use reverse proxy authentication)

#### N8N_API_GATEWAY_AUTH (Hardcoded)
- **Type:** String
- **Value:** `none` (hardcoded in docker-compose.yml line 37)
- **Required:** No (not user-configurable for MVP)
- **Description:** API gateway authentication mode
- **Note:** This is hardcoded in docker-compose.yml and cannot be overridden via .env for MVP. To change this in the future, update docker-compose.yml

#### N8N_ENABLE_AUTHORIZATION (Hardcoded)
- **Type:** Boolean
- **Value:** `false` (hardcoded in docker-compose.yml line 38)
- **Required:** No (not user-configurable for MVP)
- **Description:** Enable n8n authorization/permission system
- **Note:** This is hardcoded in docker-compose.yml and cannot be overridden via .env for MVP. To change this in the future, update docker-compose.yml

#### N8N_DB_TYPE
- **Type:** String (postgres or sqlite)
- **Required:** No (default: sqlite)
- **Description:** Database engine for n8n
- **Local Development:** `sqlite` (no setup needed) or `postgres` (if using external DB)
- **VPS:** `postgres` (recommended for production)

#### NODE_ENV
- **Type:** String (development, production, test)
- **Required:** No (default: development)
- **Description:** Node.js environment mode
- **Local Development:** `development`
- **VPS:** `production`

#### GENERIC_TIMEZONE
- **Type:** String (IANA timezone)
- **Required:** No (default: UTC)
- **Description:** Timezone for scheduled workflows
- **Recommended:** Always use `UTC` for consistent scheduling across regions

### Database Configuration

#### N8N_DB_HOST
- **Type:** String (hostname or IP)
- **Required:** Yes (if N8N_DB_TYPE=postgres)
- **Description:** PostgreSQL server hostname
- **Local Development:** `postgres` (Docker service name) or `localhost`
- **VPS:** `postgres` (Docker service name)

#### N8N_DB_PORT
- **Type:** Integer
- **Required:** No (default: 5432)
- **Description:** PostgreSQL port
- **Default:** 5432

#### N8N_DB_NAME
- **Type:** String
- **Required:** Yes (if N8N_DB_TYPE=postgres)
- **Description:** PostgreSQL database name
- **Recommended:** `paios` (matches docker-compose.yml)

#### N8N_DB_USER
- **Type:** String
- **Required:** Yes (if N8N_DB_TYPE=postgres)
- **Description:** PostgreSQL username
- **Recommended:** `paios` (matches docker-compose.yml)

#### N8N_DB_PASSWORD
- **Type:** String
- **Required:** Yes (if N8N_DB_TYPE=postgres)
- **Description:** PostgreSQL user password
- **Must be:** Secure, random string (generate with `openssl rand -base64 32`)
- **Storage:** Keep in secure vault (1Password, KeePass)

#### POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
- **Type:** String
- **Required:** Yes (if using postgres container)
- **Description:** PostgreSQL container environment
- **Must match:** N8N_DB_* values

#### POSTGRES_HOST
- **Type:** String (hostname or IP)
- **Required:** No (default: postgres)
- **Description:** PostgreSQL server hostname for external connections
- **Local Development:** `postgres` (Docker service name)
- **VPS:** `postgres` (Docker service name) or external hostname if using managed database
- **Note:** This variable is used when connecting to PostgreSQL from other services or tools (not directly by n8n, which uses N8N_DB_HOST)

### Telegram Integration

#### TELEGRAM_BOT_TOKEN
- **Type:** String (format: `123456789:ABCdefGhIjKlMnOpQrStUvWxYzAbCdEfg`)
- **Required:** Yes (for Telegram notifications)
- **Description:** Authentication token for your Telegram bot
- **How to Obtain:**
  1. Open Telegram and search for `@BotFather`
  2. Send `/newbot` command
  3. Choose a name (e.g., "PAIOS Daily Brief")
  4. Choose a username (e.g., "paios_daily_bot")
  5. BotFather returns your token
  6. Copy the token to `.env`
- **Security:** Never share this token; treat as secret
- **Expiration:** Tokens don't expire naturally (remains valid until revoked)

#### TELEGRAM_CHAT_ID
- **Type:** Integer or string
- **Required:** Yes (for Telegram notifications)
- **Description:** Telegram chat ID where bot sends messages
- **How to Obtain:**
  1. Start your bot: Send any message to your bot
  2. Get updates: `curl https://api.telegram.org/bot{TOKEN}/getUpdates`
  3. Look for `chat.id` in the response
  4. Use that number as TELEGRAM_CHAT_ID
- **Examples:**
  - Private chat with bot: `-123456789`
  - Group chat: Negative number starting with `-100`
  - Channel: Negative number starting with `-100`

### OpenAI API

#### OPENAI_API_KEY
- **Type:** String (format: `sk-proj-...`)
- **Required:** Yes (for LLM features: scoring, summarization)
- **Description:** API key for OpenAI API access
- **How to Obtain:**
  1. Go to https://platform.openai.com/api-keys
  2. Log in with your OpenAI account (create if needed)
  3. Click "Create new secret key"
  4. Copy key to `.env`
- **Security:** Never share; rotate periodically
- **Costs:** Billed per API call; monitor usage on OpenAI dashboard
- **Rate Limits:** Free tier: limited; paid: per pricing plan

### PAIOS Vault & File Paths

#### PAIOS_VAULT_PATH
- **Type:** String (file path)
- **Required:** Yes
- **Description:** Path to paios-vault git repository (document storage)
- **Local Development:** `~/paios-vault` or `${HOME}/paios-vault`
- **VPS:** `/opt/paios-vault`
- **Setup:** Clone separately before starting PAIOS
  ```bash
  git clone https://github.com/your-org/paios-vault.git ~/paios-vault
  ```

#### EXPORT_FILE_PATH
- **Type:** String (file path)
- **Required:** Yes
- **Description:** Where export-latest-news workflow writes latest.json
- **Local Development:** `qa-news/public/latest.json` (relative to project root)
- **VPS:** `/opt/paios/qa-news/public/latest.json` (absolute path)
- **Note:** Workflow creates file automatically; directory must exist

#### VAULT_GIT_REPO
- **Type:** String (git URL)
- **Required:** No (optional, for automated git sync)
- **Description:** Git repository URL for vault (enables auto-commit)
- **Example:** `https://github.com/your-org/paios-vault.git`
- **Note:** Leave empty if vault is local-only

#### VAULT_GIT_USERNAME
- **Type:** String
- **Required:** No (only if VAULT_GIT_REPO is set)
- **Description:** GitHub username for vault commits
- **Usage:** Used for git commit author and credentials

#### VAULT_GIT_TOKEN
- **Type:** String
- **Required:** No (only if VAULT_GIT_REPO is set)
- **Description:** GitHub personal access token for vault git operations
- **How to Obtain:**
  1. Go to https://github.com/settings/tokens
  2. Click "Generate new token (classic)"
  3. Select scopes: `repo` (full control of private repos)
  4. Copy token to `.env`
- **Security:** Treat as secret; rotate regularly

### Backup Configuration (Restic)

#### RESTIC_PASSWORD
- **Type:** String (32+ random characters)
- **Required:** No (only for VPS backup automation)
- **Description:** Password for Restic backup encryption
- **How to Generate:**
  ```bash
  openssl rand -base64 32
  ```
- **Note:** Must be backed up securely; loss of password loses backup access

#### RESTIC_REPOSITORY
- **Type:** String (path or S3 URL)
- **Required:** No (only for backup automation)
- **Description:** Where Restic stores backup snapshots
- **Local:** `/backup/restic-repo` (must be on persistent volume)
- **S3:** `s3://s3.amazonaws.com/bucket-name/paios`
- **Setup (local):**
  ```bash
  mkdir -p /backup/restic-repo
  export RESTIC_REPOSITORY=/backup/restic-repo
  export RESTIC_PASSWORD="your-password"
  restic init
  ```

### AWS S3 Backup Configuration

#### AWS_ACCESS_KEY_ID
- **Type:** String
- **Required:** No (only if using S3 backups)
- **Description:** AWS access key for S3 operations
- **How to Obtain:**
  1. Go to https://console.aws.amazon.com/iam
  2. Create new user or use existing
  3. Create access key
  4. Copy to `.env`
- **Security:** Rotate periodically; never share

#### AWS_SECRET_ACCESS_KEY
- **Type:** String
- **Required:** No (only if using S3 backups)
- **Description:** AWS secret access key for S3 operations
- **Security:** Treat as highly sensitive secret

### Tailscale (VPS only)

#### TAILSCALE_AUTH_KEY
- **Type:** String
- **Required:** No (VPS only, for secure access)
- **Description:** Tailscale authentication key for VPS network
- **How to Obtain:**
  1. Go to https://login.tailscale.com/admin/settings/keys
  2. Click "Generate auth key"
  3. Copy to `.env` on VPS
- **Note:** Auth keys can be restricted to device roles and expiration

### Domain Configuration

#### PAIOS_DOMAIN
- **Type:** String (domain name)
- **Required:** No (optional, for VPS deployment)
- **Description:** Your domain name for external access
- **Example:** `paios.example.com`
- **Used for:** DNS configuration, SSL certificates

### QA News Frontend

#### PAIOS_LATEST_JSON_URL
- **Type:** String (URL)
- **Required:** No (optional, for QA News frontend)
- **Description:** URL or path to latest.json export
- **Local Development:** `/public/latest.json` or `http://localhost:5678/export`
- **Production:** `https://paios.example.com/api/latest`

#### PAIOS_API_URL
- **Type:** String (URL)
- **Required:** No (optional, for QA News frontend)
- **Description:** PAIOS API endpoint for curated content
- **Local Development:** `http://localhost:5678/api`
- **Production:** `https://paios.example.com/api`

---

## Obtaining Required Credentials

### Telegram Bot Token

**Prerequisites:** Telegram account

**Steps:**
1. Open Telegram app or go to https://web.telegram.org
2. Search for user `@BotFather`
3. Send message: `/newbot`
4. Follow prompts:
   - Enter desired bot name (e.g., "PAIOS Daily Brief")
   - Enter bot username (e.g., "paios_daily_bot")
5. BotFather responds with your token
6. Copy token to `.env` as `TELEGRAM_BOT_TOKEN`

**Getting Chat ID:**
1. Send a test message to your new bot
2. Run: `curl https://api.telegram.org/bot<TOKEN>/getUpdates`
3. Find the `chat.id` value in the response
4. Copy to `.env` as `TELEGRAM_CHAT_ID`

### OpenAI API Key

**Prerequisites:** OpenAI account (free or paid)

**Steps:**
1. Go to https://platform.openai.com/account/api-keys
2. Click "Create new secret key"
3. Name it (e.g., "PAIOS")
4. Copy key to `.env` as `OPENAI_API_KEY`
5. Verify access by making test API call:
   ```bash
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY" | head -20
   ```

**Cost Estimation:**
- PAIOS uses GPT-3.5-turbo for scoring/summarization
- Typical usage: 100-300 API calls/day
- Cost: $0.001-0.005 per 1K tokens
- Expected: $5-20/month depending on usage

### GitHub Personal Access Token

**Prerequisites:** GitHub account

**Steps:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: "PAIOS Vault Sync"
4. Expiration: 90 days (rotate regularly)
5. Scopes: Check `repo` (full control of private repositories)
6. Click "Generate token"
7. Copy token to `.env` as `VAULT_GIT_TOKEN`

**Security Note:** Token grants access to all your repositories. Use minimal scope and rotate regularly.

### AWS S3 Credentials (for Backups)

**Prerequisites:** AWS account

**Steps:**
1. Go to https://console.aws.amazon.com/iam/home#/users
2. Click "Add users"
3. Create user (e.g., "paios-backup")
4. Grant permissions: S3 access to specific bucket
5. Create access key
6. Copy `Access Key ID` and `Secret Access Key` to `.env`

**Bucket Setup:**
```bash
# Create S3 bucket
aws s3 mb s3://paios-backups-$(date +%s)

# Test credentials
aws s3 ls
```

### Tailscale Auth Key (VPS only)

**Prerequisites:** Tailscale account

**Steps:**
1. Go to https://login.tailscale.com/admin/settings/keys
2. Click "Generate auth key"
3. Settings:
   - Reusable: Yes (for VPS auto-connect)
   - Expiration: 30-90 days
   - Devices: (optional) Restrict to specific devices
4. Copy key to VPS `.env` as `TAILSCALE_AUTH_KEY`

---

## Configuration by Deployment Type

### Local Development (macOS/Linux Docker)

**Minimal Configuration:**
```bash
# .env for local development (minimum required)
N8N_ENCRYPTION_KEY=$(openssl rand -base64 24)
N8N_USER_MANAGEMENT_JWT_SECRET=$(openssl rand -base64 24)
N8N_HOST=localhost
N8N_PORT=5678
N8N_PROTOCOL=http
NODE_ENV=development
GENERIC_TIMEZONE=UTC

TELEGRAM_BOT_TOKEN=<your-bot-token>
TELEGRAM_CHAT_ID=<your-chat-id>
OPENAI_API_KEY=<your-api-key>

PAIOS_VAULT_PATH=~/paios-vault
EXPORT_FILE_PATH=qa-news/public/latest.json

# SQLite (default, no config needed)
# Leave N8N_DB_* unset to use SQLite
```

**Full Configuration (with PostgreSQL):**
```bash
# All of the above, plus:
N8N_DB_TYPE=postgres
N8N_DB_HOST=postgres
N8N_DB_NAME=paios
N8N_DB_USER=paios
N8N_DB_PASSWORD=$(openssl rand -base64 32)

POSTGRES_USER=paios
POSTGRES_PASSWORD=$(openssl rand -base64 32)
POSTGRES_DB=paios
```

**Verification:**
```bash
# Start services
docker-compose up -d

# Check n8n is running
curl http://localhost:5678/api/v1/health

# Verify environment in container
docker-compose exec n8n env | grep N8N
```

### VPS Deployment (Ubuntu 22.04)

**Secure Setup (recommended):**
```bash
# On VPS, use cat with heredoc to avoid shell history
cd /opt/paios
cat > .env << 'EOF'
# n8n Configuration
N8N_ENCRYPTION_KEY=<generate-new-with-openssl>
N8N_USER_MANAGEMENT_JWT_SECRET=<generate-new-with-openssl>
N8N_HOST=0.0.0.0
N8N_PORT=5678
N8N_PROTOCOL=http
NODE_ENV=production
GENERIC_TIMEZONE=UTC

# Database (PostgreSQL required for production)
N8N_DB_TYPE=postgres
N8N_DB_HOST=postgres
N8N_DB_PORT=5432
N8N_DB_NAME=paios
N8N_DB_USER=paios
N8N_DB_PASSWORD=<generate-with-openssl>

POSTGRES_USER=paios
POSTGRES_PASSWORD=<same-as-above>
POSTGRES_DB=paios

# Credentials
TELEGRAM_BOT_TOKEN=<your-token>
TELEGRAM_CHAT_ID=<your-chat-id>
OPENAI_API_KEY=<your-key>

# Paths (VPS absolute paths)
PAIOS_VAULT_PATH=/opt/paios-vault
EXPORT_FILE_PATH=/opt/paios/qa-news/public/latest.json

# Backup Configuration
RESTIC_PASSWORD=<generate-with-openssl>
RESTIC_REPOSITORY=/backup/restic-repo

# Domain (for DNS/SSL)
PAIOS_DOMAIN=paios.example.com

# Tailscale (for secure access)
TAILSCALE_AUTH_KEY=<your-auth-key>
EOF

# Secure the file
chmod 600 .env

# Backup to secure vault
cp .env /secure/location/paios-.env.backup
```

**Verification:**
```bash
# Check file permissions
ls -la .env  # Should be -rw------- (600)

# Start services
docker-compose up -d

# Check all services running
docker-compose ps

# Verify n8n
curl http://localhost:5678/api/v1/health

# Check backups can be initialized
export RESTIC_PASSWORD="<password>"
export RESTIC_REPOSITORY="/backup/restic-repo"
restic init

# Test backup
restic backup /opt/paios
```

---

## Security Best Practices

### Secrets Management

1. **Never Commit .env to Git**
   ```bash
   # Verify .gitignore has .env
   grep "^.env" .gitignore
   
   # If accidentally committed, remove from history
   git filter-branch --tree-filter 'rm .env' HEAD
   ```

2. **Rotate Secrets Regularly**
   - Telegram: Delete/recreate bot via BotFather
   - OpenAI: Revoke key, generate new
   - GitHub tokens: Set 60-90 day expiration
   - Restic: Change password quarterly
   - AWS: Rotate keys every 90 days

3. **Secure Storage**
   - Store .env locally in: `~/.config/paios/.env` (local dev)
   - Use 1Password, LastPass, or KeePass for secrets
   - Enable encryption on dev machine: FileVault (macOS), BitLocker (Windows)
   - VPS: Use `chmod 600 .env` (owner read/write only)

4. **Access Control**
   - Limit .env access to necessary users only
   - Use different credentials for prod/staging/dev
   - Use separate AWS accounts for backups
   - Enable 2FA on Telegram, GitHub, OpenAI accounts

### Environment-Specific Values

**Keep Separate:**
```bash
# Local development (.env.local or .env.dev)
EXPORT_FILE_PATH=qa-news/public/latest.json

# Staging (.env.staging)
EXPORT_FILE_PATH=/opt/staging/qa-news/public/latest.json

# Production (.env.prod)
EXPORT_FILE_PATH=/opt/paios/qa-news/public/latest.json
```

### Docker Security

1. **Limit Volume Access:**
   ```bash
   # Don't mount entire home directory
   # Bad: - ${HOME}:/home/node
   # Good: - ./qa-news:/opt/qa-news
   ```

2. **Non-Root User:**
   ```dockerfile
   # Use non-root user in custom Dockerfile
   RUN useradd -m appuser
   USER appuser
   ```

3. **Environment Variable Masking:**
   ```bash
   # Check logs don't expose secrets
   docker-compose logs n8n | grep TELEGRAM
   ```

---

## Troubleshooting

### "Missing required variable: TELEGRAM_BOT_TOKEN"

**Cause:** Environment variable not set in .env

**Solutions:**
1. Verify .env exists: `ls -la .env`
2. Check variable is set: `grep TELEGRAM .env`
3. Verify format: `TELEGRAM_BOT_TOKEN=123456789:ABCdef...`
4. Reload environment: `docker-compose restart n8n`

### "Connection refused" when connecting to postgres

**Cause:** N8N_DB_HOST or N8N_DB_PASSWORD incorrect

**Solutions:**
1. Verify postgres is running: `docker-compose ps postgres`
2. Check host value: `grep N8N_DB_HOST .env`
3. For local Docker: Use `postgres` (service name), not `localhost`
4. Test connection: `docker-compose exec postgres psql -U paios -c '\dt'`

### "Telegram message not sent" in workflow

**Cause:** Invalid TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID

**Solutions:**
1. Verify token: `curl https://api.telegram.org/bot{TOKEN}/getMe`
2. Verify chat ID exists (negative for groups/channels)
3. Check bot is member of chat/channel
4. Test manually: 
   ```bash
   curl -X POST https://api.telegram.org/bot{TOKEN}/sendMessage \
     -d chat_id={CHAT_ID} \
     -d text="test"
   ```

### "OpenAI API rate limited"

**Cause:** Too many API calls hitting usage limits

**Solutions:**
1. Check OpenAI usage dashboard
2. Upgrade plan if exceeded free tier
3. Reduce workflow frequency (run less often)
4. Batch requests instead of individual calls
5. Add delays between API calls

### "EXPORT_FILE_PATH: No such file or directory"

**Cause:** Path doesn't exist or is incorrect

**Solutions:**
1. Verify path exists: `ls -la $(grep EXPORT_FILE_PATH .env | cut -d= -f2)`
2. For relative paths, run from correct directory
3. Use absolute paths: `/opt/paios/qa-news/public/latest.json`
4. Create directory if missing: `mkdir -p <path-directory>`

### "PAIOS_VAULT_PATH not accessible"

**Cause:** Vault repository not cloned or path incorrect

**Solutions:**
1. Verify vault exists: `ls -la ~/paios-vault`
2. Clone if missing:
   ```bash
   git clone https://github.com/your-org/paios-vault.git ~/paios-vault
   ```
3. Fix path in .env if needed
4. Verify permissions: `ls -la $(grep PAIOS_VAULT_PATH .env | cut -d= -f2)`

### "Restic password incorrect"

**Cause:** RESTIC_PASSWORD doesn't match initialization password

**Solutions:**
1. Verify password is consistent: `grep RESTIC_PASSWORD .env`
2. Check repository exists: `ls -la /backup/restic-repo`
3. Test with same password: `export RESTIC_PASSWORD="..."; restic snapshots`
4. If lost, repository is inaccessible (keep backups of password!)

### Docker service won't start with error "invalid reference"

**Cause:** .env variable not expanded, or syntax error

**Solutions:**
1. Check .env syntax: `bash -n .env` (should return no errors)
2. Verify no quotes in values: `grep "=" .env`
3. Reload compose: `docker-compose down && docker-compose up -d`

---

## Quick Reference

| Variable | Required | Local Dev | VPS | Secret |
|----------|----------|-----------|-----|--------|
| N8N_ENCRYPTION_KEY | Yes | Yes | Yes | Yes |
| N8N_USER_MANAGEMENT_JWT_SECRET | Yes | Yes | Yes | Yes |
| N8N_HOST | No | localhost | 0.0.0.0 | No |
| N8N_DB_TYPE | No | sqlite | postgres | No |
| TELEGRAM_BOT_TOKEN | Yes | Yes | Yes | Yes |
| TELEGRAM_CHAT_ID | Yes | Yes | Yes | No |
| OPENAI_API_KEY | Yes | Yes | Yes | Yes |
| PAIOS_VAULT_PATH | Yes | ~/paios-vault | /opt/paios-vault | No |
| EXPORT_FILE_PATH | Yes | qa-news/public/latest.json | /opt/paios/qa-news/public/latest.json | No |
| RESTIC_PASSWORD | No | No | Yes | Yes |
| RESTIC_REPOSITORY | No | No | /backup/restic-repo | No |
| TAILSCALE_AUTH_KEY | No | No | Yes | Yes |

---

**Last Updated:** 2026-07-13
**Owner:** Operations Team
