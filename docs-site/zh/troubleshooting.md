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
