# Security Guide

## Credentials & Secrets

### Storage
- Never commit secrets to git
- Use .env (git-ignored) for local development
- Use Kubernetes secrets / OVH secrets manager for production

### Rotation
- Telegram bot token: Rotate yearly or if compromised
- Database password: Rotate quarterly
- Restic backup password: Store securely, rotate annually
- Tailscale auth key: Revoke unused keys regularly

### Access Control
- Telegram: Private chat only, no public channels
- Vault: Private GitHub repo, no read access from workflows
- n8n: Local access only (no public exposure)
- OVH: SSH keys only, no passwords

---

## API Security

### Rate Limiting
- Telegram: 30 msg/sec per bot (built-in limit)
- GitHub: Check rate limits with `gh api user`
- Reddit: Respect user-agent requirements, backoff on 429s

### Credentials in Workflows
- Never hardcode tokens in workflow definitions
- Use n8n environment variables or secrets
- Audit: Check n8n workflows for exposed credentials

---

## Network Security

### Local Development
- n8n accessible only on localhost (not exposed)
- Vault on local machine (not accessible remotely)

### VPS Production
- Tailscale for remote access (encrypted, authenticated)
- No direct SSH exposure (firewall + Tailscale only)
- Cloudflare for public domains (DDoS protection)

---

## Backup Security

### Encryption
- Restic backups encrypted with RESTIC_PASSWORD
- S3 backups use encryption at rest (AWS)
- Transport: HTTPS only

### Restore Safety
- Test restores in isolated environment (not production)
- Verify checksum after restore
- Audit: Who has access to backups?

---

## Monitoring

### Security Events to Watch
- Failed login attempts (n8n logs)
- Unusual API usage (rate limit hits)
- Failed git commits (vault access issues)
- Workflow execution failures (error patterns)

### Audit Trail
- n8n logs: `docker-compose logs n8n`
- Vault history: `cd paios-vault && git log`
- GitHub Actions: Deployment history
