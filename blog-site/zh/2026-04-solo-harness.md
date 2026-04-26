---
title: "Solo Harness：让一个 Agent 过夜跑，但你依然可控"
description: "AIOS 1.7 新增 `aios harness`，支持可恢复的单 Agent 长任务执行，带 run journal、status/stop/resume 控制、HUD 可见性和可选 worktree 隔离。"
date: 2026-04-26
tags: ["AIOS", "Solo Harness", "单 Agent", "ContextDB", "自动化"]
---

# Solo Harness：让一个 Agent 过夜跑，但你依然可控

大多数 coding CLI 都很擅长处理一个短 prompt，但一旦需求变成「围绕一个目标持续干几个小时，甚至我睡觉时也继续跑」，体验通常就不完整了。人一离开终端，就很容易失去可见性、停止控制和顺畅恢复能力。

AIOS 1.7 这次补上的，就是 `aios harness`：一条面向单 Agent 夜跑和长任务的执行通道。

## 一次性 CLI 循环的问题在哪里

- 适合短请求，不适合无人值守的单目标任务。
- 跑了几小时后，往往说不清 Agent 到底做了什么。
- 想停下来时，很多时候只能粗暴打断，而不是等到安全边界。
- 想继续时，经常要重新补上下文和 operator 意图。
- 直接在主工作区里跑，容易留下难处理的脏 diff。

## `aios harness` 这次带来了什么

`aios harness` 给「一个 Agent 围绕一个目标持续推进」补齐了可恢复的 operator loop：

- `run`：启动 session，并记录目标。
- `status`：查看最新结构化状态和 artifact。
- `stop`：请求它在下一个安全边界停下。
- `resume`：继续同一个 session，而不是重开一个全新任务。
- `hud`：现在能自动识别 solo harness session，直接展示最新摘要。
- `--worktree`：把夜跑改动隔离到可丢弃的 git worktree。

## 快速开始

```bash
# 在隔离 worktree 里启动夜跑
aios harness run --objective "整理明早交接清单" --session nightly-demo --worktree

# 查看结构化状态
aios harness status --session nightly-demo --json

# 在 HUD 里看同一个 session
aios hud --session nightly-demo --json

# 请求它在安全边界停下
aios harness stop --session nightly-demo --reason "白天人工接手"

# 后面继续同一个 session
aios harness resume --session nightly-demo
```

如果你想先确认 artifact 契约，不想马上消耗 token，可以先 dry-run：

```bash
aios harness run --objective "整理明早交接清单" --session nightly-demo --worktree --dry-run --json
```

## 这条运行链路会写下什么

每个 session 的 run journal 都会落在：

```text
memory/context-db/sessions/<session-id>/artifacts/solo-harness/
```

核心文件包括：

- `objective.md`：标准化后的目标描述。
- `run-summary.json`：当前状态、迭代计数、backoff 状态和 worktree 元数据。
- `control.json`：operator 的停止请求和备注。
- `iteration-0001.json`：每轮归一化后的结果。
- `iteration-0001.log.jsonl`：每轮原始日志流，便于排查。

这样第二天接手时，你看到的是可读的 run journal，而不是一句模糊的「它昨晚跑过了」。

## 为什么 `--worktree` 很关键

夜跑场景不应该依赖粗暴的 `git reset --hard` 来兜底。

带上 `--worktree` 后，AIOS 会为这次 harness session 创建一个隔离的 git worktree，避免 Agent 直接污染你的主工作区。如果这次运行没产出有效结果，临时 worktree 可以清理掉；如果产出了值得保留的改动，相关 worktree 元数据也会跟着 run summary 一起保留下来，方便人工接手和合并。

## Solo Harness、Agent Team、Orchestrate 怎么选

| 需求 | 更适合 |
|---|---|
| 单目标、单 provider、可恢复的过夜执行 | `aios harness ...` |
| 任务能清晰拆分成多个并行 worker | `aios team ...` |
| 需要带 preflight gate 的阶段式编排 | `aios orchestrate ...` |

一句话理解：如果这份工作就该由一个 Agent 持续推进，而不是升级成项目级编排，就用 Solo Harness。

## 延伸阅读

- [Solo Harness 文档](https://cli.rexai.top/zh/solo-harness/)
- [HUD 指南](https://cli.rexai.top/zh/hud-guide/)
- [Agent Team 文档](https://cli.rexai.top/zh/team-ops/)
- [按场景找命令](https://cli.rexai.top/zh/use-cases/)
