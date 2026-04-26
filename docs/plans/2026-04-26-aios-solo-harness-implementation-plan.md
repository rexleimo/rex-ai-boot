# AIOS Solo Harness 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 AIOS 增加一个受 `gnhf` 启发的单任务、可过夜、可恢复的 `harness` 模式，同时保留 `ContextDB`、`snapshot rollback`、`watchdog`、`team/orchestrate` 现有优势。

**Architecture:** 新能力通过独立的 `harness` 命名空间落地，不改写 `team` 和 `orchestrate`。`ContextDB` 继续做规范化记忆层，新增 `run journal` 作为人类可快速阅读的夜跑视图；失败分类、退避、worktree 隔离、resume/status/stop 都围绕 session artifact 组织。

**Tech Stack:** Node.js 22 ESM CLI、Node `--test`、ContextDB session artifacts、git worktree、现有 AIOS lifecycle/hud 模块。

---

## Source Analysis

主路线图：`docs/plans/2026-04-26-gnhf-harness-roadmap.md`

实现计划必须尊重当前仓库现实，而不是重新发明已有能力：

- `scripts/lib/lifecycle/watchdog.mjs` 已经具备 stall / rollback / retry / pause 决策，不要再造第二套 “team-style watchdog”。
- `scripts/lib/contextdb/continuity.mjs` 已经具备 `continuity-summary.md` / `continuity.json` 写入能力，solo harness 应该复用它来做 resume 注入。
- `scripts/lib/rl-shell-v1/worktree-runner.mjs` 已经证明仓库内的 worktree 生命周期模式可行，solo overnight mode 应复用同样的 git worktree 思路。
- `scripts/lib/harness/subagent-runtime.mjs` 已经有客户端启动、spawn、owned-path snapshot 经验；solo harness 可以借鉴其 runtime discipline，但不要把 orchestrator 的整套复杂面直接搬过来。
- `scripts/lib/hud/state.mjs` 和 `scripts/lib/hud/render.mjs` 已经是会话态展示入口，状态面板应扩展而不是平行再造。

## 非目标

- 不用 `notes.md` 取代 `ContextDB`。
- 不复制 `gnhf` 的 blanket `git reset --hard`。
- 不把 `team` / `orchestrate` 简化掉；本计划只新增 `harness` lane。
- 不在本阶段做 Browser MCP、新的多 agent DAG、ContextDB schema 重写。

## PR Boundaries

| PR | Slice | Primary command/API | Why this slice stands alone |
|---|---|---|---|
| PR-1 | `harness` CLI + run journal dry-run skeleton | `node scripts/aios.mjs harness run --objective "..." --dry-run` | 先把入口、帮助文本、artifact contract 建起来，用户能看懂夜跑目录。 |
| PR-2 | iteration outcome + failure policy + basic solo loop | `node scripts/aios.mjs harness run --objective "..."` | 先让每轮执行有统一输出和退避语义，再谈隔离与运营。 |
| PR-3 | worktree-backed overnight mode | `node scripts/aios.mjs harness run --objective "..." --worktree` | 独立解决“不过夜污染主工作区”的核心痛点。 |
| PR-4 | status / stop / resume + HUD integration | `harness status|stop|resume`、`hud --session <id>` | 让夜跑可以被接手、暂停、恢复、观察。 |
| PR-5 | provider profile hardening + docs + compatibility verification | provider registry / README | 把 `codex` / `claude` / `gemini` / `opencode` 行为差异收敛，补完 operator UX。 |

## File Structure Map

### New files

- `scripts/lib/lifecycle/harness.mjs`  
  `harness run|status|resume|stop` 的入口与子命令调度；串联 journal、runtime、worktree、status 输出。

- `scripts/lib/harness/solo-journal.mjs`  
  run journal 的路径、原子写入、`run-summary.json`、`control.json`、`iteration-*.json`、`iteration-*.log.jsonl` 管理。

- `scripts/lib/harness/solo-runtime.mjs`  
  单轮执行循环、iteration outcome 规范化、失败分类、退避状态机、ContextDB continuity 写入。

- `scripts/lib/harness/solo-worktree.mjs`  
  `git worktree` 创建、保留、自动清理、成果判断，不使用全局 reset。

- `scripts/lib/harness/solo-profiles.mjs`  
  solo harness 的 provider/client registry、命令构造、reserved flag 保护、二进制可用性检查。

- `scripts/tests/harness-journal.test.mjs`  
  journal 路径、原子写入、summary 更新、control 文件读写测试。

- `scripts/tests/harness-runtime.test.mjs`  
  outcome contract、failure classification、backoff、resume 注入测试。

- `scripts/tests/harness-worktree.test.mjs`  
  run-specific worktree 创建、保留、无成果清理测试。

- `scripts/tests/harness-profiles.test.mjs`  
  provider profile 正常路径、错误信息、reserved flag 保护测试。

### Modified files

- `scripts/lib/lifecycle/options.mjs`  
  增加 harness provider / format / 子命令默认值与 normalize helper。

- `scripts/lib/cli/parse-args.mjs`  
  新增 `harness` 命令解析，并支持 `run|status|resume|stop` 子命令。

- `scripts/lib/cli/help.mjs`  
  更新根帮助与 `harness` 帮助文本、示例命令。

- `scripts/aios.mjs`  
  顶层命令调度到 `runHarnessCommand`。

- `scripts/lib/hud/state.mjs`  
  读取 solo harness journal，向 HUD 暴露 `latestHarnessRun` / `harnessControl` / `harnessSuggestedCommands`。

- `scripts/lib/hud/render.mjs`  
  渲染 harness summary、stop requested、backoff、worktree 状态。

- `scripts/tests/aios-cli.test.mjs`  
  验证 CLI parse/help/dispatch 合同。

- `scripts/tests/hud-state.test.mjs`  
  验证 HUD 能看到 harness 状态，而不是只会寻找 dispatch artifact。

- `scripts/tests/aios-harness.test.mjs`  
  保留现有 harness profile 测试，并补充 `harness` 命令级 smoke/contract 验证。

- `package.json`  
  `test:scripts` 显式加入新增 harness 测试文件。

- `README.md`  
  增加中文友好的 CLI 示例、night-run 使用说明和恢复流程说明。

## Shared Contracts

### Run journal layout

所有 solo harness artifact 放到 `memory/context-db/sessions/<sessionId>/artifacts/solo-harness/`：

```text
memory/context-db/sessions/<sessionId>/
  continuity-summary.md
  continuity.json
  artifacts/
    solo-harness/
      objective.md
      operator-notes.md
      control.json
      run-summary.json
      iteration-0001.json
      iteration-0001.log.jsonl
      iteration-0002.json
      iteration-0002.log.jsonl
```

### `run-summary.json`

```json
{
  "schemaVersion": 1,
  "kind": "solo-harness.run-summary",
  "sessionId": "codex-cli-20260426T220000-demo",
  "objective": "Ship the nightly release checklist",
  "status": "running",
  "provider": "codex",
  "clientId": "codex-cli",
  "profile": "standard",
  "iterationCount": 2,
  "lastIteration": 2,
  "lastOutcome": "success",
  "lastFailureClass": "none",
  "stopRequested": false,
  "backoff": {
    "consecutiveInfraFailures": 0,
    "nextDelayMs": 0,
    "until": null
  },
  "worktree": {
    "enabled": true,
    "baseRef": "HEAD",
    "path": "/tmp/aios-solo-harness-123/repo",
    "preserved": true,
    "cleanupReason": ""
  },
  "continuity": {
    "markdownPath": "memory/context-db/sessions/codex-cli-20260426T220000-demo/continuity-summary.md",
    "jsonPath": "memory/context-db/sessions/codex-cli-20260426T220000-demo/continuity.json"
  },
  "createdAt": "2026-04-26T14:00:00.000Z",
  "updatedAt": "2026-04-26T14:10:00.000Z"
}
```

Allowed `status`: `running`, `backoff`, `blocked`, `human-gate`, `stopped`, `done`, `failed`.

### `iteration-<n>.json`

```json
{
  "schemaVersion": 1,
  "kind": "solo-harness.iteration",
  "sessionId": "codex-cli-20260426T220000-demo",
  "iteration": 2,
  "outcome": "success",
  "summary": "Created a draft checklist and persisted continuity summary.",
  "keyChanges": [
    "docs/release/checklist.md"
  ],
  "keyLearnings": [
    "Current release gate still requires manual browser smoke validation."
  ],
  "nextAction": "Run quality gate before promoting the checklist.",
  "shouldStop": false,
  "failureClass": "none",
  "backoffAction": "none",
  "checkpointStatus": "running",
  "createdAt": "2026-04-26T14:08:00.000Z"
}
```

Allowed `outcome`: `success`, `noop`, `blocked`, `infra-retry`, `human-gate`, `stopped`, `failed`.

Allowed `failureClass`: `none`, `no-progress`, `tool-error`, `runtime-error`, `workspace-mutation`, `ownership-gate`, `safety-gate`, `stop-requested`.

### `control.json`

```json
{
  "schemaVersion": 1,
  "kind": "solo-harness.control",
  "sessionId": "codex-cli-20260426T220000-demo",
  "stopRequested": true,
  "reason": "operator-request",
  "requestedAt": "2026-04-26T14:15:00.000Z",
  "updatedAt": "2026-04-26T14:15:00.000Z"
}
```

### `harness status --json`

`status` 命令直接暴露 `run-summary.json` 的核心字段，加上当前控制面信息：

```json
{
  "sessionId": "codex-cli-20260426T220000-demo",
  "objective": "Ship the nightly release checklist",
  "status": "backoff",
  "provider": "codex",
  "profile": "standard",
  "iterationCount": 3,
  "lastOutcome": "infra-retry",
  "lastFailureClass": "runtime-error",
  "nextDelayMs": 120000,
  "stopRequested": false,
  "worktree": {
    "enabled": true,
    "path": "/tmp/aios-solo-harness-123/repo",
    "preserved": true
  },
  "continuitySummaryPath": "memory/context-db/sessions/codex-cli-20260426T220000-demo/continuity-summary.md",
  "updatedAt": "2026-04-26T14:20:00.000Z"
}
```

## PR-1: `harness` CLI + Run Journal Dry-Run Skeleton

**Goal:** 增加一个可发现、可解析、可写 artifact 的 `harness` 命令面，即使还没跑真实模型，用户也能通过 dry-run 看懂 night-run 的 session 目录和 summary contract。

**Files:**

- Modify: `scripts/lib/lifecycle/options.mjs`
- Modify: `scripts/lib/cli/parse-args.mjs`
- Modify: `scripts/lib/cli/help.mjs`
- Modify: `scripts/aios.mjs`
- Create: `scripts/lib/lifecycle/harness.mjs`
- Create: `scripts/lib/harness/solo-journal.mjs`
- Modify: `scripts/tests/aios-cli.test.mjs`
- Create: `scripts/tests/harness-journal.test.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Command contract:**

```bash
node scripts/aios.mjs harness run --objective "Ship release checklist" --dry-run
node scripts/aios.mjs harness run --objective "Ship release checklist" --session demo-session --worktree --dry-run
node scripts/aios.mjs harness status --session demo-session --json
node scripts/aios.mjs harness --help
```

**Tasks:**

- [ ] **Step 1: 在 CLI 测试里写出 harness 解析失败用例**

  在 `scripts/tests/aios-cli.test.mjs` 增加以下断言：

  ```js
  const run = parseArgs(['harness', 'run', '--objective', 'Ship X', '--worktree', '--dry-run']);
  assert.equal(run.command, 'harness');
  assert.equal(run.options.subcommand, 'run');
  assert.equal(run.options.objective, 'Ship X');
  assert.equal(run.options.worktree, true);
  assert.equal(run.options.dryRun, true);
  assert.equal(run.options.provider, 'codex');

  const status = parseArgs(['harness', 'status', '--session', 's1', '--json']);
  assert.equal(status.command, 'harness');
  assert.equal(status.options.subcommand, 'status');
  assert.equal(status.options.sessionId, 's1');
  assert.equal(status.options.json, true);

  const resume = parseArgs(['harness', 'resume', '--session', 's1']);
  assert.equal(resume.options.subcommand, 'resume');

  const stop = parseArgs(['harness', 'stop', '--session', 's1']);
  assert.equal(stop.options.subcommand, 'stop');
  ```

- [ ] **Step 2: 为 journal skeleton 写失败测试**

  新建 `scripts/tests/harness-journal.test.mjs`，至少覆盖：

  ```js
  const journal = await initSoloRunJournal({
    rootDir,
    sessionId: 'solo-session',
    objective: 'Ship X',
    provider: 'codex',
    clientId: 'codex-cli',
    profile: 'standard',
    worktree: { enabled: false, baseRef: 'HEAD', path: '', preserved: false, cleanupReason: '' },
  });

  assert.match(journal.summaryPath, /run-summary\.json$/);
  const summary = JSON.parse(await readFile(journal.summaryPath, 'utf8'));
  assert.equal(summary.kind, 'solo-harness.run-summary');
  assert.equal(summary.status, 'running');
  assert.equal(summary.objective, 'Ship X');

  const statusPayload = await readSoloRunStatus({ rootDir, sessionId: 'solo-session' });
  assert.equal(statusPayload.sessionId, 'solo-session');
  assert.equal(statusPayload.status, 'running');
  ```

- [ ] **Step 3: 先运行失败测试，确认当前仓库还不支持 harness**

  Run:

  ```bash
  node --test scripts/tests/aios-cli.test.mjs scripts/tests/harness-journal.test.mjs
  ```

  Expected before implementation:

  - `parseArgs(['harness', ...])` 抛出 `Unknown command: harness`
  - `harness-journal.test.mjs` 因导入不存在的 `solo-journal.mjs` 或导出缺失而失败

- [ ] **Step 4: 增加 CLI 默认值、解析器与帮助文本**

  在 `scripts/lib/lifecycle/options.mjs` 增加 harness 归一化函数和默认值：

  ```js
  export const HARNESS_PROVIDER_NAMES = ['codex', 'claude', 'gemini', 'opencode'];
  export const HARNESS_STATUS_FORMAT_NAMES = ['text', 'json'];

  export function normalizeHarnessProvider(raw = 'codex') {
    const value = String(raw || 'codex').trim().toLowerCase();
    if (!HARNESS_PROVIDER_NAMES.includes(value)) {
      throw new Error(`--provider must be one of: ${HARNESS_PROVIDER_NAMES.join(', ')}`);
    }
    return value;
  }

  export function createDefaultHarnessRunOptions() {
    return {
      subcommand: 'run',
      objective: '',
      sessionId: '',
      provider: 'codex',
      clientId: 'codex-cli',
      profile: 'standard',
      worktree: false,
      baseRef: 'HEAD',
      dryRun: false,
      json: false,
    };
  }
  ```

  在 `scripts/lib/cli/parse-args.mjs` 新增：

  ```js
  function parseHarnessArgs(argv) { /* route run|status|resume|stop */ }
  function parseHarnessRunArgs(argv) { /* parse --objective --session --provider --worktree --base-ref --dry-run --json */ }
  function parseHarnessStatusArgs(argv) { /* parse --session --json */ }
  function parseHarnessResumeArgs(argv) { /* parse --session --json */ }
  function parseHarnessStopArgs(argv) { /* parse --session --json */ }
  ```

  在 `scripts/lib/cli/help.mjs` 增加：

  ```text
  node scripts/aios.mjs harness run --objective "Ship X" --worktree
  node scripts/aios.mjs harness status --session <id> --json
  node scripts/aios.mjs harness stop --session <id>
  node scripts/aios.mjs harness resume --session <id>
  ```

- [ ] **Step 5: 实现 dry-run journal skeleton 与顶层调度**

  在 `scripts/lib/harness/solo-journal.mjs` 提供以下 API：

  ```js
  export async function initSoloRunJournal(input = {}) {}
  export async function writeSoloRunSummary(input = {}) {}
  export async function readSoloRunSummary(input = {}) {}
  export async function writeSoloControl(input = {}) {}
  export async function readSoloControl(input = {}) {}
  export async function appendSoloIteration(input = {}) {}
  export async function readSoloRunStatus(input = {}) {}
  ```

  在 `scripts/lib/lifecycle/harness.mjs` 先只完成 dry-run 入口：

  ```js
  export async function runHarnessCommand(options = {}, { rootDir, io = console } = {}) {
    if (options.subcommand === 'run') {
      const journal = await initSoloRunJournal({ /* use parsed options */ });
      if (options.dryRun) {
        const payload = await readSoloRunStatus({ rootDir, sessionId: journal.sessionId });
        io.log(options.json ? JSON.stringify(payload, null, 2) : renderHarnessRunDryRun(payload));
        return { exitCode: 0 };
      }
    }
  }
  ```

  在 `scripts/aios.mjs` 增加：

  ```js
  if (parsed.command === 'harness') {
    const { runHarnessCommand } = await import('./lib/lifecycle/harness.mjs');
    const result = await runHarnessCommand(parsed.options, { rootDir });
    if (result.exitCode !== 0) process.exitCode = result.exitCode;
    return;
  }
  ```

- [ ] **Step 6: 验证 PR-1**

  Run:

  ```bash
  node --test scripts/tests/aios-cli.test.mjs scripts/tests/harness-journal.test.mjs
  node scripts/aios.mjs harness run --objective "Ship release checklist" --session demo-session --dry-run --json
  ```

  Expected:

  - 新测试通过
  - dry-run 输出 `status=running` 的 JSON
  - `memory/context-db/sessions/demo-session/artifacts/solo-harness/` 下生成 `objective.md`、`run-summary.json`、`control.json`

## PR-2: Iteration Outcome + Failure Policy + Basic Solo Loop

**Goal:** 让 solo harness 不再只是“写个目录”，而是每一轮都有统一 outcome contract、明确 failureClass 和 backoff 语义，并写回 continuity summary 供 resume 使用。

**Files:**

- Create: `scripts/lib/harness/solo-runtime.mjs`
- Modify: `scripts/lib/lifecycle/harness.mjs`
- Create: `scripts/tests/harness-runtime.test.mjs`
- Modify: `scripts/tests/aios-harness.test.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Command contract:**

```bash
node scripts/aios.mjs harness run --objective "Ship release checklist"
node scripts/aios.mjs harness resume --session <id>
```

**Tasks:**

- [ ] **Step 1: 先写 runtime contract 测试**

  在 `scripts/tests/harness-runtime.test.mjs` 增加至少 4 组测试：

  ```js
  const success = normalizeSoloIterationOutcome({
    sessionId: 's1',
    iteration: 1,
    outcome: 'success',
    summary: 'done',
    shouldStop: false,
  });
  assert.equal(success.failureClass, 'none');
  assert.equal(success.backoffAction, 'none');
  ```

  ```js
  const blocked = normalizeSoloIterationOutcome({
    sessionId: 's1',
    iteration: 2,
    outcome: 'blocked',
    summary: 'No safe next mutation',
    failureClass: 'no-progress',
    shouldStop: false,
  });
  assert.equal(blocked.failureClass, 'no-progress');
  ```

  ```js
  const infra = resolveSoloBackoffState({
    previous: { consecutiveInfraFailures: 1, nextDelayMs: 60000, until: null },
    outcome: { outcome: 'infra-retry', failureClass: 'runtime-error' },
    nowIso: '2026-04-26T15:00:00.000Z',
  });
  assert.equal(infra.consecutiveInfraFailures, 2);
  assert.equal(infra.nextDelayMs, 120000);
  ```

  ```js
  const result = await runSoloHarnessLoop({
    rootDir,
    sessionId: 's1',
    objective: 'Ship X',
    maxIterations: 2,
    executeTurn: async ({ iteration }) => ({
      outcome: iteration === 1 ? 'success' : 'stopped',
      summary: iteration === 1 ? 'made progress' : 'operator requested stop',
      keyChanges: iteration === 1 ? ['docs/checklist.md'] : [],
      keyLearnings: [],
      nextAction: 'continue',
      shouldStop: iteration === 2,
      failureClass: iteration === 2 ? 'stop-requested' : 'none',
    }),
  });
  assert.equal(result.summary.iterationCount, 2);
  assert.equal(result.summary.status, 'stopped');
  ```

- [ ] **Step 2: 运行失败测试，确认当前缺少 runtime state machine**

  Run:

  ```bash
  node --test scripts/tests/harness-runtime.test.mjs scripts/tests/aios-harness.test.mjs
  ```

  Expected before implementation:

  - `solo-runtime.mjs` 导出缺失
  - `resume` 仍然没有真正进入循环

- [ ] **Step 3: 实现 outcome 规范化、失败分类和 backoff**

  在 `scripts/lib/harness/solo-runtime.mjs` 提供纯函数：

  ```js
  export function normalizeSoloIterationOutcome(input = {}) {}
  export function classifySoloFailure(errorOrOutcome = {}) {}
  export function resolveSoloBackoffState({ previous, outcome, nowIso }) {}
  export function summarizeIterationForContinuity(outcome = {}) {}
  ```

  Backoff 规则固定为：

  - `success` / `noop`：`nextDelayMs = 0`
  - `blocked + no-progress`：立即下一轮，但 `nextAction` 必须更窄
  - `infra-retry + runtime-error|tool-error`：`30s -> 60s -> 120s -> 300s` 指数退避，封顶 5 分钟
  - `human-gate + ownership-gate|safety-gate`：直接停止，`status = human-gate`
  - `stopped + stop-requested`：直接停止，`status = stopped`

- [ ] **Step 4: 实现 basic solo loop 并写 continuity**

  在 `scripts/lib/harness/solo-runtime.mjs` 增加：

  ```js
  export async function runSoloHarnessLoop(input = {}) {
    while (true) {
      const outcome = normalizeSoloIterationOutcome(await input.executeTurn(context));
      await appendSoloIteration({ rootDir, sessionId, iteration, outcome });
      const continuity = summarizeIterationForContinuity(outcome);
      await writeContinuitySummary({
        workspaceRoot: rootDir,
        sessionId,
        intent: objective,
        summary: continuity.summary,
        touchedFiles: continuity.touchedFiles,
        nextActions: continuity.nextActions,
      });
      if (outcome.shouldStop) break;
    }
  }
  ```

  `executeTurn` 在第一版允许依赖注入，生产路径可先通过 `solo-profiles.mjs` 的一轮命令执行返回结构化 payload；不要在 PR-2 引入 worktree 逻辑。

- [ ] **Step 5: 把 `harness run` / `resume` 接到 live loop**

  在 `scripts/lib/lifecycle/harness.mjs`：

  - `run`：创建或复用 session，写 journal，调用 `runSoloHarnessLoop`
  - `resume`：读取现有 `run-summary.json`、`continuity-summary.md`、`control.json`，从 `lastIteration + 1` 继续
  - live mode 完成后输出 `run-summary.json` 的最终状态，不直接读原始日志拼文本

- [ ] **Step 6: 验证 PR-2**

  Run:

  ```bash
  node --test scripts/tests/harness-runtime.test.mjs scripts/tests/aios-harness.test.mjs
  node scripts/aios.mjs harness run --objective "Ship release checklist" --session loop-demo --json
  node scripts/aios.mjs harness resume --session loop-demo --json
  ```

  Expected:

  - `iteration-0001.json` 等文件落盘
  - `continuity-summary.md` 更新
  - `run-summary.json` 能区分 `success`、`backoff`、`human-gate`、`stopped`

## PR-3: Worktree-Backed Overnight Mode

**Goal:** 给 solo harness 增加一条适合过夜任务的隔离路径：从稳定 ref 启动 run-specific worktree，有成果就保留，无成果就清理，不污染主工作区。

**Files:**

- Create: `scripts/lib/harness/solo-worktree.mjs`
- Modify: `scripts/lib/harness/solo-runtime.mjs`
- Modify: `scripts/lib/lifecycle/harness.mjs`
- Create: `scripts/tests/harness-worktree.test.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Command contract:**

```bash
node scripts/aios.mjs harness run --objective "Ship release checklist" --worktree --base-ref HEAD --dry-run
node scripts/aios.mjs harness run --objective "Ship release checklist" --worktree --base-ref main
```

**Tasks:**

- [ ] **Step 1: 先按 RL worktree 模式写失败测试**

  在 `scripts/tests/harness-worktree.test.mjs` 复用 `scripts/tests/rl-shell-v1-worktree-runner.test.mjs` 的临时 git repo 创建方式，至少覆盖：

  ```js
  const state = await prepareSoloWorktree({
    rootDir,
    sessionId: 's1',
    objective: 'Ship X',
    enabled: true,
    baseRef: 'HEAD',
  });
  assert.equal(state.enabled, true);
  assert.equal(state.path.includes('.git'), false);
  ```

  ```js
  const cleanup = await finalizeSoloWorktree({
    rootDir,
    worktree: state,
    preserveOnChange: true,
    detectChanges: async () => false,
  });
  assert.equal(cleanup.preserved, false);
  ```

  ```js
  const keep = await finalizeSoloWorktree({
    rootDir,
    worktree: state,
    preserveOnChange: true,
    detectChanges: async () => true,
  });
  assert.equal(keep.preserved, true);
  ```

- [ ] **Step 2: 运行失败测试，确认当前没有 harness worktree 生命周期**

  Run:

  ```bash
  node --test scripts/tests/harness-worktree.test.mjs
  ```

  Expected before implementation:

  - `solo-worktree.mjs` 不存在
  - `harness run --worktree` 仍然只是普通 workspace 路径

- [ ] **Step 3: 实现 worktree create/preserve/cleanup**

  在 `scripts/lib/harness/solo-worktree.mjs` 提供：

  ```js
  export async function prepareSoloWorktree(input = {}) {}
  export async function detectSoloWorktreeChanges(input = {}) {}
  export async function finalizeSoloWorktree(input = {}) {}
  ```

  规则固定为：

  - `--worktree=false`：返回 `{ enabled: false }`
  - `--worktree=true`：`git worktree add --detach <path> <baseRef>`
  - 运行结束后若 `git status --short` 为空且没有新提交：自动清理
  - 只要有文件变更、新提交、`human-gate`、`blocked`、`stopped`：保留 worktree 并把 `path` 记入 `run-summary.json`

- [ ] **Step 4: 把 worktree 注入 runtime，但禁止 blanket reset**

  在 `scripts/lib/harness/solo-runtime.mjs`：

  - loop 使用 `workspaceRoot = worktree.path || rootDir`
  - 出现 `workspace-mutation` 失败时，只能标记 `failureClass = workspace-mutation` 并建议 `snapshot-rollback` 或人工处理
  - 不允许新增 `git reset --hard`、`git checkout -- .` 之类恢复逻辑

  在 `scripts/lib/lifecycle/harness.mjs`：

  - `run` 先 `prepareSoloWorktree`
  - `finally` 里 `finalizeSoloWorktree`
  - 最终 summary 一定要写明 `preserved` 与 `cleanupReason`

- [ ] **Step 5: 验证 PR-3**

  Run:

  ```bash
  node --test scripts/tests/harness-worktree.test.mjs scripts/tests/harness-runtime.test.mjs
  node scripts/aios.mjs harness run --objective "Ship release checklist" --session wt-demo --worktree --dry-run --json
  ```

  Expected:

  - dry-run / live mode 都能在 summary 里看到 `worktree.enabled`
  - 无成果 case 自动清理
  - 有成果或被 stop/human-gate 时保留 worktree 路径

## PR-4: Stop / Resume / Status + HUD Integration

**Goal:** 让 overnight harness 变成可运营的流程：可以停、可以续、可以查、可以在 HUD 里看到，不再要求操作者手翻 `artifacts/` 目录。

**Files:**

- Modify: `scripts/lib/lifecycle/harness.mjs`
- Modify: `scripts/lib/harness/solo-journal.mjs`
- Modify: `scripts/lib/harness/solo-runtime.mjs`
- Modify: `scripts/lib/hud/state.mjs`
- Modify: `scripts/lib/hud/render.mjs`
- Modify: `scripts/tests/aios-cli.test.mjs`
- Modify: `scripts/tests/hud-state.test.mjs`
- Modify: `scripts/tests/harness-runtime.test.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Command contract:**

```bash
node scripts/aios.mjs harness status --session <id> --json
node scripts/aios.mjs harness stop --session <id>
node scripts/aios.mjs harness resume --session <id>
node scripts/aios.mjs hud --session <id> --json
```

**Tasks:**

- [ ] **Step 1: 先写 stop/status/resume/HUD 失败测试**

  在 `scripts/tests/aios-cli.test.mjs` 增加：

  ```js
  assert.equal(parseArgs(['harness', 'status', '--session', 's1', '--json']).options.subcommand, 'status');
  assert.equal(parseArgs(['harness', 'stop', '--session', 's1']).options.subcommand, 'stop');
  assert.equal(parseArgs(['harness', 'resume', '--session', 's1']).options.subcommand, 'resume');
  ```

  在 `scripts/tests/harness-runtime.test.mjs` 增加：

  ```js
  await writeSoloControl({
    rootDir,
    sessionId: 's1',
    stopRequested: true,
    reason: 'operator-request',
  });
  const control = await readSoloControl({ rootDir, sessionId: 's1' });
  assert.equal(control.stopRequested, true);
  ```

  在 `scripts/tests/hud-state.test.mjs` 增加：

  ```js
  const state = await readHudState({ rootDir, sessionId: 'solo-session' });
  assert.equal(state.latestHarnessRun?.kind, 'solo-harness.run-summary');
  assert.equal(state.latestHarnessRun?.status, 'running');

  const text = renderHud(state, { preset: 'focused' });
  assert.match(text, /Harness:/);
  ```

- [ ] **Step 2: 运行失败测试，确认 HUD 还不认识 solo harness**

  Run:

  ```bash
  node --test scripts/tests/aios-cli.test.mjs scripts/tests/harness-runtime.test.mjs scripts/tests/hud-state.test.mjs
  ```

  Expected before implementation:

  - `status` / `stop` / `resume` 虽能解析，但缺少真实行为或 JSON 输出
  - `readHudState` 只能看到 dispatch，读不到 `solo-harness/run-summary.json`

- [ ] **Step 3: 实现 status/stop/resume 控制面**

  在 `scripts/lib/harness/solo-journal.mjs` 增加：

  ```js
  export async function requestSoloHarnessStop({ rootDir, sessionId, reason = 'operator-request' }) {}
  export async function clearSoloHarnessStop({ rootDir, sessionId }) {}
  export async function readSoloRunStatus({ rootDir, sessionId }) {}
  ```

  在 `scripts/lib/lifecycle/harness.mjs`：

  - `status`：读取 `run-summary.json` + `control.json`，支持 `--json`
  - `stop`：写 `control.json.stopRequested=true`
  - `resume`：先 `clearSoloHarnessStop`，再进入 loop

  在 `scripts/lib/harness/solo-runtime.mjs`：

  - 每轮开始前读 `control.json`
  - 如果 `stopRequested=true`，写一个 `outcome=stopped` 的 iteration，再安全退出

- [ ] **Step 4: 让 HUD 识别 harness session**

  在 `scripts/lib/hud/state.mjs` 增加 solo harness 读取：

  ```js
  const latestHarnessRun = await readSoloRunSummary({ rootDir, sessionId: selection.sessionId });
  const harnessControl = await readSoloControl({ rootDir, sessionId: selection.sessionId });
  ```

  返回结构至少新增：

  ```js
  {
    latestHarnessRun,
    harnessControl,
    harnessSuggestedCommands: [
      `node scripts/aios.mjs harness status --session ${sessionId} --json`,
      `node scripts/aios.mjs harness resume --session ${sessionId}`,
    ],
  }
  ```

  在 `scripts/lib/hud/render.mjs` 增加：

  ```text
  Harness: status=running iteration=2 outcome=success fail=none backoff=0ms stopRequested=false worktree=preserved
  ```

  约束：

  - 如果当前 session 是 solo harness 且没有 dispatch artifact，不要把它显示成 “No dispatch artifact found” 错误
  - `suggestedCommands` 要优先展示 `harness status|resume|stop`

- [ ] **Step 5: 验证 PR-4**

  Run:

  ```bash
  node --test scripts/tests/aios-cli.test.mjs scripts/tests/harness-runtime.test.mjs scripts/tests/hud-state.test.mjs
  node scripts/aios.mjs harness status --session wt-demo --json
  node scripts/aios.mjs harness stop --session wt-demo
  node scripts/aios.mjs harness resume --session wt-demo --json
  node scripts/aios.mjs hud --session wt-demo --json
  ```

  Expected:

  - `status` 输出完整 JSON
  - `stop` 只通过 control 文件请求停止，不强杀进程
  - `resume` 会清除 stop request 并继续迭代
  - HUD 能展示 harness 行和建议命令

## PR-5: Provider Profile Hardening + Docs + Compatibility Verification

**Goal:** 把 solo harness 从“只在 happy path 能跑”补到“多 provider 行为边界清楚、错误信息明确、文档可运营”，并把 `opencode` 纳入显式支持或显式拒绝路径。

**Files:**

- Create: `scripts/lib/harness/solo-profiles.mjs`
- Modify: `scripts/lib/lifecycle/harness.mjs`
- Modify: `scripts/lib/harness/solo-runtime.mjs`
- Create: `scripts/tests/harness-profiles.test.mjs`
- Modify: `scripts/tests/aios-harness.test.mjs`
- Modify: `package.json`
- Modify: `README.md`

**Command contract:**

```bash
node scripts/aios.mjs harness run --objective "Ship release checklist" --provider codex
node scripts/aios.mjs harness run --objective "Ship release checklist" --provider claude
node scripts/aios.mjs harness run --objective "Ship release checklist" --provider gemini
node scripts/aios.mjs harness run --objective "Ship release checklist" --provider opencode
```

**Tasks:**

- [ ] **Step 1: 先写 provider profile 失败测试**

  在 `scripts/tests/harness-profiles.test.mjs` 增加：

  ```js
  const codex = resolveSoloHarnessProfile({ provider: 'codex' });
  assert.equal(codex.clientId, 'codex-cli');
  assert.equal(codex.command, 'codex');

  const opencode = resolveSoloHarnessProfile({ provider: 'opencode' });
  assert.equal(opencode.clientId, 'opencode-cli');
  assert.equal(opencode.command, 'opencode');
  ```

  ```js
  assert.throws(
    () => validateSoloHarnessExtraArgs(['--session', 'x']),
    /reserved harness flag/i
  );
  ```

  ```js
  const readiness = await checkSoloHarnessProfileReadiness({
    provider: 'codex',
    commandExistsImpl: async () => false,
  });
  assert.equal(readiness.ok, false);
  assert.match(readiness.reason, /codex/i);
  ```

- [ ] **Step 2: 运行失败测试，确认 provider contract 尚未硬化**

  Run:

  ```bash
  node --test scripts/tests/harness-profiles.test.mjs scripts/tests/aios-harness.test.mjs
  ```

  Expected before implementation:

  - `solo-profiles.mjs` 不存在
  - `opencode` 没有显式 profile
  - harness 不能清晰拒绝 reserved flag 或缺失二进制

- [ ] **Step 3: 实现 provider registry 与 readiness 检查**

  在 `scripts/lib/harness/solo-profiles.mjs` 提供：

  ```js
  export function resolveSoloHarnessProfile({ provider = 'codex' } = {}) {}
  export function validateSoloHarnessExtraArgs(args = []) {}
  export async function checkSoloHarnessProfileReadiness(input = {}) {}
  export function buildSoloHarnessCommand(input = {}) {}
  ```

  第一版支持矩阵固定为：

  ```js
  {
    codex: { clientId: 'codex-cli', command: 'codex' },
    claude: { clientId: 'claude-code', command: 'claude' },
    gemini: { clientId: 'gemini-cli', command: 'gemini' },
    opencode: { clientId: 'opencode-cli', command: 'opencode' },
  }
  ```

  Reserved harness flags 固定拒绝：

  - `--session`
  - `--resume`
  - `--json`
  - `--worktree`
  - `--objective`
  - `-h`
  - `--help`

- [ ] **Step 4: 把 provider readiness 接入 `harness run`**

  在 `scripts/lib/lifecycle/harness.mjs`：

  - run 前调用 `checkSoloHarnessProfileReadiness`
  - readiness 失败时返回清晰的 operator next actions，例如：

  ```json
  {
    "ok": false,
    "reason": "codex command is not available on PATH",
    "nextActions": [
      "Install the codex CLI or switch --provider to another installed client.",
      "Run node scripts/aios.mjs doctor --native --verbose"
    ]
  }
  ```

  约束：

  - 不在 PR-5 顺手重构 `subagent-runtime.mjs` 的 client registry
  - 允许暂时存在一份 solo harness 专用 registry，避免把本 PR 变成跨系统大重构

- [ ] **Step 5: 更新 README 并做兼容性验证**

  在 `README.md` 增加中文可读示例：

  ```bash
  node scripts/aios.mjs harness run --objective "整理明早要 review 的 PR" --worktree
  node scripts/aios.mjs harness status --session <id> --json
  node scripts/aios.mjs harness stop --session <id>
  node scripts/aios.mjs harness resume --session <id>
  ```

  同时把新增测试加入 `package.json`：

  ```json
  "test:scripts": "node --test ... scripts/tests/harness-journal.test.mjs scripts/tests/harness-runtime.test.mjs scripts/tests/harness-worktree.test.mjs scripts/tests/harness-profiles.test.mjs"
  ```

- [ ] **Step 6: 验证 PR-5**

  Run:

  ```bash
  node --test scripts/tests/harness-profiles.test.mjs scripts/tests/aios-harness.test.mjs
  npm run test:scripts
  ```

  Manual smoke:

  ```bash
  node scripts/aios.mjs harness run --objective "Draft tomorrow handoff" --session provider-demo --provider codex --dry-run --json
  node scripts/aios.mjs harness run --objective "Draft tomorrow handoff" --session provider-demo --provider opencode --dry-run --json
  ```

  Expected:

  - 已安装 provider 能返回 readiness ok
  - 未安装 provider 返回清晰 next actions
  - `test:scripts` 覆盖新增 harness 测试文件

## Final Verification Gate

- [ ] `node --test scripts/tests/aios-cli.test.mjs scripts/tests/harness-journal.test.mjs scripts/tests/harness-runtime.test.mjs scripts/tests/harness-worktree.test.mjs scripts/tests/harness-profiles.test.mjs scripts/tests/hud-state.test.mjs`
- [ ] `npm run test:scripts`
- [ ] `node scripts/aios.mjs harness run --objective "Draft tomorrow handoff" --session final-demo --worktree --dry-run --json`
- [ ] `node scripts/aios.mjs harness status --session final-demo --json`
- [ ] `node scripts/aios.mjs hud --session final-demo --json`

## Self-Review Notes

- 本计划没有重复实现现有 `watchdog`；solo harness 只新增 journal / runtime / worktree / provider contract。
- 本计划保留 `ContextDB` 为 canonical memory，`run journal` 只是 operator 视图层。
- 本计划明确禁止 blanket `git reset --hard`，恢复只通过 `snapshot rollback` 建议或人工接手完成。
- 每个 PR 都能独立验证，不要求先改 `mcp-server/`，也不依赖浏览器链路。
