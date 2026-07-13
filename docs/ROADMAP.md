# PAIOS Roadmap

## Completed

| Milestone | Status | Delivery |
|-----------|--------|----------|
| M1: Telegram | ✅ Complete | Bot setup, message delivery |
| M2: Daily Brief MVP | ✅ Complete | GCal + GitHub + Claude |
| M3: Reddit Radar | ✅ Complete | Feed monitoring, scoring, routing |
| M4: Knowledge Layer + QA News | ✅ Complete | canonical_articles, export pipeline, public site |

## In Progress

| Milestone | Work | Timeline |
|-----------|------|----------|
| P1.0: Production Readiness | Ops docs, restore procedures, VPS planning | This week |
| M4 Operationalization | Import workflows to n8n, wire M3, test locally | Parallel with P1.0 |

## Upcoming

| Milestone | Goal | Dependencies |
|-----------|------|---|
| M5: Weekly Review | Weekly synthesis of articles + project status | M4 live |
| M6: Monthly Recap | Monthly trends + achievement review | M5 |
| M7: Project Intelligence | Detect stale projects, inactive branches | M6 |
| M8: VPS Migration | Deploy to OVH, production backup/restore | P1.0 complete |

## Success Criteria

- **M3:** Daily Brief before 08:00 UTC, every weekday
- **M4:** QA News updated daily, latest.json current
- **M5+:** Articles persisted, weekly synthesis delivered
- **P1.0:** System reproducible via restore procedure
- **M8:** Production on VPS with automated backup/restore tested
