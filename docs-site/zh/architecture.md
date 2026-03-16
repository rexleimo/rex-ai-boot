---
title: 架构
description: wrapper、runner 与 ContextDB 的运行关系。
---

# 架构

## 组件

- `scripts/contextdb-shell.zsh`：接管 `codex/claude/gemini`
- `scripts/contextdb-shell-bridge.mjs`：包裹/透传决策桥
- `scripts/ctx-agent.mjs`：统一运行器
- `mcp-server/src/contextdb/*`：ContextDB 核心与 CLI

## 运行链路

```text
用户命令
  -> zsh wrapper
  -> contextdb-shell-bridge.mjs
  -> ctx-agent.mjs
  -> contextdb CLI
  -> 启动原生 CLI（注入 context）
```

## 作用域控制

- `all`：所有工作区启用，包括非 git 目录
- `repo-only`：仅 `ROOTPATH` 工作区启用
- `opt-in`：仅含 `.contextdb-enable` 的工作区启用
- `off`：关闭包装

## Harness 层（AIOS）

AIOS 在 ContextDB 之上提供面向运营的 harness：

- `aios orchestrate` 基于蓝图生成本地调度 DAG。
- `dry-run` 使用 `local-dry-run`（免 token，本地模拟）。
- `live` 使用 `subagent-runtime`，通过外部 CLI（`codex`）执行各阶段任务（当前仅支持 codex-cli）。
- 当 `AIOS_SUBAGENT_CLIENT=codex-cli` 时，AIOS 会优先使用 `codex exec` 的结构化输出（`--output-schema`、`--output-last-message`、stdin）生成稳定的 JSON handoff（旧版本自动降级）。

`live` 默认关闭，需要显式打开：

- `AIOS_EXECUTE_LIVE=1`
- `AIOS_SUBAGENT_CLIENT=codex-cli`
