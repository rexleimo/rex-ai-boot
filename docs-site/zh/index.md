---
title: 概览
description: 把现有 Codex/Claude/Gemini/OpenCode CLI 升级为 OpenClaw 风格能力。
---

# RexCLI

> 不换工具，不改习惯。给你正在用的 CLI 加一层能力。

[快速开始](getting-started.md){ .md-button .md-button--primary }
[Superpowers](superpowers.md){ .md-button }

项目地址：<https://github.com/rexleimo/rex-cli>

## 这是什么？

RexCLI 是一个薄薄的能力层，装在你现有的 CLI 智能体上面。它不替代你的 `codex`、`claude`、`gemini` 或 `opencode`，只是让它们用起来更顺手。

四个核心能力：

1. **记忆跨端共享** - 关闭终端再打开，上次的项目上下文还在，多设备同一项目共享同一记忆。
2. **浏览器自动化** - 用 MCP 控制 Chrome，不用手动点鼠标。
3. **Superpowers 智能规划** - 自动拆解需求、并发分发任务、自动验证结果。
4. **隐私保护** - 读取配置前自动脱敏，避免密钥进到提示词里。

## 给谁用的？

- 你已经在用 `codex`、`claude`、`gemini` 或 `opencode`
- 希望工作流能跨终端重启
- 需要浏览器自动化但不想换工具
- 想要自动化技能来强制最佳实践

## 怎么开始

```bash
curl -fsSL https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.sh | bash
source ~/.zshrc
aios
```

先运行 `aios` 打开全屏安装 TUI，选择 **Setup**，安装完成后再跑一次 **Doctor**。
Windows PowerShell 命令请看 [快速开始](getting-started.md)。

## 包含什么

| 功能 | 作用 |
|---|---|
| ContextDB | 跨会话持久化记忆 |
| Playwright MCP | 浏览器自动化 |
| Superpowers | 智能规划（自动拆解、并发分发、自动验证） |
| Privacy Guard | 自动脱敏敏感信息 |

## 继续阅读

- [Superpowers](superpowers.md) - 让 CLI 更聪明的自动化技能
- [快速开始](getting-started.md)
- [案例集](case-library.md)
- [架构](architecture.md)
- [ContextDB](contextdb.md)
- [更新日志](changelog.md)
