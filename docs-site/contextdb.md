---
title: ContextDB
description: Session model, five runtime steps, and command references.
---

# ContextDB Runtime

## Quick Answer (AI Search)

ContextDB is a filesystem session layer for multi-CLI agent workflows. It stores events, checkpoints, and resumable context packets per project, and now keeps a SQLite sidecar index for faster retrieval.

## Canonical 5 Steps

At runtime, ContextDB can execute this sequence:

1. `init` - ensure DB folders and sidecar indexes exist.
2. `session:new` or `session:latest` - resolve session per `agent + project`.
3. `event:add` - store user/model/tool events.
4. `checkpoint` - write stage summary, status, and next actions.
5. `context:pack` - export markdown packet for next CLI call.

## Interactive vs One-shot

- Interactive mode usually runs steps `1, 2, 5` before opening CLI.
- One-shot mode runs all `1..5` in a single command.

## Fail-Open Packing

If `contextdb context:pack` fails, `ctx-agent` will **warn and continue** by running the CLI without injected context.

To make packing failures fatal:

```bash
export CTXDB_PACK_STRICT=1
```

Shell wrappers (`codex`/`claude`/`gemini`) default to fail-open even if `CTXDB_PACK_STRICT=1` is set. To enforce strict packing for wrapped interactive runs too:

```bash
export CTXDB_PACK_STRICT_INTERACTIVE=1
```

## Manual Command Examples

```bash
cd mcp-server
npm run contextdb -- init
npm run contextdb -- session:new --agent codex-cli --project demo --goal "implement feature"
npm run contextdb -- event:add --session <id> --role user --kind prompt --text "start"
npm run contextdb -- checkpoint --session <id> --summary "phase done" --status running --next "write tests|implement"
npm run contextdb -- context:pack --session <id> --out memory/context-db/exports/<id>-context.md
npm run contextdb -- index:sync --stats --jsonl-out memory/context-db/exports/index-sync-stats.jsonl
npm run contextdb -- index:rebuild
```

## Packet Controls (P0)

`context:pack` now supports token-aware and filter-aware export:

```bash
npm run contextdb -- context:pack \
  --session <id> \
  --limit 60 \
  --token-budget 1200 \
  --kinds prompt,response,error \
  --refs core.ts,cli.ts
```

- `--token-budget`: cap recent-event payload by estimated token budget.
- `--kinds` / `--refs`: include only matching events.
- default dedupe is enabled for repeated events in the packet view.

## Retrieval Commands (P1)

ContextDB now provides SQLite-backed retrieval over sidecar indexes:

```bash
npm run contextdb -- search --query "auth race" --project demo --kinds response --refs auth.ts
npm run contextdb -- timeline --session <id> --limit 30
npm run contextdb -- event:get --id <sessionId>#<seq>
npm run contextdb -- index:sync --stats
npm run contextdb -- index:rebuild
```

- `search`: query indexed events.
- `timeline`: merged event/checkpoint feed.
- `event:get`: fetch a specific event by stable ID.
- `index:sync`: incremental sync from canonical session files to sidecar index.
- `index:rebuild`: rebuild SQLite sidecar from canonical session files.
- Default ranking path: SQLite FTS5 `MATCH` + `bm25(...)` over `kind/text/refs`.
- Backward compatibility: if FTS is unavailable, search automatically falls back to lexical matching.

## Incremental Sync + Refs Normalization (P1.5)

ContextDB now keeps a normalized `event_refs` table in SQLite.  
`--refs` filtering uses exact normalized ref matches through this table, reducing false positives from substring matching.

```bash
npm run contextdb -- index:sync --stats
npm run contextdb -- index:sync --force --stats
npm run contextdb -- index:sync --stats --jsonl-out memory/context-db/exports/index-sync-stats.jsonl
```

- `--stats`: prints `scanned/upserted` counters for sessions/events/checkpoints, elapsed time, throttle skips, and force flag.
- `--jsonl-out`: appends one JSON record per run (with timestamp) for trend analysis.
- Use `index:rebuild` only when sidecar is missing/corrupted or a full schema rebuild is required.

## Refs Query Benchmark

Use benchmark scripts to track refs-query latency and gate regressions:

```bash
cd mcp-server
npm run bench:contextdb:refs -- --events 2000 --refs-pool 200 --queries 300 --warmup 30 --json-out test-results/contextdb-refs-bench.local.json
npm run bench:contextdb:refs:ci
npm run bench:contextdb:refs:gate
```

- `bench:contextdb:refs`: local customizable dataset benchmark.
- `bench:contextdb:refs:ci`: standard CI dataset profile.
- `bench:contextdb:refs:gate`: fails when latency/hit-rate thresholds are not met.

## Optional Semantic Search (P2)

Semantic mode is optional and always falls back to lexical search when unavailable.

```bash
export CONTEXTDB_SEMANTIC=1
export CONTEXTDB_SEMANTIC_PROVIDER=token
npm run contextdb -- search --query "issue auth" --project demo --semantic
```

- `--semantic`: request semantic reranking.
- `CONTEXTDB_SEMANTIC_PROVIDER=token`: local token-overlap rerank, no network call.
- Unknown/disabled providers automatically fall back to lexical query path.
- Semantic rerank runs on query-scoped lexical candidates (not recency-only candidates), so older exact hits are not dropped by default.

## Storage Layout

ContextDB keeps canonical data in session files and uses sidecar indexes for speed:

```text
memory/context-db/
  sessions/<session_id>/*        # source of truth
  index/context.db               # sqlite sidecar (rebuildable)
  index/sessions.jsonl           # compatibility index
  index/events.jsonl             # compatibility index
  index/checkpoints.jsonl        # compatibility index
```

## Session ID Format

Session ids use this style:

`<agent>-<YYYYMMDDTHHMMSS>-<random>`

This keeps chronology obvious and avoids collisions.

## FAQ

### Is ContextDB a cloud database?

No. It uses local filesystem storage under the workspace.

### Why does context disappear after `/new` (Codex) or `/clear` (Claude/Gemini)?

Those commands reset the **in-CLI conversation state**. ContextDB is still on disk, but the wrapper only injects the context packet **when the CLI process starts**.

Recovery options:

- Preferred: exit the CLI and re-run `codex` / `claude` / `gemini` from your shell (wrapper runs `context:pack` again and re-injects).
- If you must stay in the same process: in the new conversation, ask the agent to read the latest snapshot:
  - `@memory/context-db/exports/latest-codex-cli-context.md`
  - `@memory/context-db/exports/latest-claude-code-context.md`
  - `@memory/context-db/exports/latest-gemini-cli-context.md`

If your client does not support `@file` mentions, paste the file contents as the first prompt.

### Do Codex, Claude, and Gemini share the same context?

Yes. If they run inside the same wrapped workspace (same git root when available, otherwise the same current directory), they use the same `memory/context-db/`.

### How do I hand off tasks across CLIs?

Keep one shared workspace session and use `context:pack` before the next CLI run.
