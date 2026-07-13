# Configuration Guide

## Environment Variables

### n8n Configuration
```
N8N_ENCRYPTION_KEY=<random-32-chars>
N8N_USER_MANAGEMENT_JWT_SECRET=<random-32-chars>
DATABASE_URL=<postgres-url-or-empty>
```

### PAIOS Configuration
```
PAIOS_VAULT_PATH=/path/to/paios-vault
EXPORT_FILE_PATH=/path/to/qa-news/public/latest.json
TELEGRAM_BOT_TOKEN=<bot-token-from-telegram>
TELEGRAM_CHAT_ID=<your-chat-id>
```

### Backup Configuration
```
RESTIC_PASSWORD=<backup-password>
RESTIC_REPOSITORY=s3://bucket-name/paios
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
```

### Tailscale (VPS only)
```
TAILSCALE_AUTH_KEY=<auth-key-from-tailscale>
```

## .env.example Template

```bash
# .env.example — Copy to .env and fill in your values
N8N_ENCRYPTION_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
N8N_USER_MANAGEMENT_JWT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
DATABASE_URL=postgresql://user:pass@localhost/paios
PAIOS_VAULT_PATH=/opt/paios-vault
EXPORT_FILE_PATH=/opt/paios/qa-news/public/latest.json
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
RESTIC_PASSWORD=
RESTIC_REPOSITORY=
```

## Secrets Management

- Never commit .env (add to .gitignore)
- Store secrets in secure location (1Password, Vault)
- Rotate tokens quarterly
- Use environment-specific .env files (local, staging, prod)
