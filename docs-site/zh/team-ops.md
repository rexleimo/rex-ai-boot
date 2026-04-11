---
title: Agent Team & HUD
description: 使用 HUD 仪表板和 Team Ops 状态跟踪监控和管理多 agent 协作。
---

# Agent Team 与 HUD

AIOS 提供 **Team Operations (Team Ops)** — 一套用于监控和管理跨 Codex CLI、Claude Code 和 Gemini CLI 会话的多 agent 协作工具。

## 概述

Team Ops 让你能够查看：
- **实时会话状态** 通过 HUD (Heads-Up Display)
- **历史会话分析** 带有 quality-gate 跟踪
- **技能改进机会** 通过 skill candidates
- **Dispatch 事后分析** 用于调试失败运行

## 快速开始

### 查看当前会话状态

```bash
# 当前会话的最小 HUD
aios hud

# 完整详情和 watch 模式
aios hud --watch --preset full

# 指定 provider 和会话
aios hud --provider codex --session <session-id>
```

### Team Status 与 History

```bash
# 实时监控 team 状态
aios team status --provider codex --watch

# 查看会话历史（最近 20 次运行）
aios team history --provider codex --limit 20
```

## 核心组件

### HUD (Heads-Up Display)

HUD 为单个会话提供实时仪表板：
- 当前任务目标
- Dispatch 状态（已执行、阻塞、待处理的作业）
- Quality-gate 结果
- Skill candidate 可用性
- Hindsight 分析（失败模式、回归）

**HUD Presets:**
| Preset | 使用场景 |
|--------|----------|
| `minimal` | 长时间 watch 会话 |
| `compact` | 终端友好的摘要 |
| `focused` (默认) | 平衡详情 |
| `full` | 完整诊断 |

### Team Status

显示 provider 所有最近会话的聚合状态：
- 活跃 vs 完成会话
- 成功/失败率
- Quality-gate 摘要
- 顶部 skill candidates

### Team History

过去会话的历史分析：
- Dispatch 结果
- Quality-gate 失败分类
- Hindsight 模式（重复失败、回归）
- Fix hints 和推荐

## Skill Candidates

**Skill Candidates** 是从失败会话中提取的自动化改进建议：

1. 会话未通过 quality-gate
2. Learn-eval 分析失败模式
3. 生成 skill patch draft
4. 你审查并应用补丁

### 查看 Skill Candidates

```bash
# 显示当前会话的 candidates
aios team status --show-skill-candidates

# HUD 带 skill candidate 详情视图
aios hud --show-skill-candidates --skill-candidate-view detail

# 列出特定会话的 candidates
aios team skill-candidates list --session-id <session-id>
```

### 导出和应用补丁

```bash
# 导出补丁模板到 artifact 文件
aios team status --export-skill-candidate-patch-template

# 使用自定义输出路径导出
aios team skill-candidates export --output-path ./my-patch.md

# 应用 skill candidate 补丁
aios skill-candidate apply <candidate-id>
```

### 按 Draft ID 过滤

```bash
# 按 draft ID 过滤 skill candidates
aios team status --show-skill-candidates --draft-id <draft-id>

# HUD 带 draft 过滤
aios hud --show-skill-candidates --draft-id <draft-id>
```

## Quality-Gate 过滤器

按 quality-gate 结果过滤历史：

```bash
# 仅显示失败会话
aios team history --quality-failed-only

# 按特定分类过滤
aios team history --quality-category clarity
aios team history --quality-category sample.latency-watch

# 按分类前缀过滤（匹配任意）
aios team history --quality-category-prefix clarity,sample

# 按前缀过滤（匹配所有）
aios team history --quality-category-prefixes clarity,dispatch --prefix-mode all
```

## 命令参考

### `aios hud`

| 选项 | 默认值 | 描述 |
|--------|---------|-------------|
| `--session-id` | current | 目标会话 ID |
| `--provider` | codex | Provider (codex/claude/gemini) |
| `--preset` | focused | HUD preset (minimal/compact/focused/full) |
| `--watch` | false | 持续监控 |
| `--fast` | false | 快速模式（减少数据获取） |
| `--show-skill-candidates` | false | 显示 skill candidate 详情 |
| `--skill-candidate-limit` | 6 | 最多显示 candidates 数量 (1-20) |
| `--skill-candidate-view` | inline | 视图模式 (inline/detail) |
| `--export-skill-candidate-patch-template` | false | 导出补丁 artifact |
| `--draft-id` | - | 按 draft ID 过滤 |
| `--json` | false | 输出为 JSON |
| `--interval-ms` | 1000 | Watch 刷新间隔 |

### `aios team status`

| 选项 | 默认值 | 描述 |
|--------|---------|-------------|
| `--session-id` | current | 目标会话 ID |
| `--provider` | codex | Provider (codex/claude/gemini) |
| `--preset` | focused | HUD preset |
| `--watch` | false | 持续监控 |
| `--fast` | false | 快速模式 |
| `--show-skill-candidates` | false | 显示 skill candidates |
| `--skill-candidate-limit` | 6 | 最多 candidates 数量 (1-20) |
| `--export-skill-candidate-patch-template` | false | 导出补丁 artifact |
| `--draft-id` | - | 按 draft ID 过滤 |
| `--json` | false | 输出为 JSON |

### `aios team history`

| 选项 | 默认值 | 描述 |
|--------|---------|-------------|
| `--provider` | codex | Provider (codex/claude/gemini) |
| `--limit` | 10 | 最多显示会话数 |
| `--concurrency` | 4 | 并行会话读取 |
| `--fast` | false | 跳过 hindsight 详情 |
| `--quality-failed-only` | false | 仅显示失败会话 |
| `--quality-category` | - | 按分类过滤 |
| `--quality-category-prefix` | - | 按前缀过滤 |
| `--quality-category-prefixes` | - | 多个前缀 |
| `--quality-category-prefix-mode` | any | 匹配模式 (any/all) |
| `--draft-id` | - | 按 draft ID 过滤 |
| `--since` | - | 按日期过滤 (ISO) |
| `--status` | - | 按状态过滤 |
| `--json` | false | 输出为 JSON |

### `aios team skill-candidates`

| 子命令 | 描述 |
|------------|-------------|
| `list` | 列出会话的 skill candidates |
| `export` | 导出补丁模板 artifact |

## 相关文档

- [HUD 指南](hud-guide.md) - HUD 详细使用和自定义
- [Skill Candidates](skill-candidates.md) - 理解和应用技能补丁
- [ContextDB](contextdb.md) - 会话存储和记忆系统
