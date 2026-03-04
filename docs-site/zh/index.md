---
title: 概览
description: rex-ai-boot 项目定位、能力与使用入口。
---

# rex-ai-boot 文档

项目地址：[https://github.com/rexleimo/rex-ai-boot](https://github.com/rexleimo/rex-ai-boot)

`rex-ai-boot` 是面向四类 CLI 智能体的本地工作流层：

- Codex CLI
- Claude Code
- Gemini CLI
- OpenCode

它不替代原生 CLI，而是补充两项能力：

1. 文件系统 ContextDB（可恢复会话记忆）
2. 透明包装流程（继续直接输入 `codex` / `claude` / `gemini`）

## 30 秒上手（先用再了解）

```bash
git clone https://github.com/rexleimo/rex-ai-boot.git
cd rex-ai-boot
scripts/setup-all.sh --components all --mode opt-in
source ~/.zshrc
codex
```

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

## 继续阅读

- [项目地址（GitHub）](https://github.com/rexleimo/rex-ai-boot)
- [快速开始](getting-started.md)
- [博客站点](https://cli.rexai.top/blog/zh/)
- [友情链接](friends.md)
- [更新日志](changelog.md)
- [CLI 工作流](use-cases.md)
- [官方案例库](case-library.md)
- [架构](architecture.md)
- [ContextDB](contextdb.md)
