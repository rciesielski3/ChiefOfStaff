# PAIOS Operations Checklist

Quick-reference checklists for common operational tasks. Use these to ensure consistent, reliable system management.

---

## First Deployment

Complete this checklist when deploying PAIOS for the first time (local or VPS).

- [ ] Docker running
- [ ] `.env` configured with all required variables
- [ ] Volumes exist and have correct permissions
- [ ] n8n accessible via web UI
- [ ] Workflows imported into n8n
- [ ] Telegram test message sent and received
- [ ] Scheduled jobs enabled in n8n

---

## Daily Operations

Run these checks once per day to ensure system health.

- [ ] Check n8n workflow logs for errors
- [ ] Verify latest Telegram message received
- [ ] Spot-check vault commits (git log)
- [ ] Monitor disk usage (backups growing as expected?)

---

## Weekly Maintenance

Complete these tasks once per week for system maintenance and verification.

- [ ] Review workflow execution logs for patterns or failures
- [ ] Backup size check (expected range: __)
- [ ] Restore test on non-production data
- [ ] Cost review (OVH usage, Telegram API charges)

---

## Backup Verification

Use this checklist to confirm backups are working correctly.

- [ ] Restic list snapshots: `restic snapshots`
- [ ] Verify latest backup timestamp (within expected interval)
- [ ] Check backup size against expected range
- [ ] Verify backup storage has sufficient space

---

## Restore Verification

Verify the restore procedure works (test on non-production systems first).

- [ ] Restore to test VPS from backup
- [ ] Verify n8n workflows present and operational
- [ ] Verify vault files restored with correct content
- [ ] Verify scheduled jobs run after restore

---

## Update Procedure

Follow this checklist when updating PAIOS code or dependencies.

- [ ] Backup current state (full system backup before any updates)
- [ ] Pull latest code from repository
- [ ] Update workflows in n8n (if changed)
- [ ] Restart containers: `docker-compose restart`
- [ ] Verify workflows run correctly post-update
- [ ] Confirm no errors in logs: `docker-compose logs n8n`

---

## Incident Response

Use this checklist when investigating issues or outages.

- [ ] Check Docker logs: `docker-compose logs -f n8n`
- [ ] Verify n8n UI is responsive (test login)
- [ ] Check Telegram connectivity (send test message)
- [ ] Review recent git commits (vault changes)
- [ ] Verify backup integrity (did backups run?)
- [ ] Restore from backup if data corruption detected
- [ ] Document incident and resolution in ops log

---

## Notes

- Replace `__` placeholders with actual values specific to your deployment
- Keep timestamped records of checklist completions
- Update this document as operational requirements change
- When in doubt, consult `docs/OPERATIONS.md` for detailed procedures
