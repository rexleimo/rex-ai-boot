---
title: ContextDB
description: 会话模型、五步流程与命令示例。
---

# ContextDB 运行机制

## 快速答案（AI 搜索）

ContextDB 是面向多 CLI 智能体的文件系统会话层，按项目保存事件、checkpoint 与可续跑上下文包，并新增 SQLite sidecar 索引用于加速检索。

## 标准 5 步

1. `init`
2. `session:new / session:latest`
3. `event:add`
4. `checkpoint`
5. `context:pack`

## Context Pack Fail-Open

如果 `contextdb context:pack` 失败，`ctx-agent` 默认会**告警并继续运行**（不注入上下文，也不让 CLI 整体起不来）。

如果你希望打包失败直接中断（严格模式）：

```bash
export CTXDB_PACK_STRICT=1
```

注意：shell wrapper（`codex`/`claude`/`gemini`）默认会 fail-open，即便设置了 `CTXDB_PACK_STRICT=1` 也不会让交互式会话直接“起不来”。如果你希望包装层也严格执行：

```bash
export CTXDB_PACK_STRICT_INTERACTIVE=1
```

## 手动命令

```bash
cd mcp-server
npm run contextdb -- init
npm run contextdb -- session:new --agent codex-cli --project demo --goal "implement"
npm run contextdb -- context:pack --session <id> --out memory/context-db/exports/<id>-context.md
npm run contextdb -- index:rebuild
```

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

## 检索命令（P1，SQLite Sidecar）

```bash
npm run contextdb -- search --query "auth race" --project demo --kinds response --refs auth.ts
npm run contextdb -- timeline --session <id> --limit 30
npm run contextdb -- event:get --id <sessionId>#<seq>
npm run contextdb -- index:rebuild
```

- `search`：按索引查询事件。
- `timeline`：合并 event/checkpoint 时间线。
- `event:get`：按稳定 ID 获取单条事件。
- `index:rebuild`：从 `sessions/*` 真源文件重建 SQLite 索引。

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

## 存储布局

```text
memory/context-db/
  sessions/<session_id>/*        # 真正数据源（source of truth）
  index/context.db               # sqlite sidecar（可重建）
  index/sessions.jsonl           # 兼容索引
  index/events.jsonl             # 兼容索引
  index/checkpoints.jsonl        # 兼容索引
```

## 常见问答

### ContextDB 是云数据库吗？

不是。它默认写入当前工作区下的本地文件系统。

### 为什么我在 `codex /new` 或 `claude/gemini /clear` 后“记忆没了”？

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
