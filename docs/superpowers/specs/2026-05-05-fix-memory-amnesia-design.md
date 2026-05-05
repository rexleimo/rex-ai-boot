# Fix Memory Amnesia for All Coding Agent Tools

**Date:** 2026-05-05
**Status:** Approved
**Scope:** Claude Code, Codex CLI, Gemini CLI

## Problem

ContextDB memory system fails to maintain state across sessions. Every new agent launch reads empty memory — the agent "forgets" all prior work.

### Root Causes

1. **Interactive sessions are read-only**: `ctx-agent` injects memory on startup but writes nothing back during or after the session. Only one-shot mode (`--prompt`) writes events/checkpoints.

2. **Base memory layers never initialized**:
   - `~/.aios/SOUL.md` (persona) — does not exist
   - `~/.aios/USER.md` (user profile) — does not exist
   - `workspace-memory--default` session — directory does not exist (no pinned.md, no memos)

3. **Facade cache stale**: `.facade.json` generated 2026-04-22, `sessionId: ""`, `status: "new"`, so every startup reads "no history".

## Solution: Three-Layer Defense (Hybrid)

### Layer 1: Auto-Init on Startup

Add `ensureMemoryLayers()` in `runCtxAgent()`, executed before the lazy/full mode branch. Idempotent — skips if already exists.

```
runCtxAgent()
  │
  ├── ensureMemoryLayers(workspaceRoot)
  │     ├── ensurePersonaLayer('persona')    → create ~/.aios/SOUL.md from template
  │     ├── ensurePersonaLayer('user')       → create ~/.aios/USER.md from template
  │     ├── ensureWorkspaceMemorySession()   → create workspace-memory--default/ dir + meta.json
  │     └── refreshFacade()                  → regenerate .facade.json with valid session
  │
  ├── [existing lazy/full branch...]
```

**Files modified:** `scripts/ctx-agent-core.mjs`

**Behavior:**
- `ensurePersonaLayer()` already exists in `scripts/lib/memo/persona.mjs` — just needs to be called
- `ensureWorkspaceMemorySession()` — new function, creates `memory/context-db/sessions/workspace-memory--default/meta.json`
- `refreshFacade()` — calls `generateFacadeFromSession()` and writes `.facade.json`

### Layer 2: System Prompt Self-Save Instructions

Inject a `## Memory Persistence` section into the effective system prompt, instructing the agent to save progress before ending work.

**Injected content:**

```markdown
## Memory Persistence (AIOS)

Before finishing a work session or completing a multi-step task, save your progress:

- Quick note: `aios memo add "描述当前进展和下一步"`
- Pin important facts: `aios memo pin add "需要跨会话记住的关键信息"`
- Full checkpoint (one-shot mode): handled automatically by ctx-agent

Save when:
- You complete a significant task or subtask
- You encounter a blocker you can't resolve
- You're about to end the session
- You discover something non-obvious that future sessions need to know

Do NOT save routine progress or trivial updates.
```

**Injection point:** In `runCtxAgent()`, after `buildMemoryPrelude()` and before `buildFacadePrompt()`:

```
effectivePrompt = memoryPrelude + persistenceInstructions + facadePrompt + routerGuide
```

**Files modified:** `scripts/ctx-agent-core.mjs` — add `buildPersistenceInstructions()` function

### Layer 3: Trap Fallback

Add exit hooks around `runInteractiveAgent()` to write a minimal checkpoint if no meaningful save occurred during the session.

**Implementation:**

```javascript
let meaningfulSaveOccurred = false;

function runInteractiveAgentWithSaveGuard(agent, contextText, extraArgs, opts) {
  const saveGuard = () => {
    if (meaningfulSaveOccurred) return;
    try {
      ctx(opts.workspaceRoot, 'checkpoint', [
        '--session', opts.sessionId,
        '--summary', `Auto checkpoint: ${agent} session ended (no explicit save)`,
        '--status', 'completed',
        '--next', 'Review last session state|Continue unfinished work',
      ]);
    } catch { /* best-effort */ }
  };

  process.on('exit', saveGuard);
  process.on('SIGINT', () => { saveGuard(); process.exit(130); });
  process.on('SIGTERM', () => { saveGuard(); process.exit(143); });

  runInteractiveAgent(agent, contextText, extraArgs, opts);
}
```

**Detection of meaningfulSaveOccurred (chosen: mtime approach):**
- Record session's `l2-events.jsonl` mtime at session start
- On exit, compare current mtime — if modified, a meaningful save occurred, skip trap
- This avoids cross-module shared state and works for both memo writes and one-shot checkpoints

**Files modified:** `scripts/ctx-agent-core.mjs` — replace `runInteractiveAgent()` call with `runInteractiveAgentWithSaveGuard()`

## File Change Summary

| File | Changes |
|------|---------|
| `scripts/ctx-agent-core.mjs` | Add `ensureMemoryLayers()`, `buildPersistenceInstructions()`, `runInteractiveAgentWithSaveGuard()`, trap handlers |
| `scripts/lib/memo/workspace-memory.mjs` | Add `ensureWorkspaceMemorySession()` export |

No new files. No new dependencies.

## Verification

1. Delete `~/.aios/SOUL.md`, `~/.aios/USER.md`, `memory/context-db/sessions/workspace-memory--default/`, `memory/context-db/.facade.json`
2. Run `node scripts/ctx-agent.mjs --agent claude-code --workspace /Users/molei/codes/aios --project aios`
3. Verify:
   - SOUL.md and USER.md created with templates
   - workspace-memory--default/ directory exists with meta.json
   - .facade.json refreshed with valid sessionId
   - System prompt contains "Memory Persistence" section
4. Start a Claude Code session, do some work, exit
5. Verify checkpoint was written (either by agent self-save or trap fallback)
