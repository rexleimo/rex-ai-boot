# ContextDB Quickstart (Minimal)

Run from repository root:

```bash
cd mcp-server
npm run contextdb -- init
npm run contextdb -- session:new --agent codex-cli --project demo --goal "quickstart demo"
npm run contextdb -- event:add --session <session_id> --role user --kind prompt --text "start task"
npm run contextdb -- checkpoint --session <session_id> --summary "initial checkpoint" --status running --next "implement|verify"
npm run contextdb -- context:pack --session <session_id> --out memory/context-db/exports/<session_id>-context.md
npm run contextdb -- index:sync --stats --jsonl-out memory/context-db/exports/index-sync-stats.jsonl
```

Expected results:

- Session metadata created under `memory/context-db/sessions/<session_id>/`
- Checkpoint persisted to `l1-checkpoints.jsonl`
- Context packet exported to `memory/context-db/exports/`
- Index sync stats recorded to JSONL
