---
title: 故障排查
description: 常见报错与修复步骤。
---

# 故障排查

## 快速答案（AI 搜索）

大多数问题来自环境与作用域配置（MCP 依赖缺失、包装未加载、wrap 模式不匹配）。先跑诊断，再改配置。

## Browser MCP 工具不可用

先执行（macOS / Linux）：

```bash
scripts/doctor-browser-mcp.sh
```

Windows（PowerShell）执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-browser-mcp.ps1
```

如果诊断提示缺依赖，再执行安装脚本：

```bash
scripts/install-browser-mcp.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\install-browser-mcp.ps1
```

## `EXTRA_ARGS[@]: unbound variable`

原因：旧版 `ctx-agent.sh` 在 `bash set -u` 下展开空数组。

处理：更新到最新 `main` 并重新打开 shell。

新版本已统一为 `ctx-agent-core.mjs` 作为执行核心，避免 sh/mjs 双实现漂移。

## `search` 结果异常为空

如果 `memory/context-db/index/context.db` 丢失或过期：

1. 执行 `cd mcp-server && npm run contextdb -- index:rebuild`
2. 重新执行 `search` / `timeline` / `event:get`

## `contextdb context:pack` 失败

AIOS 会先生成 ContextDB 上下文包（`context:pack`），再启动 `codex/claude/gemini`。

如果打包失败，`ctx-agent` 默认会**告警并继续运行**（不注入上下文，也不让 CLI 整体起不来）。

如果你希望打包失败直接中断（严格模式）：

```bash
export CTXDB_PACK_STRICT=1
```

注意：shell wrapper（`codex`/`claude`/`gemini`）默认会 fail-open，即便设置了 `CTXDB_PACK_STRICT=1` 也不会让交互式会话直接“起不来”。如果你希望包装层也严格执行：

```bash
export CTXDB_PACK_STRICT_INTERACTIVE=1
```

如果频繁出现，建议先跑仓库门禁（包含 ContextDB 回归检查）：

```bash
aios quality-gate pre-pr --profile strict
```

## `codex /new` 或 `claude/gemini /clear` 后上下文“没了”

`/new` / `/clear` 重置的是 **CLI 内部的对话状态**。ContextDB 仍在磁盘上，但包装层只会在 **启动 CLI 进程时** 注入一次 context packet。

处理方式：

1. 推荐：退出 CLI，然后在 shell 里重新执行 `codex` / `claude` / `gemini`。
2. 如果必须在同一进程里继续：在新对话第一句让模型先读取：
   - `@memory/context-db/exports/latest-codex-cli-context.md`
   - `@memory/context-db/exports/latest-claude-code-context.md`
   - `@memory/context-db/exports/latest-gemini-cli-context.md`

如果客户端不支持 `@file` 引用，请把文件内容粘贴为首条消息。

## `aios orchestrate --execute live` 被阻塞或失败

live 编排默认关闭，需要显式 opt-in：

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli  # 必须（live 当前仅支持 codex-cli）
```

同时确保 `codex` 在 `PATH` 中并已登录（例如 `codex --version`）。

Windows 快速验证（PowerShell）：

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-contextdb-shell.ps1
codex --version
codex
```

期望：不出现 `stdout is not a terminal` 等 TTY 错误，且交互式 `codex` 能正确接管当前终端。

提示（codex-cli）：推荐 Codex CLI >= v0.114。AIOS 会在可用时自动使用 `codex exec` 的结构化输出（`--output-schema`、`--output-last-message`、stdin），让 JSON handoff 更稳定。

提示：想先验证 DAG 而不产生 token 成本，可以用 `--execute dry-run`，或设置 `AIOS_SUBAGENT_SIMULATE=1` 走 live runtime 的本地模拟路径。

常见失败特征：

- `type: upstream_error` / `server_error`：上游不稳定。稍后重试（AIOS 会自动重试几次）。
- `Timed out after 600000 ms`：增大 `AIOS_SUBAGENT_TIMEOUT_MS`（例如 `900000`），或用 `AIOS_SUBAGENT_CONTEXT_LIMIT` / `AIOS_SUBAGENT_CONTEXT_TOKEN_BUDGET` 缩小上下文包。
- `invalid_json_schema`（`param: text.format.schema`）：后端拒绝了结构化输出 schema。更新到最新 `main` 后重试；AIOS 也会在检测到 schema 被拒绝时自动去掉 `--output-schema` 再试一次。

最小 structured-output 冒烟测试（macOS/Linux）：

```bash
printf '%s' 'Return a JSON object matching the schema.' | codex exec --output-schema memory/specs/agent-handoff.schema.json -
```

## 命令没有被包装

检查：

- 当前目录是你希望启用 ContextDB 的工作区目录（可以是 git 项目，也可以是普通目录）
- `~/.zshrc` 已 source `contextdb-shell.zsh`
- `CTXDB_WRAP_MODE` 允许当前工作区
- `opt-in` 模式下已创建 `.contextdb-enable`

先跑包装诊断：

```bash
scripts/doctor-contextdb-shell.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-contextdb-shell.ps1
```

## `CODEX_HOME points to ".codex"` 报错

原因：`CODEX_HOME` 被设置为相对路径。

修复：

```bash
export CODEX_HOME="$HOME/.codex"
mkdir -p "$CODEX_HOME"
```

新版本包装脚本也会在运行时自动规范相对 `CODEX_HOME`。

## 本仓库 skills 在其他项目不可见

包装器与 skills 是分离设计，需要显式安装全局 skills：
`--client all` 会同时安装到 `codex`、`claude`、`gemini`、`opencode`。

```bash
scripts/install-contextdb-skills.sh --client all
scripts/doctor-contextdb-skills.sh --client all
```

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\install-contextdb-skills.ps1 -Client all
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-contextdb-skills.ps1 -Client all
```

## 常见问答

### 浏览器工具不可用时第一步做什么？

先运行 `scripts/doctor-browser-mcp.sh`（或 PowerShell 版本）查看缺失项。

### 为什么输入 `codex` 没有注入上下文？

通常是 wrapper 未加载、`CTXDB_WRAP_MODE` 未覆盖当前工作区，或者当前命令属于透传的管理子命令。


## 把技能放进了错误目录

仓库内可发现的 repo-local skills 只应放在：

- `<repo>/.codex/skills`
- `<repo>/.claude/skills`

如果你把 `SKILL.md` 放进 `.baoyu-skills/` 之类的平行目录，Codex / Claude 不会把它当作可发现技能。

- `.baoyu-skills/` 只适合放 `EXTEND.md` 一类扩展配置
- 真正的技能请移动到 `.codex/skills/<name>/SKILL.md` 或 `.claude/skills/<name>/SKILL.md`
- 运行 `scripts/doctor-contextdb-skills.sh --client all` 检查是否存在错误的技能根目录
