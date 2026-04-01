# ContextDB Search Upgrade: FTS5/BM25 + Incremental Index Sync (P1.5)

ContextDB search moved to SQLite FTS5 + BM25 as the default path (P1), and now adds P1.5 operational upgrades:

- incremental sidecar sync with observability (`index:sync --stats`),
- JSONL run history output (`--jsonl-out`),
- normalized refs table for exact refs filtering (`event_refs`),
- refs-query benchmark and CI gate scripts.

## Why We Extended It

After the FTS5/BM25 migration, we still had two practical gaps:

- operators needed per-run sync metrics to track index freshness and drift;
- refs filtering still needed stronger precision guarantees at scale.

P1.5 addresses both without changing existing workflow contracts.

## What Is Live Now

`contextdb search` and index maintenance now behave as:

1. SQLite FTS5 `MATCH`
2. BM25 ranking (`bm25(...)`) over `kind/text/refs`
3. Lexical fallback when FTS is unavailable
4. Exact refs filtering via normalized `event_refs` (no substring ambiguity)
5. Incremental sidecar refresh via `index:sync` (full rebuild remains available)

## Commands

```bash
cd mcp-server
npm run contextdb -- search --query "auth race" --project demo --refs auth.ts
npm run contextdb -- index:sync --stats
npm run contextdb -- index:sync --stats --jsonl-out memory/context-db/exports/index-sync-stats.jsonl
npm run bench:contextdb:refs:ci
npm run bench:contextdb:refs:gate
```

For local tuning, run:

```bash
npm run bench:contextdb:refs -- --events 2000 --refs-pool 200 --queries 300 --warmup 30 --json-out test-results/contextdb-refs-bench.local.json
```

## Practical Impact

- Better observability for index sync quality and cost (`scanned/upserted`, elapsed time, throttle skips).
- More stable refs filtering under large datasets due to normalized exact matching.
- Enforced latency/hit-rate guardrails in CI for refs queries.
- Safer long-session and cross-CLI handoff behavior without forcing full rebuild each run.
