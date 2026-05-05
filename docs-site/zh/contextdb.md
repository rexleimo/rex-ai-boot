---
title: ContextDB
description: 会话模型，五步流程与命令示例。
---

# ContextDB 运行机制

## 快速答案（AI 搜索）

ContextDB 是面向多 CLI agent 的文件系统会话层。它按项目存储事件、checkpoint 和可续跑上下文包，并使用 SQLite sidecar 索引加速检索。

## 标准 5 步

运行时，ContextDB 可执行以下序列：

1. `init` - 确保 DB 文件夹和 sidecar 索引存在。
2. `session:new` 或 `session:latest` - 按 `agent + project` 解析 session。
3. `event:add` - 存储用户/model/工具事件。
4. `checkpoint` - 写入阶段摘要、状态和下一步操作。
5. `context:pack` - 导出 markdown 包供下次 CLI 调用使用。

## 交互模式 vs One-shot 模式

- 交互模式通常在启动 CLI 前运行步骤 `1, 2, 5`。
- One-shot 模式在单个命令中运行完整 `1..5`。

## Fail-Open Packing

如果 `contextdb context:pack` 失败，`ctx-agent` 默认会**告警并继续运行**（不注入上下文，也不让 CLI 整体起不来）。

如果你希望打包失败直接中断（严格模式）：

```bash
export CTXDB_PACK_STRICT=1
```

注意：shell wrapper（`codex`/`claude`/`gemini`）默认会 fail-open，即便设置了 `CTXDB_PACK_STRICT=1` 也不会让交互式会话直接"起不来"。如果你希望包装层也严格执行：

```bash
export CTXDB_PACK_STRICT_INTERACTIVE=1
```

## 手动命令示例

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

## Workspace Memory（`aios memo`）

当你希望在 CLI 流程里维护可持续的操作员记忆时，使用 `aios memo`。

存储边界：

- `memo add/list/search`：在 ContextDB 的 `workspace-memory--<space>` 会话中写入/读取 memo 事件
- `memo recall`：调用 ContextDB `recall:sessions` 做跨会话项目召回
- `memo pin show/set/add`：读写 `memory/context-db/sessions/workspace-memory--<space>/pinned.md`
- `memo persona ...` 和 `memo user ...`：全局文件层（默认 `~/.aios/SOUL.md` 与 `~/.aios/USER.md`）

示例：

```bash
aios memo use release-train
aios memo add "Need strict pre-PR gate before merge #quality"
aios memo pin add "Never run destructive git commands without explicit approval."
aios memo list --limit 10
aios memo search "pre-PR" --limit 5
aios memo recall "release gate" --limit 5
aios memo persona init
aios memo persona add "Response style: concise, direct, evidence-first"
aios memo user init
aios memo user add "Preferred language: zh-CN + technical English terms"
```

## 懒加载启动（P0） {#lazy-load}

ContextDB 现在支持交互式 CLI 会话的**懒加载模式**。不再在每次启动时运行完整的 `context:pack`（2~5 秒），而是让包装器加载轻量缓存的 Facade（< 50 ms），并让 Agent 在需要时自主发现记忆。

### 工作原理

1. **快速 Facade 读取** — 启动时加载 `memory/context-db/.facade.json`（缓存的会话摘要）。
2. **精简提示词注入** — 注入一个 < 150 token 的 Facade 提示，告知 Agent：
   - ContextDB 存在
   - 完整历史记录的位置
   - 何时加载它
3. **后台 Bootstrap** — Fork 一个分离的进程，在后台异步重建完整的上下文包。
4. **运行时触发机制** — 当 Agent 收到用户输入时，按短路顺序评估三个信号：
   - **A. 意图检测** — 关键词如 "remember"、"之前"、"continue"、"resume"
   - **B. 任务复杂度** — 多步骤、跨域、orchestrate/team 类语言
   - **C. RL 策略门控** — 未来集成 `rl-core` 进行学习后的加载决策

### 启用 / 禁用

懒加载在交互式会话中**默认开启**。

```bash
# 退出（每次启动时即时打包）
export CTXDB_LAZY_LOAD=0

# 显式启用
export CTXDB_LAZY_LOAD=1
```

One-shot 模式（`--prompt`）不受此设置影响，始终使用即时路径。

### Facade JSON

Facade 旁路缓存会在每次成功打包后自动生成：

```json
{
  "version": 1,
  "generatedAt": "2026-04-19T10:00:00Z",
  "ttlSeconds": 3600,
  "sessionId": "claude-code-20260419T095454-e6eb600d",
  "goal": "Shared context session for claude-code on aios",
  "status": "running",
  "lastCheckpointSummary": "...",
  "keyRefs": ["scripts/ctx-agent-core.mjs"],
  "contextPacketPath": "memory/context-db/exports/latest-claude-code-context.md",
  "hasStalePack": false
}
```

如果 Facade 缺失或过期，将自动回退到从最新会话头信息生成新的 Facade。

## 上下文包控制（P0）

`context:pack` 支持 token 预算与事件过滤：

```bash
npm run contextdb -- context:pack \
  --session <id> \
  --limit 60 \
  --token-budget 1200 \
  --kinds prompt,response,error \
  --refs core.ts,cli.ts
```

- `--token-budget`：按估算 token 控制 L2 事件体积。
- `--kinds` / `--refs`：只打包匹配事件。
- 默认会对重复事件做去重。

## 检索命令（P1）

ContextDB 提供 SQLite 支撑的 sidecar 索引检索：

```bash
npm run contextdb -- search --query "auth race" --project demo --kinds response --refs auth.ts
npm run contextdb -- timeline --session <id> --limit 30
npm run contextdb -- event:get --id <sessionId>#<seq>
npm run contextdb -- index:sync --stats
npm run contextdb -- index:rebuild
```

- `search`：按索引查询事件。
- `timeline`：合并 event/checkpoint 时间线。
- `event:get`：按稳定 ID 获取单条事件。
- `index:sync`：从真源会话文件增量同步到 sidecar 索引。
- `index:rebuild`：从 `sessions/*` 真源文件重建 SQLite 索引。
- 默认排序路径：SQLite FTS5 `MATCH` + `bm25(...)`（覆盖 `kind/text/refs`）。
- 兼容性回退：如果当前环境不可用 FTS，`search` 会自动回退到 lexical 匹配。

## 增量同步 + refs 规范化（P1.5）

ContextDB 现在在 SQLite sidecar 中维护规范化 `event_refs` 表。  
`--refs` 过滤改为基于该表做规范化 refs 精确匹配，减少字符串包含匹配带来的误命中。

```bash
npm run contextdb -- index:sync --stats
npm run contextdb -- index:sync --force --stats
npm run contextdb -- index:sync --stats --jsonl-out memory/context-db/exports/index-sync-stats.jsonl
```

- `--stats`：输出 sessions/events/checkpoints 的 `scanned/upserted` 计数、耗时、throttle skip 和 force 标记。
- `--jsonl-out`：每次同步追加一条 JSONL 记录（含时间戳），方便做趋势分析。
- 仅在 sidecar 缺失/损坏或需要完整 schema 重建时使用 `index:rebuild`。

## refs 查询性能基准

可使用内置脚本监控 refs 查询延迟并做回归门禁：

```bash
cd mcp-server
npm run bench:contextdb:refs -- --events 2000 --refs-pool 200 --queries 300 --warmup 30 --json-out test-results/contextdb-refs-bench.local.json
npm run bench:contextdb:refs:ci
npm run bench:contextdb:refs:gate
```

- `bench:contextdb:refs`：本地可调数据集基准。
- `bench:contextdb:refs:ci`：标准 CI 数据集。
- `bench:contextdb:refs:gate`：当延迟/命中率阈值不达标时返回失败。

## 可选语义检索（P2）

语义模式是可选能力；不可用时会自动回退到 lexical 检索。

```bash
export CONTEXTDB_SEMANTIC=1
export CONTEXTDB_SEMANTIC_PROVIDER=token
npm run contextdb -- search --query "issue auth" --project demo --semantic
```

- `--semantic`：请求语义重排。
- `CONTEXTDB_SEMANTIC_PROVIDER=token`：本地 token overlap 重排，不走网络。
- 未知或不可用 provider 会自动回退到 lexical 路径。
- 语义重排基于"当前 query 的 lexical 候选集"执行，而非仅按最近事件取样，避免旧但精确的命中被默认过滤。

## 存储布局

ContextDB 将真源数据保存在 session 文件中，并使用 sidecar 索引提升速度：

```text
memory/context-db/
  sessions/<session_id>/*        # 真正数据源（source of truth）
  index/context.db               # SQLite sidecar（可重建）
  index/sessions.jsonl           # 兼容索引
  index/events.jsonl             # 兼容索引
  index/checkpoints.jsonl        # 兼容索引
```

## Session ID 格式

Session ID 使用以下格式：

`<agent>-<YYYYMMDDTHHMMSS>-<random>`

这保持了时间顺序清晰，避免碰撞。

## 常见问答

### ContextDB 是云数据库吗？

不是。它默认写入当前工作区下的本地文件系统。

### 为什么我在 `codex /new` 或 `claude/gemini /clear` 后"记忆没了"？

这些命令会重置 **CLI 内部的对话状态**。ContextDB 的数据仍然在磁盘上，但包装层只会在 **启动 CLI 进程时** 注入一次 context packet。

恢复方式：

- 推荐：退出 CLI，然后在 shell 里重新执行 `codex` / `claude` / `gemini`（包装会重新 `context:pack` 并注入）。
- 如果必须在同一进程里继续：在新对话第一句让模型先读取最新快照：
  - `@memory/context-db/exports/latest-codex-cli-context.md`
  - `@memory/context-db/exports/latest-claude-code-context.md`
  - `@memory/context-db/exports/latest-gemini-cli-context.md`

如果客户端不支持 `@file` 引用，请把文件内容粘贴为首条消息。

### Codex、Claude、Gemini 会共享上下文吗？

会。只要它们运行在同一个已包裹工作区（优先使用同一个 git 根目录；没有 git 根目录时则使用同一个当前目录），就会共享同一份 `memory/context-db/`。

### 怎么做跨 CLI 接力？

保持同一项目会话，切换 CLI 前执行 `context:pack`。
