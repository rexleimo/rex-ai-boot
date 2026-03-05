---
title: Superpowers
description: 可复用的自动化技能，让你的 CLI 更聪明。
---

# Superpowers

Superpowers 是可复用的自动化技能。它们挂载到 Claude Code、Codex、Gemini CLI 和 OpenCode 上，自动处理重复任务。

## 什么是 Superpowers？

不用重复相同的命令或提示词，直接调用一个技能，它会：
- 引导 AI 走通一个成熟的流程
- 自动强制最佳实践
- 完成任务前验证结果

## 现有 Superpowers

### brainstorming

开始任何创造性工作前，用它来锁定你的意图。

- 探索项目上下文
- 逐个问澄清问题
- 提出方案并对比优缺点
- 展示设计，代码前先获批

**适用场景**：开发新功能、设计页面、添加功能。

### writing-plans

把需求变成可执行的计划。

- 分析需求
- 拆成顺序步骤
- 识别依赖关系
- 输出详细计划文档

**适用场景**：有需求文档或多步骤任务，需要路线图。

### verification-before-completion

不要没验证就說完成了。

- 运行验证命令
- 确认输出符合预期
- 要求具体证据才能算成功

**适用场景**：功能完成、bug 修复、创建 PR 前。

### systematic-debugging

用证据修 bug，别靠猜。

- 收集症状和错误信息
- 形成假设
- 系统性测试
- 验证修复有效

**适用场景**：遇到测试失败、崩溃、或意外行为。

### dispatching-parallel-agents

同时跑多个独立任务。

- 识别独立的工作流
- 启动并行 agents
- 汇总结果
- 优雅处理失败

**适用场景**：2+ 个不共享状态的任务，可以同时跑。

### security-scan

自动化前检查配置安全问题。

- 扫描 skills、hooks、MCP 设置
- 识别暴露的密钥
- 建议修复

**适用场景**：启用自动化或修改配置时。

## 怎么用

1. 需要 superpowers 时，自然地说出来
2. AI 会调用技能并引导你
3. 结果保存到项目记忆

## 例子

```
帮我用 brainstorming 想想这个功能怎么做
用 writing-plans 把这个需求拆成步骤
完成前用 verification-before-completion 验证一下
```

## 继续阅读

- [案例集](case-library.md) - 真实使用案例
- [ContextDB](contextdb.md) - 记忆如何跨会话持久化
