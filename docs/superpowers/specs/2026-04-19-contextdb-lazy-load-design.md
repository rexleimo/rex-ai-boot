# ContextDB Lazy Load & Agentic Memory Trigger Design

## Problem

Today, every AIOS CLI start-up runs a full `contextdb init → session:latest → context:pack → inject` pipeline, which takes 2–5 s and injects a large system-prompt payload. Users report:

1. **Slow cold start** — they just want a fast CLI.
2. **Cognitive noise** — the injected context packet is large and often irrelevant for simple tasks.
3. **Forced memory** — even when a user only wants a quick chat, the system treats it as a continuation of the previous session.

We still want the agent to **self-discover** the memory system and decide when to load history, but we want the trigger to be **seamless** (无感) rather than requiring explicit user commands.

## Goal

Reduce start-up latency to < 50 ms for the common case while keeping the full ContextDB capability available **on-demand** via agentic self-discovery.

## Non-Goals

- Replacing ContextDB with a new storage layer.
- Changing the ContextDB file-system layout or session format.
- Making context injection work after the interactive CLI has already started (current CLI architecture does not support dynamic system-prompt updates).

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Start-up (< 50 ms)                           │
│  1. Load lightweight memory facade (cached .facade.json)        │
│  2. Inject "memory facade" prompt (< 150 tokens)                │
│  3. Launch interactive CLI                                      │
│  4. [Background] Async ContextDB init + pack (non-blocking)     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Runtime (agent turn)                         │
│  User Input ──► Intent Detector ──► Task Classifier ──► RL      │
│   (A)              (keywords)         (complexity)      Policy  │
│                                                              (C) │
│                              │                                   │
│                              ▼                                   │
│              Any trigger = TRUE ──► Agent loads context          │
│                     via @file or tool-use                       │
│                     (fresh if ready, stale fallback)             │
└─────────────────────────────────────────────────────────────────┘
```

### Components

| Component | File | Responsibility |
|-----------|------|----------------|
| Memory Facade | `memory/context-db/.facade.json` | Cached lightweight summary of last session (goal, status, key refs, timestamp). |
| Facade Loader | `scripts/lib/contextdb/facade.mjs` | Read `.facade.json`, validate TTL, return facade payload. |
| Async Bootstrap | `scripts/lib/contextdb/async-bootstrap.mjs` | Fire-and-forget `contextdb init + pack` after CLI launch. |
| Intent Detector | `scripts/lib/contextdb/trigger/intent.mjs` | Regex + keyword matching for memory-related intent (remember, recall, previous, last time, etc.). |
| Task Classifier | `scripts/lib/contextdb/trigger/complexity.mjs` | Heuristic scoring for task complexity (multi-step, cross-file, long-running indicators). |
| RL Policy Gate | `scripts/lib/contextdb/trigger/rl-policy.mjs` | Thin adapter to existing `rl-core` policy for binary "load memory?" decisions. |
| Trigger Orchestrator | `scripts/lib/contextdb/trigger/orchestrator.mjs` | Runs A → B → C in short-circuit order; returns `shouldLoad` + `reason`. |

## Start-up Flow (Detailed)

```
ctx-agent-core.mjs
│
├─► Load .facade.json (cached, < 10 ms)
│   └─► If missing or expired (TTL > 1 h):
│       └─► Generate facade from latest session file headers (fallback, < 50 ms)
│
├─► Build "memory facade" prompt snippet:
│   "This project uses ContextDB for session memory. Latest session: <goal>
│    (status: <status>, refs: <refs>). Full history at: <path>.
│    Load it when you need prior context."
│
├─► Inject facade prompt via existing --append-system-prompt / -i / CODEX_SYSTEM_PROMPT
│
├─► Spawn interactive CLI (stdio inherit)
│
└─► [Background fork] Run async-bootstrap.mjs:
    contextdb init → session:latest → context:pack → update .facade.json
```

### Facade JSON Schema

```json
{
  "version": 1,
  "generatedAt": "2026-04-19T10:00:00Z",
  "ttlSeconds": 3600,
  "sessionId": "claude-code-20260419T095454-e6eb600d",
  "goal": "Shared context session for claude-code on aios",
  "status": "running",
  "lastCheckpointSummary": "Browser MCP weak-model remediation complete; P0 rollout pending",
  "keyRefs": ["scripts/ctx-agent-core.mjs", "docs/plans/2026-04-18-weak-model-browser-mcp-team-analysis.md"],
  "contextPacketPath": "memory/context-db/exports/latest-claude-code-context.md",
  "hasStalePack": false
}
```

## Runtime Trigger Flow (Detailed)

When the agent receives a user turn, the orchestrator evaluates three signals in order (short-circuit on first TRUE):

### A. Intent Detector (cheapest)

Keywords / regex groups:

| Category | Patterns |
|----------|----------|
| Recall | "remember", "recall", "之前", "上次", "上次说", "previous", "last time" |
| Continuation | "继续", "接着", "resume", "pick up where", "where did we leave off" |
| Reference | "那个文件", "the file we edited", "the plan from yesterday" |
| Meta | "context", "memory", "session", "history", "checkpoint" |

Threshold: any match → `shouldLoad = true`.

### B. Task Classifier (medium cost)

Heuristic scoring (0–100):

| Indicator | Score |
|-----------|-------|
| Multi-step language ("first do X, then Y", "分几步") | +20 |
| Cross-domain keywords ("frontend + backend", "test + docs") | +20 |
| Long-running hints ("orchestrate", "harness", "team", "subagent") | +30 |
| Blueprint keywords ("feature", "bugfix", "refactor", "security") | +15 |
| File-count indicators ("这些文件", "across the codebase") | +15 |

Threshold: score ≥ 40 → `shouldLoad = true`.

### C. RL Policy Gate (most informed, highest latency)

Calls into existing `rl-core` infrastructure:

```
rl-policy.mjs
│
├─► Check if active checkpoint exists for current task embedding
├─► If policy model loaded → binary inference "load_memory?"
└─► If offline / cold → fall back to rule-based (A + B combined)
```

The RL policy is trained with reward shaping:
- **Positive reward** when loading memory leads to task completion faster than baseline.
- **Negative reward** when unnecessary memory load adds token cost without task benefit.
- **Negative reward** when failing to load memory causes the agent to ask clarifying questions that the history already answers.

## Agent Self-Discovery Mechanism

The facade prompt explicitly tells the agent:

1. **That memory exists** — "This project uses ContextDB for session memory."
2. **Where to find it** — "Full history at: memory/context-db/exports/latest-claude-code-context.md"
3. **When to use it** — "Load it when you need prior context."

When the trigger fires, the agent can:

- **File reference** (Codex/Claude/Gemini all support `@file` or paste):
  - Read `memory/context-db/exports/latest-<agent>-context.md`
  - Read `memory/context-db/exports/<sessionId>-context.md`
- **Tool-use** (if MCP contextdb query tools are available):
  - `search --query "auth race" --project aios`
  - `timeline --session <id> --limit 30`

This shifts the **loading responsibility from the wrapper to the agent**, which aligns with the user's desire for agentic self-training and discovery.

## Error Handling & Edge Cases

| Scenario | Behavior |
|----------|----------|
| `.facade.json` missing | Generate from latest session file header on-the-fly; if no sessions, inject minimal prompt. |
| Async bootstrap fails | Log warning to stderr (non-blocking); next start-up retries. |
| Agent triggers load before async bootstrap finishes | Agent reads stale pack (if exists) or gets empty result + warning. |
| No prior sessions | Facade prompt says "No prior sessions"; agent behaves as fresh start. |
| RL policy model not loaded | Falls back to A + B rule-based triggers. |
| User explicitly says "ignore memory" | Intent detector can have negative patterns ("new session", "ignore history", "从零开始") → suppress load. |

## Telemetry

To continuously improve the trigger accuracy and measure lazy-load success:

| Metric | Source | Purpose |
|--------|--------|---------|
| `contextdb.lazy_load.trigger_count` | Trigger orchestrator | How often triggers fire. |
| `contextdb.lazy_load.trigger_source` | Intent / Classifier / RL | Which signal fired. |
| `contextdb.lazy_load.load_latency_ms` | Agent file read / tool call | Time from trigger to usable context. |
| `contextdb.lazy_load.hit_rate` | Post-task evaluation | Did loading memory actually help? |
| `contextdb.startup.duration_ms` | ctx-agent-core | Overall start-up time (target < 50 ms). |

Telemetry is written to existing `rl-core` epoch ledger for RL reward computation.

## Integration with Existing Systems

### ContextDB
- Zero changes to `contextdb init`, `session:new`, `context:pack`, `search`, `timeline`.
- `.facade.json` is a new **sidecar** file, rebuildable from session data.

### RL Core
- `rl-policy.mjs` reuses `scripts/lib/rl-core/policy.mjs` (or creates thin adapter).
- Reward signals for memory-load decisions feed into existing replay pool.

### Shell Bridge (`contextdb-shell-bridge.mjs`)
- Bridge continues to call `ctx-agent-core.mjs` unchanged.
- New env var `CTXDB_LAZY_LOAD=1` to opt into lazy mode (default off during rollout, then default on).

### ctx-agent-core.mjs
- Add `shouldLazyLoad(env)` check near top of `runCtxAgent`.
- If lazy: skip `safeContextPack`, run `loadFacade` + `injectFacadePrompt`, then spawn CLI + fork async bootstrap.
- If not lazy: preserve existing full-inject behavior.

## Migration & Rollout

1. **Phase 1 (behind flag)** — `CTXDB_LAZY_LOAD=1` for opt-in users.
2. **Phase 2 (default on)** — Make lazy load the default; `CTXDB_LAZY_LOAD=0` to opt out.
3. **Phase 3 (cleanup)** — Remove legacy eager path after 30 days of stable telemetry.

## Testing Strategy

| Test | Type | Target |
|------|------|--------|
| Facade load < 20 ms | Unit | `scripts/tests/facade.test.mjs` |
| Intent detector accuracy | Unit | `scripts/tests/trigger-intent.test.mjs` |
| Task classifier scoring | Unit | `scripts/tests/trigger-complexity.test.mjs` |
| Full startup < 50 ms | Integration | `scripts/tests/ctx-agent-lazy-load.test.mjs` |
| Async bootstrap completes | Integration | `scripts/tests/async-bootstrap.test.mjs` |
| RL policy fallback | Integration | `scripts/tests/rl-policy-fallback.test.mjs` |

## Open Questions (resolved)

| Question | Resolution |
|----------|------------|
| Can we inject context after CLI starts? | **No** — current CLI architectures (Claude Code, Codex, Gemini) fix system prompt at spawn time. We use facade + agentic self-load instead. |
| How does the agent know when to load? | Facade prompt tells it memory exists and where to find it; trigger system (A+B+C) gives it the signal. |
| What if async bootstrap hasn't finished? | Agent reads stale pack or gets empty; no worse than today's first-run experience. |
