# Fix Memory Amnesia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate cross-session amnesia by auto-initializing memory layers, injecting self-save instructions, and adding a trap-based checkpoint fallback.

**Architecture:** Three-layer defense — (1) auto-init missing persona/user/workspace-memory on startup, (2) inject "save your progress" instructions into the system prompt, (3) write a minimal checkpoint on exit if the agent didn't save explicitly. All changes in two files.

**Tech Stack:** Node.js (ESM), ContextDB CLI (`ctx`), existing `memo` module

---

### Task 1: Add `ensureWorkspaceMemorySession()` to workspace-memory.mjs

**Files:**
- Modify: `scripts/lib/memo/workspace-memory.mjs`

- [ ] **Step 1: Read current file to confirm structure**

```bash
cat scripts/lib/memo/workspace-memory.mjs
```

Expected: Exports `workspaceMemorySessionId`, `workspaceMemoryMetaPath`, `workspaceMemoryPinnedPath`, `workspaceMemoryEventsPath`, etc.

- [ ] **Step 2: Add `ensureWorkspaceMemorySession()` function**

Append after the existing exports at the end of `scripts/lib/memo/workspace-memory.mjs`:

```javascript
import { existsSync } from 'node:fs';
import { mkdirSync, writeFileSync } from 'node:fs';

export function ensureWorkspaceMemorySession(workspaceRoot, space = 'default') {
  const sessionId = workspaceMemorySessionId(space);
  const dir = workspaceMemorySessionDir(workspaceRoot, sessionId);
  const metaPath = workspaceMemoryMetaPath(workspaceRoot, sessionId);

  if (existsSync(metaPath)) {
    return { created: false, sessionId, dir };
  }

  mkdirSync(dir, { recursive: true });
  writeFileSync(metaPath, JSON.stringify({
    schemaVersion: 1,
    agent: 'workspace-memory',
    project: 'workspace-memory',
    goal: `Workspace memory for space: ${space}`,
    status: 'running',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, null, 2) + '\n', 'utf8');

  // Ensure pinned.md exists (empty)
  const pinnedPath = workspaceMemoryPinnedPath(workspaceRoot, sessionId);
  if (!existsSync(pinnedPath)) {
    writeFileSync(pinnedPath, '', 'utf8');
  }

  // Ensure l2-events.jsonl exists (empty)
  const eventsPath = workspaceMemoryEventsPath(workspaceRoot, sessionId);
  if (!existsSync(eventsPath)) {
    writeFileSync(eventsPath, '', 'utf8');
  }

  return { created: true, sessionId, dir };
}
```

- [ ] **Step 3: Verify import compatibility**

Check that `existsSync` from `node:fs` and `mkdirSync`/`writeFileSync` from `node:fs` are not already imported with conflicting names. The file currently has no `fs` import — it only uses `createHash` from `node:crypto` and `path` from `node:path`. The new imports are safe.

- [ ] **Step 4: Commit**

```bash
git add scripts/lib/memo/workspace-memory.mjs
git commit -m "feat(memo): add ensureWorkspaceMemorySession() for auto-init"
```

---

### Task 2: Add `ensureMemoryLayers()` to ctx-agent-core.mjs

**Files:**
- Modify: `scripts/ctx-agent-core.mjs:1-20` (imports)
- Modify: `scripts/ctx-agent-core.mjs:~1695` (before lazy/full branch)

- [ ] **Step 1: Read current imports**

Confirm line 17 has `import { buildPersonaOverlay } from './lib/memo/persona.mjs';` and line 16 imports from workspace-memory.mjs.

- [ ] **Step 2: Add import for `ensureWorkspaceMemorySession`**

In `scripts/ctx-agent-core.mjs`, line 10-16, add `ensureWorkspaceMemorySession` to the workspace-memory import:

Change line 10-16 from:
```javascript
import {
  normalizeWorkspaceMemorySpace,
  workspaceMemoryEventsPath,
  workspaceMemoryMetaPath,
  workspaceMemoryPinnedPath,
  workspaceMemorySessionId,
  workspaceMemoryStatePath,
} from './lib/memo/workspace-memory.mjs';
```

To:
```javascript
import {
  ensureWorkspaceMemorySession,
  normalizeWorkspaceMemorySpace,
  workspaceMemoryEventsPath,
  workspaceMemoryMetaPath,
  workspaceMemoryPinnedPath,
  workspaceMemorySessionId,
  workspaceMemoryStatePath,
} from './lib/memo/workspace-memory.mjs';
```

- [ ] **Step 3: Add import for `ensurePersonaLayer`**

In `scripts/ctx-agent-core.mjs`, line 17, change:
```javascript
import { buildPersonaOverlay } from './lib/memo/persona.mjs';
```
To:
```javascript
import { buildPersonaOverlay, ensurePersonaLayer } from './lib/memo/persona.mjs';
```

- [ ] **Step 4: Add import for `readFile` from `node:fs/promises`**

Check if `readFile` from `node:fs/promises` is already imported. Line 4 has `import { promises as fs } from 'node:fs';` — so `fs.readFile` is available. No additional import needed.

- [ ] **Step 5: Add `ensureMemoryLayers()` function**

Insert before the `runCtxAgent` export (before line ~1635). Find a good location — after the `buildMemoryPrelude` function (ends at line ~816) and before other functions. Insert after line 816:

```javascript
async function ensureMemoryLayers(workspaceRoot, { agent = 'claude-code', project = 'aios' } = {}) {
  // Layer 1: Ensure persona exists
  try {
    ensurePersonaLayer('persona', { env: process.env });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[warn] persona init skipped: ${reason}`);
  }

  // Layer 2: Ensure user profile exists
  try {
    ensurePersonaLayer('user', { env: process.env });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[warn] user profile init skipped: ${reason}`);
  }

  // Layer 3: Ensure workspace memory session exists
  try {
    ensureWorkspaceMemorySession(workspaceRoot);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[warn] workspace memory init skipped: ${reason}`);
  }

  // Layer 4: Refresh facade cache
  try {
    const facadePath = path.join(workspaceRoot, 'memory', 'context-db', '.facade.json');
    const facade = await generateFacadeFromSession(workspaceRoot, agent, project);
    await fs.writeFile(facadePath, JSON.stringify(facade, null, 2) + '\n', 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.warn(`[warn] facade refresh skipped: ${reason}`);
  }
}
```

- [ ] **Step 6: Call `ensureMemoryLayers()` in `runCtxAgent()`**

In `scripts/ctx-agent-core.mjs`, insert the call right before the lazy mode check. Find line 1696:
```javascript
  const lazyMode = shouldLazyLoad(process.env);
```

Insert before it:
```javascript
  await ensureMemoryLayers(opts.workspaceRoot, { agent: opts.agent, project: opts.project });
```

- [ ] **Step 7: Commit**

```bash
git add scripts/ctx-agent-core.mjs
git commit -m "feat(agent): auto-init memory layers on startup"
```

---

### Task 3: Add `buildPersistenceInstructions()` and inject into prompt

**Files:**
- Modify: `scripts/ctx-agent-core.mjs` — add function and modify prompt assembly

- [ ] **Step 1: Add `buildPersistenceInstructions()` function**

Insert after the `ensureMemoryLayers` function added in Task 2:

```javascript
function buildPersistenceInstructions() {
  return [
    '## Memory Persistence (AIOS)',
    '',
    'Before finishing a work session or completing a multi-step task, save your progress:',
    '',
    '- Quick note: `aios memo add "描述当前进展和下一步"`',
    '- Pin important facts: `aios memo pin add "需要跨会话记住的关键信息"`',
    '',
    'Save when:',
    '- You complete a significant task or subtask',
    '- You encounter a blocker you can\'t resolve',
    '- You\'re about to end the session',
    '- You discover something non-obvious that future sessions need to know',
    '',
    'Do NOT save routine progress or trivial updates.',
  ].join('\n');
}
```

- [ ] **Step 2: Inject into lazy mode prompt assembly**

In the lazy mode block (around line 1720-1725), change:

```javascript
    const basePrompt = memoryPrelude
      ? `${memoryPrelude}\n\n${facadePrompt}`
      : facadePrompt;
    const effectivePrompt = routerGuide
      ? `${basePrompt}\n\n${routerGuide}`
      : basePrompt;
```

To:

```javascript
    const persistenceInstructions = buildPersistenceInstructions();
    const basePrompt = memoryPrelude
      ? `${memoryPrelude}\n\n${persistenceInstructions}\n\n${facadePrompt}`
      : `${persistenceInstructions}\n\n${facadePrompt}`;
    const effectivePrompt = routerGuide
      ? `${basePrompt}\n\n${routerGuide}`
      : basePrompt;
```

- [ ] **Step 3: Inject into non-lazy mode prompt assembly**

In the non-lazy mode block (around line 1788-1792), change:

```javascript
  const baseContextText = memoryPrelude
    ? contextText
      ? `${memoryPrelude}\n\n${contextText}`
      : memoryPrelude
    : contextText;
```

To:

```javascript
  const persistenceInstructions = buildPersistenceInstructions();
  const baseContextText = memoryPrelude
    ? contextText
      ? `${memoryPrelude}\n\n${persistenceInstructions}\n\n${contextText}`
      : `${memoryPrelude}\n\n${persistenceInstructions}`
    : contextText
      ? `${persistenceInstructions}\n\n${contextText}`
      : persistenceInstructions;
```

- [ ] **Step 4: Commit**

```bash
git add scripts/ctx-agent-core.mjs
git commit -m "feat(agent): inject memory persistence instructions into system prompt"
```

---

### Task 4: Add trap-based fallback checkpoint

**Files:**
- Modify: `scripts/ctx-agent-core.mjs` — add `runInteractiveAgentWithSaveGuard()` and wrap both call sites

- [ ] **Step 1: Add `runInteractiveAgentWithSaveGuard()` function**

Insert before the `runInteractiveAgent` function definition (before line 1497):

```javascript
function runInteractiveAgentWithSaveGuard(agent, contextText, extraArgs, opts) {
  const sessionId = opts.sessionId || '';
  const workspaceRoot = opts.workspaceRoot || '';

  // Record mtime of l2-events.jsonl to detect if agent saved during session
  let eventsMtimeMs = 0;
  if (sessionId && workspaceRoot) {
    try {
      const eventsPath = workspaceMemoryEventsPath(workspaceRoot, sessionId);
      const stats = statSync(eventsPath);
      eventsMtimeMs = stats.mtimeMs;
    } catch {
      // file doesn't exist yet — mtime stays 0
    }
  }

  const saveGuard = () => {
    // Check if meaningful save occurred (mtime changed)
    if (sessionId && workspaceRoot) {
      try {
        const eventsPath = workspaceMemoryEventsPath(workspaceRoot, sessionId);
        const stats = statSync(eventsPath);
        if (stats.mtimeMs > eventsMtimeMs) return; // agent saved something
      } catch {
        // can't read — fall through to write checkpoint
      }
    }

    try {
      const checkpointScript = path.join(ROOT_DIR, 'scripts', 'ctx-agent.mjs');
      spawnSync('node', [
        checkpointScript,
        '--agent', agent,
        '--workspace', workspaceRoot,
        '--project', opts.project || 'aios',
        '--checkpoint-status', 'completed',
        '--prompt', `Auto checkpoint: ${agent} session ended (no explicit save)`,
      ], { stdio: 'ignore', timeout: 10000 });
    } catch {
      // best-effort
    }
  };

  process.on('exit', saveGuard);

  runInteractiveAgent(agent, contextText, extraArgs, opts);
}
```

- [ ] **Step 2: Verify `statSync` is imported**

Check line 5: `import { existsSync, readdirSync, statSync } from 'node:fs';` — `statSync` is already imported. Good.

- [ ] **Step 3: Replace lazy mode call site**

In the lazy mode block (around line 1741), change:

```javascript
    runInteractiveAgent(opts.agent, effectivePrompt, opts.extraArgs, {
```

To:

```javascript
    runInteractiveAgentWithSaveGuard(opts.agent, effectivePrompt, opts.extraArgs, {
```

- [ ] **Step 4: Replace non-lazy mode call site**

In the non-lazy mode block (around line 2022), change:

```javascript
  runInteractiveAgent(opts.agent, effectiveContextText, opts.extraArgs, {
```

To:

```javascript
  runInteractiveAgentWithSaveGuard(opts.agent, effectiveContextText, opts.extraArgs, {
```

- [ ] **Step 5: Commit**

```bash
git add scripts/ctx-agent-core.mjs
git commit -m "feat(agent): add trap-based checkpoint fallback on session exit"
```

---

### Task 5: Integration verification

**Files:** None (verification only)

- [ ] **Step 1: Clean slate test — delete all memory artifacts**

```bash
rm -f ~/.aios/SOUL.md
rm -f ~/.aios/USER.md
rm -rf memory/context-db/sessions/workspace-memory--default/
rm -f memory/context-db/.facade.json
```

- [ ] **Step 2: Run ctx-agent startup and verify auto-init**

```bash
node scripts/ctx-agent.mjs --agent claude-code --workspace /Users/molei/codes/aios --project aios --dry-run 2>&1 | head -20
```

If `--dry-run` is not supported, just run without prompt (interactive mode) and immediately Ctrl+C:

```bash
timeout 5 node scripts/ctx-agent.mjs --agent claude-code --workspace /Users/molei/codes/aios --project aios 2>&1 || true
```

Expected output should include:
```
Memory prelude: enabled (persona/user/workspace layers)
```

- [ ] **Step 3: Verify files were created**

```bash
test -f ~/.aios/SOUL.md && echo "SOUL.md: OK" || echo "SOUL.md: MISSING"
test -f ~/.aios/USER.md && echo "USER.md: OK" || echo "USER.md: MISSING"
test -d memory/context-db/sessions/workspace-memory--default && echo "workspace-memory session: OK" || echo "workspace-memory session: MISSING"
test -f memory/context-db/.facade.json && echo "facade.json: OK" || echo "facade.json: MISSING"
```

Expected: all OK.

- [ ] **Step 4: Verify facade has valid session ID**

```bash
cat memory/context-db/.facade.json | grep sessionId
```

Expected: should show a non-empty sessionId (not `""`).

- [ ] **Step 5: Commit verification artifacts if any were accidentally created**

```bash
git status
```

If any test artifacts show up, clean them:
```bash
git checkout -- memory/context-db/.facade.json 2>/dev/null || true
```

- [ ] **Step 6: Final commit with all changes**

```bash
git add -A
git status
git commit -m "feat: fix memory amnesia — three-layer defense (auto-init + persistence prompt + trap fallback)"
```
