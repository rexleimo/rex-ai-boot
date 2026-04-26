---
title: 按场景找命令
description: 不先背概念，直接按“我想做什么”选择 RexCLI 命令。
---

# 按场景找命令

这页只回答一个问题：**我现在应该敲哪条命令？**

<figure class="rex-visual">
  <img src="../assets/visual-contextdb-memory-loop.svg" alt="ContextDB 项目记忆循环：创建 .contextdb-enable 后，codex、claude、gemini 共享本地项目记忆">
  <figcaption>大多数场景都围绕同一个核心：在项目根目录开启 ContextDB，之后不同 CLI 都能接上同一份本地上下文。</figcaption>
</figure>

## 我想安装并检查环境

```bash
aios
```

进入 TUI 后按顺序执行：

1. **Setup**：安装 shell 包装、skills、browser 等组件。
2. **Doctor**：检查 Node、MCP、skills、native 配置。
3. **Update**：以后升级也优先从这里走。

命令行方式：

```bash
aios setup --components all --mode opt-in --client all
aios doctor --native --verbose
```

## 我想让 agent 记住当前项目

```bash
cd /path/to/project
touch .contextdb-enable
codex
```

之后在同一项目里运行 `codex`、`claude`、`gemini`，都会接入同一个 ContextDB。

## 我想跨 CLI 接力

```bash
claude   # 先分析
codex    # 再实现
gemini   # 最后复查或对比
```

只要都在同一个项目目录里，ContextDB 会保存事件和 checkpoint，降低“换工具就丢上下文”的概率。

## 我想让一个 agent 自己过夜跑

适合：目标明确、只需要一个 provider、希望夜里持续推进，而且没必要拆成并行 worker。

```bash
aios harness run --objective "整理明早交接清单" --session nightly-demo --worktree
aios harness status --session nightly-demo --json
aios hud --session nightly-demo --json
```

如果你想让它停在安全边界，或者第二天继续：

```bash
aios harness stop --session nightly-demo --reason "白天人工接手"
aios harness resume --session nightly-demo
```

如果你要的是“一个 agent 盯一个目标持续做”，用 [单 Agent 夜跑](solo-harness.md)。如果任务本身适合并行拆分，再用 [多 Agent 实战](team-ops.md)。

## 我想开多 Agent

适合：模块独立、任务可以拆、你能接受 token 成本。

```bash
aios team 3:codex "实现 X，完成前运行测试并总结改动"
aios team status --provider codex --watch
```

不适合：需求还模糊、单点 bug、多个 worker 会改同一个文件。此时先用普通 `codex`。

## 我想看进度和历史

```bash
aios hud --provider codex
aios team status --provider codex --watch
aios team history --provider codex --limit 20
```

如果只想快速看最近失败：

```bash
aios team history --provider codex --quality-failed-only
```

## 我想让任务有质量门禁

```bash
aios quality-gate pre-pr --profile strict
```

适合提交 PR 前或大改后跑一遍。它会把 ContextDB、native/sync、release health 等检查纳入门禁。

## 我想让 RexCLI 分阶段编排

先预览，不调用模型：

```bash
aios orchestrate feature --task "Ship X" --dispatch local --execute dry-run
```

确认要 live 执行时再显式打开：

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli
aios orchestrate --session <session-id> --dispatch local --execute live
```

新用户优先用 `aios team ...`。`orchestrate live` 更适合已经理解 session、plan、preflight 的维护者。

## 我想排查浏览器自动化

```bash
aios internal browser doctor --fix
aios internal browser cdp-status
```

如果页面操作失败，先看 [故障排查](troubleshooting.md)，不要直接重装全部组件。

## 我想保护密钥和配置

```bash
aios privacy read --file .env
```

不要把 `.env`、cookies、token、浏览器 profile 原样贴给模型。RexCLI 的 Privacy Guard 会尽量在读取前脱敏。

## 选择口诀

- **日常开发**：`codex` / `claude` / `gemini`
- **安装更新**：`aios`
- **单 Agent 夜跑**：`aios harness run --objective "整理明早交接清单" --worktree`
- **多 Agent**：`aios team 3:codex "任务"`
- **看进度**：`aios team status --watch`
- **交付前检查**：`aios quality-gate pre-pr --profile strict`
- **浏览器问题**：`aios internal browser doctor --fix`
