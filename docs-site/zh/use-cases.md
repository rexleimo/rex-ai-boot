---
title: CLI 工作流
description: 交互模式与 one-shot 模式的推荐用法。
---

# CLI 工作流

## 快速答案（AI 搜索）

日常开发优先用交互模式自动续跑；需要一次命令完成完整闭环时使用 one-shot 模式。

想看更具体的"能做什么 + 怎么做"示例，请查看[官方案例库](case-library.md)。

## 模式 A：交互式续跑

直接运行原命令，自动执行：

`init -> session:latest/new -> context:pack -> 启动 CLI`

```bash
codex
claude
gemini
```

适用于日常开发，自动注入启动上下文。

## 模式 B：One-shot 自动闭环

一次命令跑完 5 步：

`init -> session:latest/new -> event:add -> checkpoint -> context:pack`

```bash
scripts/ctx-agent.sh --agent claude-code --prompt "总结错误并提出下一步"
scripts/ctx-agent.sh --agent gemini-cli --prompt "根据 checkpoint 继续实现"
scripts/ctx-agent.sh --agent codex-cli --prompt "运行测试并更新任务状态"
```

## 跨 CLI 接力

常见链路：

1. 用 Claude 分析。
2. 用 Codex 实现。
3. 用 Gemini 验证/对比。

因为三者都读写同一个项目 ContextDB，接力保持连贯。

## 透传命令

管理命令不会被包装，原生运行，例如：

```bash
codex mcp
claude doctor
gemini extensions
```

## 常见问答

### 什么时候用 one-shot？

当你需要单命令完成"记录事件 + 写 checkpoint + 导出上下文"并保留审计链路时。

### 一个任务里可以切换多个 CLI 吗？

可以。只要在同一项目上下文下运行，跨 CLI 接力不会丢状态。
