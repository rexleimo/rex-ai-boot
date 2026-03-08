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
