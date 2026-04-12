---
title: 概览
description: 面向 Codex/Claude/Gemini/OpenCode 的 AI 记忆系统文档，覆盖 Hermes 引擎工作流、Agent Team 与自动化子代理规划。
---

# RexCLI

> 不换工具，不改习惯。给你正在用的 CLI 加一层能力。

[在 GitHub 上 Star](https://github.com/rexleimo/rex-cli?utm_source=cli_rexai_top&utm_medium=docs&utm_campaign=english_growth&utm_content=home_hero_star){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="github_star" }
[快速开始](getting-started.md){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="quick_start" }
[对比工作流](cli-comparison.md){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="compare_workflows" }
[Superpowers](superpowers.md){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="superpowers" }

项目地址：<https://github.com/rexleimo/rex-cli>

## 快速答案

RexCLI 是一层 **AI 记忆系统 + 编排层**，服务于 coding agent。  
如果你的目标是：

- **记忆系统** 的跨会话上下文（`ContextDB`）
- 类 **Hermes 引擎** 的自动化工作流与执行控制
- **Agent Team** 多智能体协作交付
- **自动化规划子代理** 与预检门控

那么这套文档就是为这类场景准备的。

## 关键词到功能映射

- `AI 记忆系统` -> [ContextDB](contextdb.md)
- `记忆系统` -> [案例 - 跨 CLI 接力](case-cross-cli-handoff.md)
- `Hermes 引擎` -> [CLI 工作流](use-cases.md)
- `Agent Team` -> [Agent Team & HUD](team-ops.md)
- `自动化规划子代理` -> [架构](architecture.md)

## 最新特性

- [AIOS RL 训练系统：从合成 BUG 修复到多环境联合学习](/blog/rl-training-system/)
- [ContextDB 检索升级：默认走 FTS5/BM25](/blog/contextdb-fts-bm25-search/)
- [Windows 启动稳定性更新](/blog/windows-cli-startup-stability/)
- [Orchestrate Live：Subagent Runtime](/blog/orchestrate-live/)

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

上面这条命令是稳定版安装路径。如果你要使用未发布的 `main` 分支行为，请改走 [快速开始](getting-started.md) 里的开发用 `git clone` 路径。

先运行 `aios` 打开全屏安装 TUI，选择 **Setup**，安装完成后再跑一次 **Doctor**。
Windows PowerShell 命令请看 [快速开始](getting-started.md)。

## 包含什么

| 功能 | 作用 |
|---|---|
| ContextDB | 跨会话持久化记忆 |
| Playwright MCP | 浏览器自动化 |
| Superpowers | 智能规划（自动拆解、并发分发、自动验证） |
| Privacy Guard | 自动脱敏敏感信息 |

## FAQ

### RexCLI 算面向 coding agent 的记忆系统吗？
是。`ContextDB` 会在同一仓库内跨会话持久化与回灌上下文，并可在不同 CLI agent 之间共享。

### 能做 Hermes 风格的编排工作流吗？
可以。通过 `team` 与 `orchestrate` 可以实现分阶段规划、执行路由和验证门禁。

### 支持自动化子代理规划吗？
支持。RexCLI 提供 `single/subagent/team` 的路由判定和执行门控。

## 继续阅读

- [Superpowers](superpowers.md) - 让 CLI 更聪明的自动化技能
- [快速开始](getting-started.md)
- [Raw CLI vs RexCLI](cli-comparison.md)
- [案例集](case-library.md)
- [架构](architecture.md)
- [ContextDB](contextdb.md)
- [更新日志](changelog.md)
