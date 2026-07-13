# Backup and Restore Strategy

## Backup Strategy

### What Gets Backed Up
1. n8n Data Table (canonical_articles)
2. Vault (paios-vault git repo)
3. n8n workflow definitions
4. Configuration (.env)

### Backup Tool: Restic
- Automated snapshots (daily or on-demand)
- Incremental backups (efficient storage)
- Compression and encryption
- Multiple retention policies

### Backup Frequency
- Daily automated backup (00:00 UTC)
- Retention: 30 days
- Test restore: Weekly (manual)

---

## Restore Procedures

*See RESTORE_PROCEDURE.md for detailed step-by-step.*

### Local Restore (5-10 min)
```bash
docker-compose down
docker-compose up -d
# Import workflows (manual or automated)
# Verify n8n workflows present
```

### From Backup (Restic)
```bash
restic restore <snapshot-id> --target /restore-point
# Verify files, copy to correct locations
# Restart containers
```

### VPS Restore
See RESTORE_PROCEDURE.md for full process (30-45 min)

---

## Restore Testing

### Monthly Restore Test
1. Provision a temporary test VPS (same OS as production)
2. Follow restore procedure
3. Verify workflows run, latest.json generates
4. Decommission test VPS
5. Document result: PASS/FAIL + timestamp
