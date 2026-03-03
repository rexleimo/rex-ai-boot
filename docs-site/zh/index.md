---
title: 概览
description: rex-ai-boot 项目定位、能力与使用入口。
---

# rex-ai-boot 文档

`rex-ai-boot` 是面向三类 CLI 智能体的本地工作流层：

- Codex CLI
- Claude Code
- Gemini CLI

它不替代原生 CLI，而是补充两项能力：

1. 文件系统 ContextDB（可恢复会话记忆）
2. 透明包装流程（继续直接输入 `codex` / `claude` / `gemini`）

## 解决的问题

- 终端重启后仍可继续上下文。
- 按项目维度隔离会话记忆（git 根目录）。
- 多 CLI 之间可通过同一 Context 包接力。

## 快速示例

```bash
codex
claude
gemini

scripts/ctx-agent.sh --agent codex-cli --prompt "继续上一阶段并执行下一步"
```

## 友情链接

- [os.rexai.top](https://os.rexai.top)
  - RexOS 智能体操作系统：强调 harness-first 长任务执行，内置 SQLite 记忆与沙箱化工具运行时，适合复杂自动化流程。
- [rexai.top](https://rexai.top)
  - RexAI 内容站：聚合 AI 工程文章、教程与工具评测，也提供产品动态与实战案例。
- [tool.rexai.top](https://tool.rexai.top)
  - RexAI 工具站：免费、无广告、开发者友好的在线工具集合，强调稳定速度与持续更新。

## 继续阅读

- [快速开始](getting-started.md)
- [博客站点](https://cli.rexai.top/blog/zh/)
- [更新日志](changelog.md)
- [CLI 工作流](use-cases.md)
- [架构](architecture.md)
- [ContextDB](contextdb.md)
