# AIOS P0 Competitor Enhancements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the P0 competitor findings into five independent PR-sized upgrades for ContextDB, team reliability, session continuity, plan/ownership gates, and browser evidence.

**Architecture:** Each PR lands as an independently testable slice and avoids cross-PR coupling. Shared contracts are JSON-first so `hud`, `team`, `orchestrate`, Browser MCP, and ContextDB can consume the same evidence without parsing prose.

**Tech Stack:** Node.js 22 ESM scripts, TypeScript MCP server, Node `--test`, ContextDB filesystem/SQLite index, Playwright Browser MCP, AIOS lifecycle commands.

---

## Source Analysis

Primary roadmap: `docs/plans/2026-04-25-competitor-feature-roadmap.md`

P0 competitor references:

- OpenViking / OpenClaw Recall: ContextDB explainability and hygiene.
- long-running-tasks / OpenHarness / lazy-harness: watchdog, dry-run readiness, compact continuity.
- execplan-skills / oh-my-openagent: plan discipline, ownership visibility, edit safety.
- vision-test-harness: browser smoke flows, screenshot diff, privacy overlay, HTML reports.

## PR Boundaries

| PR | Slice | Primary command/API | Merge independence |
|---|---|---|---|
| PR-1 | ContextDB explain + hygiene | `contextdb search --explain`, `contextdb hygiene:*` | Independent; touches only ContextDB CLI/core/tests. |
| PR-2 | Team watchdog + recovery decision | `aios team status --watchdog`, `aios team watchdog` | Independent; reads team artifacts and git/workspace signals. |
| PR-3 | Compact continuity chain | `ctx-agent` session summary hooks + `contextdb continuity:*` | Independent; appends ContextDB artifacts and exports. |
| PR-4 | Plan/ownership preflight gates | `aios orchestrate --preflight auto`, `aios team --dry-run` | Independent after PR-1/2; can start with existing artifacts. |
| PR-5 | Browser smoke evidence report | `browser_smoke` / `browser_test_run` | Independent; new Browser MCP action and tests. |

## Shared Contracts

### Readiness Verdict

Use this shape anywhere a command can block before expensive/live work:

```json
{
  "verdict": "ready",
  "blockedReasons": [],
  "warnings": [],
  "nextActions": [],
  "evidence": []
}
```

Allowed `verdict`: `ready`, `warning`, `blocked`.

### Recovery Decision

Use this shape for watchdog and recovery suggestions:

```json
{
  "decision": "observe",
  "reason": "worker is active",
  "signals": {
    "commitAgeMinutes": 4,
    "fileActivityAgeMinutes": 1,
    "logAgeMinutes": 1,
    "cpuState": "active"
  },
  "nextActions": []
}
```

Allowed `decision`: `observe`, `retry`, `respawn`, `rollback`, `human_gate`, `pause`.

### Evidence Item

Use this shape for ContextDB, HUD, team, and browser reports:

```json
{
  "type": "file",
  "path": "memory/context-db/exports/example-context.md",
  "summary": "Context pack written",
  "createdAt": "2026-04-25T00:00:00.000Z"
}
```

## PR-1: ContextDB Explain + Hygiene

**Goal:** Make ContextDB retrieval inspectable and maintainable before changing ranking algorithms.

**Files:**

- Modify: `mcp-server/src/contextdb/cli.ts`
- Modify: `mcp-server/src/contextdb/core.ts`
- Create: `mcp-server/src/contextdb/explain.ts`
- Create: `mcp-server/src/contextdb/hygiene.ts`
- Modify: `mcp-server/tests/contextdb.test.ts`
- Create: `mcp-server/tests/contextdb-explain.test.ts`
- Create: `mcp-server/tests/contextdb-hygiene.test.ts`
- Modify: `README.md`

**Command contract:**

```bash
cd mcp-server
npm run contextdb -- search --query "browser smoke" --scope all --limit 5 --explain
npm run contextdb -- hygiene:status --workspace ..
npm run contextdb -- hygiene:prune-noise --workspace .. --dry-run
npm run contextdb -- hygiene:compact --workspace .. --dry-run
```

**Expected JSON fields for `search --explain`:**

```json
{
  "results": [
    {
      "itemType": "event",
      "sessionId": "codex-cli-20260425T000000-demo",
      "score": 1,
      "explain": {
        "retrievalMode": "lexical",
        "queryTokens": ["browser", "smoke"],
        "matchedTokens": ["browser"],
        "scoreParts": {
          "textMatch": 1,
          "semantic": 0,
          "recency": 0
        },
        "suppressionReasons": []
      }
    }
  ]
}
```

**Tasks:**

- [ ] **Step 1: Add failing tests for explain output**

  Add `mcp-server/tests/contextdb-explain.test.ts` with tests that create a temp ContextDB session, add two events, run `searchEvents`/`searchMemory` with `explain: true`, and assert every result has `explain.retrievalMode`, `queryTokens`, `matchedTokens`, `scoreParts`, and `suppressionReasons`.

  Run:

  ```bash
  cd mcp-server
  npm run test -- tests/contextdb-explain.test.ts
  ```

  Expected before implementation: TypeScript/test failure because `explain` is not a supported input/output field.

- [ ] **Step 2: Implement explain helpers**

  Create `mcp-server/src/contextdb/explain.ts` with pure helpers:

  ```ts
  export type ContextDbRetrievalMode = 'lexical' | 'semantic' | 'hybrid' | 'tail';

  export interface ContextDbSearchExplain {
    retrievalMode: ContextDbRetrievalMode;
    queryTokens: string[];
    matchedTokens: string[];
    scoreParts: {
      textMatch: number;
      semantic: number;
      recency: number;
    };
    suppressionReasons: string[];
  }
  ```

  Reuse the tokenization approach already present in `mcp-server/src/contextdb/semantic.ts`; do not introduce an external tokenizer.

- [ ] **Step 3: Wire explain into search outputs**

  Modify `SearchEventsInput`, `SearchCheckpointsInput`, and `SearchMemoryInput` in `mcp-server/src/contextdb/core.ts` to accept `explain?: boolean`. When false or omitted, preserve current output shape. When true, attach `explain` to each returned result.

- [ ] **Step 4: Add CLI flag**

  Modify `mcp-server/src/contextdb/cli.ts` search command so `--explain` passes `explain: true`; update usage text.

- [ ] **Step 5: Add hygiene status and dry-run prune tests**

  Add `mcp-server/tests/contextdb-hygiene.test.ts` covering:

  - `hygieneStatus(workspaceRoot)` returns counts for sessions, events, checkpoints, exports, staleExports, suspectedNoise.
  - `pruneNoise({ dryRun: true })` returns candidate counts and does not mutate files.
  - `compactContextDb({ dryRun: true })` returns planned actions and does not mutate files.

- [ ] **Step 6: Implement hygiene module and CLI commands**

  Create `mcp-server/src/contextdb/hygiene.ts` and add CLI commands:

  ```bash
  contextdb hygiene:status [--workspace <path>]
  contextdb hygiene:prune-noise [--workspace <path>] [--dry-run]
  contextdb hygiene:compact [--workspace <path>] [--dry-run]
  ```

  Keep first version conservative: report candidates and support dry-run; only allow mutation after tests explicitly cover it in a later PR.

- [ ] **Step 7: Verify PR-1**

  Run:

  ```bash
  cd mcp-server
  npm run typecheck
  npm run test -- tests/contextdb.test.ts tests/contextdb-explain.test.ts tests/contextdb-hygiene.test.ts
  npm run build
  ```

  Expected: all commands pass.

## PR-2: Team Watchdog + Recovery Decision

**Goal:** Turn team stall visibility into actionable recovery decisions without killing or restarting processes in the first PR.

**Files:**

- Create: `scripts/lib/lifecycle/watchdog.mjs`
- Modify: `scripts/lib/lifecycle/team-ops.mjs`
- Modify: `scripts/lib/hud/state.mjs`
- Create: `scripts/tests/team-watchdog.test.mjs`
- Modify: `scripts/tests/aios-cli.test.mjs`
- Modify: `README.md`

**Command contract:**

```bash
node scripts/aios.mjs team watchdog --session <session-id> --json
node scripts/aios.mjs team status --session <session-id> --watchdog --json
```

**Expected JSON:**

```json
{
  "sessionId": "codex-cli-20260425T000000-demo",
  "decision": "observe",
  "reason": "recent file activity and fresh logs detected",
  "signals": {
    "commitAgeMinutes": 4,
    "fileActivityAgeMinutes": 1,
    "logAgeMinutes": 1,
    "cpuState": "unknown"
  },
  "nextActions": []
}
```

**Tasks:**

- [ ] **Step 1: Write pure watchdog tests**

  Add tests for `decideWatchdogRecovery(signals)`:

  - fresh commit/file/log signals return `observe`.
  - stale commit + stale file + stale log + dead process returns `respawn`.
  - `.pause` file present returns `pause`.
  - blocked job with rollback artifact returns `rollback` only as a suggested decision, not an automatic mutation.

- [ ] **Step 2: Implement pure decision engine**

  Create `scripts/lib/lifecycle/watchdog.mjs` exporting:

  ```js
  export function decideWatchdogRecovery(signals = {}) {}
  export async function collectWatchdogSignals({ rootDir, sessionId, workspaceRoot = process.cwd() } = {}) {}
  export async function runTeamWatchdog(options = {}, io = console) {}
  ```

  The first version must not kill processes, restart workers, or roll back files. It only returns a decision and next commands.

- [ ] **Step 3: Wire CLI routing**

  Modify `scripts/lib/lifecycle/team-ops.mjs` and `scripts/aios.mjs` dispatch so `team watchdog` works and `team status --watchdog` includes the decision object.

- [ ] **Step 4: Add HUD exposure**

  Add `watchdog` under HUD state in `scripts/lib/hud/state.mjs` so future renderers can show `decision`, `reason`, and `nextActions`.

- [ ] **Step 5: Verify PR-2**

  Run:

  ```bash
  npm run test:scripts -- scripts/tests/team-watchdog.test.mjs scripts/tests/aios-cli.test.mjs scripts/tests/hud-state.test.mjs
  ```

  If `npm run test:scripts -- <files>` is not supported, run:

  ```bash
  node --test scripts/tests/team-watchdog.test.mjs scripts/tests/aios-cli.test.mjs scripts/tests/hud-state.test.mjs
  ```

## PR-3: Compact Continuity Chain

**Goal:** Prevent long-session state loss by saving a working summary before compaction/session end and reinjecting it on next session start/context pack.

**Files:**

- Create: `scripts/lib/contextdb/continuity.mjs`
- Modify: `scripts/ctx-agent-core.mjs`
- Modify: `scripts/ctx-agent.mjs`
- Modify: `scripts/lib/contextdb/facade.mjs`
- Create: `scripts/tests/contextdb-continuity.test.mjs`
- Modify: `scripts/tests/ctx-agent-core.test.mjs`
- Modify: `README.md`

**Command contract:**

```bash
node scripts/ctx-agent.mjs --agent codex-cli --project demo --prompt "continue" --continuity-summary
node scripts/aios.mjs memo add "manual checkpoint #continuity"
```

**Artifact contract:**

```text
memory/context-db/sessions/<session-id>/continuity-summary.md
memory/context-db/sessions/<session-id>/continuity.json
```

`continuity.json` shape:

```json
{
  "schemaVersion": 1,
  "sessionId": "codex-cli-20260425T000000-demo",
  "intent": "continue implementation",
  "touchedFiles": ["scripts/ctx-agent-core.mjs"],
  "nextActions": ["run focused tests"],
  "updatedAt": "2026-04-25T00:00:00.000Z"
}
```

**Tasks:**

- [ ] **Step 1: Write continuity artifact tests**

  Add `scripts/tests/contextdb-continuity.test.mjs` covering `writeContinuitySummary`, `readContinuitySummary`, and `renderContinuityInjection` using a temp workspace.

- [ ] **Step 2: Implement continuity module**

  Create `scripts/lib/contextdb/continuity.mjs` with pure file operations and atomic writes. Keep summary content deterministic and local-only.

- [ ] **Step 3: Wire session-end summary writing**

  Modify `scripts/ctx-agent-core.mjs` so one-shot mode writes a continuity summary after checkpoint/context-pack. Do not write after every interactive turn; preserve current README limitation and update it to explain the new one-shot continuity behavior.

- [ ] **Step 4: Wire session-start injection**

  Modify context pack/startup prompt assembly so the latest continuity summary for the selected session is included as a short section named `Continuity Summary`.

- [ ] **Step 5: Verify PR-3**

  Run:

  ```bash
  node --test scripts/tests/contextdb-continuity.test.mjs scripts/tests/ctx-agent-core.test.mjs scripts/tests/contextdb-facade.test.mjs
  ```

## PR-4: Plan + Ownership Preflight Gates

**Goal:** Block risky multi-step/team runs when plan evidence or editable ownership evidence is missing.

**Files:**

- Create: `scripts/lib/lifecycle/preflight-contracts.mjs`
- Modify: `scripts/lib/lifecycle/orchestrate.mjs`
- Modify: `scripts/lib/lifecycle/team-ops.mjs`
- Modify: `scripts/lib/harness/orchestrator.mjs`
- Create: `scripts/tests/preflight-contracts.test.mjs`
- Modify: `scripts/tests/aios-orchestrator.test.mjs`
- Modify: `scripts/tests/aios-orchestrator-agents.test.mjs`
- Modify: `README.md`

**Readiness contract:**

```json
{
  "verdict": "blocked",
  "blockedReasons": ["missing_plan_artifact", "missing_owned_path_prefixes"],
  "warnings": [],
  "nextActions": [
    "Create docs/plans/<date>-<topic>.md with Progress, DecisionLog, Acceptance, NextActions",
    "Add ownedPathPrefixes for each write-capable work item"
  ],
  "evidence": []
}
```

**Tasks:**

- [ ] **Step 1: Write contract tests**

  Add tests for:

  - `evaluatePlanEvidence({ planPath })` returns blocked when file missing.
  - `evaluatePlanEvidence({ markdown })` returns blocked when required headings are missing.
  - `evaluateOwnershipEvidence({ workItems })` returns blocked when write-capable item lacks `ownedPathPrefixes`.
  - complete evidence returns `ready`.

- [ ] **Step 2: Implement preflight contracts**

  Create `scripts/lib/lifecycle/preflight-contracts.mjs` exporting:

  ```js
  export const REQUIRED_PLAN_HEADINGS = ['Progress', 'Decision Log', 'Acceptance', 'Next Actions'];
  export function evaluatePlanEvidence(input = {}) {}
  export function evaluateOwnershipEvidence(input = {}) {}
  export function mergeReadinessVerdicts(...verdicts) {}
  ```

- [ ] **Step 3: Wire orchestrate dry-run/preflight**

  Modify `scripts/lib/lifecycle/orchestrate.mjs` so `--preflight auto` includes plan/ownership readiness. For the first PR, block only live execution; dry-run should report blockers without throwing.

- [ ] **Step 4: Wire team dry-run**

  Modify `scripts/lib/lifecycle/team-ops.mjs` so `aios team ... --dry-run` includes the readiness object.

- [ ] **Step 5: Verify PR-4**

  Run:

  ```bash
  node --test scripts/tests/preflight-contracts.test.mjs scripts/tests/aios-orchestrator.test.mjs scripts/tests/aios-orchestrator-agents.test.mjs
  ```

## PR-5: Browser Smoke Evidence Report

**Goal:** Add a small, deterministic browser-flow runner that produces screenshots, assertion evidence, privacy-safe reports, and future-ready baseline diff hooks.

**Files:**

- Create: `mcp-server/src/browser/actions/smoke.ts`
- Create: `mcp-server/src/browser/actions/privacy-overlay.ts`
- Create: `mcp-server/src/browser/actions/smoke-report.ts`
- Modify: `mcp-server/src/browser/index.ts`
- Modify: `mcp-server/src/index.ts`
- Create: `mcp-server/tests/browser-smoke.test.ts`
- Create: `mcp-server/tests/browser-privacy-overlay.test.ts`
- Modify: `mcp-server/README.md`

**Tool contract:**

`browser_smoke` input:

```json
{
  "profile": "default",
  "flow": [
    { "action": "goto", "url": "https://example.com" },
    { "action": "assert_text", "text": "Example Domain" },
    { "action": "screenshot", "name": "home" }
  ],
  "reportDir": "temp/browser-smoke/example",
  "privacyOverlay": true
}
```

`browser_smoke` output:

```json
{
  "success": true,
  "reportPath": "temp/browser-smoke/example/report.html",
  "steps": [
    { "index": 0, "action": "goto", "status": "passed" },
    { "index": 1, "action": "assert_text", "status": "passed" },
    { "index": 2, "action": "screenshot", "status": "passed", "screenshotPath": "temp/browser-smoke/example/home.png" }
  ],
  "privacyOverlayApplied": true
}
```

**Tasks:**

- [ ] **Step 1: Write privacy overlay tests**

  Add tests that pass HTML/text evidence containing emails, long tokens, and phone-like numbers, then assert redacted output contains `[redacted-email]`, `[redacted-token]`, and `[redacted-phone]`.

- [ ] **Step 2: Implement privacy overlay**

  Create `mcp-server/src/browser/actions/privacy-overlay.ts` with pure redaction helpers. Do not modify image pixels in this first PR; redact HTML/text report content and screenshot metadata captions.

- [ ] **Step 3: Write smoke runner tests**

  Add `mcp-server/tests/browser-smoke.test.ts` using a local/static page or mocked page object pattern already used by browser tests. Cover `goto`, `assert_text`, `screenshot`, failed assertion, and report path creation.

- [ ] **Step 4: Implement smoke runner**

  Create `mcp-server/src/browser/actions/smoke.ts` supporting actions: `goto`, `click`, `type`, `assert_text`, `screenshot`, `wait`. Keep pixel diff as a future extension; include `baselineStatus: 'not_configured'` in report metadata.

- [ ] **Step 5: Implement HTML report**

  Create `mcp-server/src/browser/actions/smoke-report.ts` that writes a self-contained HTML report with summary, step table, redacted text evidence, and links to local screenshots.

- [ ] **Step 6: Register MCP tool**

  Modify `mcp-server/src/browser/index.ts` and `mcp-server/src/index.ts` to expose `browser_smoke` with JSON schema and route execution.

- [ ] **Step 7: Verify PR-5**

  Run:

  ```bash
  cd mcp-server
  npm run typecheck
  npm run test -- tests/browser-smoke.test.ts tests/browser-privacy-overlay.test.ts
  npm run build
  ```

## Integration Order

1. Merge PR-1 first so other evidence systems can attach explain/hygiene outputs.
2. Merge PR-2 and PR-3 in either order; they are independent reliability upgrades.
3. Merge PR-4 after PR-2 if you want watchdog readiness in the same preflight output; otherwise PR-4 can land with plan/ownership only.
4. Merge PR-5 independently; later wire its report evidence into HUD.

## Final Verification Gate

After all P0 PRs land, run:

```bash
npm run test:scripts
cd mcp-server && npm run typecheck && npm run test && npm run build
```

Manual smoke for browser PR:

```bash
cd mcp-server
npm run dev
# From an MCP client, run browser_launch -> browser_smoke -> browser_screenshot -> browser_close if available.
```

## Self-Review

- Spec coverage: all P0 items from `docs/plans/2026-04-25-competitor-feature-roadmap.md` map to PR-1 through PR-5.
- Placeholder scan: checked for banned placeholder language; the PR tasks use concrete commands, files, and contracts.
- Type consistency: shared contracts use the same `verdict`, `decision`, `signals`, `nextActions`, and `evidence` field names throughout.
