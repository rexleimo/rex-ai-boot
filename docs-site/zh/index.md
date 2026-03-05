---
title: 概览
description: 把现有 Codex/Claude/Gemini/OpenCode CLI 升级为 OpenClaw 风格能力。
---

# RexCLI

> 不换工具，不改习惯。给你正在用的 CLI 加一层能力。

[快速开始](getting-started.md){ .md-button .md-button--primary }
[案例集](case-library.md){ .md-button }

项目地址：<https://github.com/rexleimo/rex-cli>

## 这是什么？

RexCLI 是一个薄薄的能力层，装在你现有的 CLI 智能体上面。它不替代你的 `codex`、`claude`、`gemini` 或 `opencode`，只是让它们用起来更顺手。

四个核心能力：

1. **记忆能跨会话** - 关闭终端再打开，上次的项目上下文还在。
2. **浏览器自动化** - 用 MCP 控制 Chrome，不用手动点鼠标。
3. **技能可复用** - 把一次性的对话，变成能重复用的工作流。
4. **隐私保护** - 读取配置前自动脱敏，避免密钥进到提示词里。

## 给谁用的？

- 你已经在用 `codex`、`claude`、`gemini` 或 `opencode`
- 希望工作流能跨终端重启
- 需要浏览器自动化但不想换工具
- 不想让 API Key 留在聊天记录里

## 怎么开始

```bash
git clone https://github.com/rexleimo/rex-cli.git
cd rex-cli
scripts/setup-all.sh --components all --mode opt-in
source ~/.zshrc
codex
```

## 包含什么

| 功能 | 作用 |
|---|---|
| ContextDB | 跨会话持久化记忆 |
| Playwright MCP | 浏览器自动化 |
| Skills | 可复用工作流片段 |
| Privacy Guard | 自动脱敏敏感信息 |

## 继续阅读

- [快速开始](getting-started.md)
- [案例集](case-library.md)
- [架构](architecture.md)
- [ContextDB](contextdb.md)
- [更新日志](changelog.md)
