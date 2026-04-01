# Orchestrate + Learn-Eval Smoke (Token-Free)

Run from repository root:

```bash
node scripts/aios.mjs orchestrate feature --task "example smoke" --dispatch local --execute dry-run --format json
node scripts/aios.mjs learn-eval --limit 10 --format json
```

Optional performance gate:

```bash
npm run perf:orchestrate-learn-eval:smoke
```

What this validates:

- Orchestrator blueprint expansion and local dry-run execution path
- Learn-eval recommendation generation on checkpoint telemetry
- Latency threshold gate for orchestrate/learn-eval smoke path
