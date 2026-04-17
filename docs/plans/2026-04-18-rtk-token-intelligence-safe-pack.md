# RTK-Inspired Token Efficiency + Intelligence-Safe Context Pack (2026-04-18)

## Goal
Implement a production-ready token reduction upgrade in AIOS ContextDB packet generation (`contextdb context:pack`) that reduces L2 payload size while avoiding intelligence loss.

## RTK Reference Findings (what was adopted)

Reference target: `rtk-ai/rtk` (analyzed from public source/docs).

Key ideas extracted:
1. Multi-stage filtering pipeline instead of one-shot truncation.
2. Conservative-by-default behavior; aggressive mode must be explicit.
3. “Never block / fail-open” behavior when filtering is unsafe.
4. Preserve high-signal content (errors, commands, key files, outcomes) while shrinking noise.
5. Observable strategy metadata so users can inspect what was compressed/dropped.

## Anti-Degradation Rules Added

1. Critical-signal preservation
- Preserve terms/signals like `error/failed/timeout/retry/fix/auth`, command markers, and file-path tokens.

2. Semantic retention guard
- Compression only applies when token containment remains above a safety threshold.
- If compression looks risky, fallback to original event text.

3. Priority-aware budgeting (not blind tail clipping)
- Keep recent + high-signal events first.
- Compress low-priority noise before dropping.
- Drop lowest-priority events before truncating protected events.

4. Hard-protect recent state
- Latest event is hard-protected to keep current execution state coherent.

## Implemented Changes

### 1) ContextDB core strategy engine
- File: `mcp-server/src/contextdb/core.ts`
- Added token strategies:
  - `legacy` (compat tail behavior)
  - `balanced` (default when `--token-budget` is set)
  - `aggressive` (explicit opt-in)
- Added safe compression pipeline:
  - ANSI stripping
  - repeated-line collapse
  - stack-run collapse
  - large-line-set trimming
  - aggressive long-line clipping (aggressive mode only)
- Added compression safety checks:
  - critical-term retention
  - token containment threshold
  - automatic fallback to original text when unsafe
- Added budget scheduler with stats:
  - compress -> drop -> truncate, in intelligence-preserving order
- Context packet now includes strategy telemetry in `Event Window` line:
  - `strategy=... rawTokenUsed=... compressed=... dropped=... truncated=...`

### 2) CLI support
- File: `mcp-server/src/contextdb/cli.ts`
- Added new option:
  - `--token-strategy legacy|balanced|aggressive`
- Usage string and option parsing updated.

### 3) Subagent runtime propagation
- File: `scripts/lib/harness/subagent-runtime.mjs`
- Added env support:
  - `AIOS_SUBAGENT_CONTEXT_TOKEN_STRATEGY`
- Runtime now forwards strategy to `context:pack` when set.

## New Validation Coverage

File: `mcp-server/tests/contextdb.test.ts`

Added tests:
1. `buildContextPacket balanced token strategy keeps critical error context under tight budget`
- Confirms critical failure/file signals survive tight budget cuts.

2. `contextdb cli context:pack accepts --token-strategy and writes strategy metadata`
- Confirms CLI strategy flag is parsed and reflected in packet metadata.

## How To Use

### CLI example
```bash
cd mcp-server
npm run contextdb -- context:pack \
  --session <id> \
  --limit 60 \
  --token-budget 1200 \
  --token-strategy balanced \
  --kinds prompt,response,error \
  --refs core.ts,cli.ts
```

### Subagent runtime example
```bash
export AIOS_SUBAGENT_CONTEXT_TOKEN_BUDGET=1200
export AIOS_SUBAGENT_CONTEXT_TOKEN_STRATEGY=balanced
```

## Verification Evidence

Executed successfully:
1. `cd mcp-server && npm run typecheck`
2. `cd mcp-server && npm run test`
3. `cd mcp-server && npm run build`
4. `npm run test:scripts` (repo root)

All passed in this run.

## Delivery Summary

This delivery is code-complete and test-backed.
It provides a concrete token-efficiency mechanism with explicit anti-degradation safeguards, not a report-only outcome.
