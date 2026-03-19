# ContextDB Search Upgrade Gate (FTS5/BM25)

## Decision Rule

Only start an FTS5/BM25 upgrade when **any** of these gates is triggered:

1. **Scale gate**
- `memory/context-db/index/events.jsonl` event count > **50,000**

2. **Quality gate**
- Offline eval on a fixed 50-query set shows either:
  - `Hit@10 < 0.85`, or
  - `MRR@10 < 0.70`

3. **Latency gate**
- `contextdb search` p95 latency > **150 ms/query** in local benchmark (same workspace and query set)

## Current Status (2026-03-19)

From second-round evaluation in this repo/session:

- Legacy full-string LIKE:
  - Hit@10 = 0.00
  - MRR@10 = 0.00
- Current token-weighted retrieval (deployed):
  - Hit@10 = 1.00
  - MRR@10 = 1.00
- BM25 prototype:
  - Hit@10 = 1.00
  - MRR@10 = 1.00
- Mean latency (same in-memory benchmark):
  - token-weighted: ~0.3582 ms/query
  - bm25-prototype: ~0.6173 ms/query

**Result:** No trigger hit yet. Keep current token-weighted search path.

## Review Cadence

- Re-check weekly or after major growth in ContextDB event volume.
- Re-check immediately if users report retrieval misses for multi-term queries.

## Minimal Re-check Commands

```bash
# Event volume
node -e "const fs=require('fs');const n=fs.readFileSync('memory/context-db/index/events.jsonl','utf8').trim().split('\n').filter(Boolean).length;console.log(n)"

# ContextDB tests
cd mcp-server && npm run test:contextdb

# Typecheck
cd mcp-server && npm run typecheck
```

