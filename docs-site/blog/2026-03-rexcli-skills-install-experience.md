---
title: "RexCli Skills 安装体验更新：全局/项目范围、更清晰的选择器"
description: "RexCli 本次更新重做了 skills 安装与卸载体验：支持 global/project 范围选择、catalog 驱动的按需安装、Core/Optional 分组，以及更安全的卸载交互。"
date: 2026-03-17
tags: [RexCli, Skills, TUI, Onboarding, AI Development]
---

# RexCli Skills 安装体验更新：全局/项目范围、更清晰的选择器

这次迭代主要围绕一个很实际的问题展开：并不是所有 skills 都适合默认出现在每个项目里，尤其是带有明显业务语义或项目语义的技能。

为了解决这个问题，RexCli 对 `skills` 的安装、卸载和选择体验做了一轮收敛，让“系统核心能力”和“按需扩展能力”之间的边界更清楚。

## 支持 global / project 两种安装范围

现在安装 `skills` 时，用户可以显式选择安装范围：

- `global`：安装到用户全局目录，例如 `~/.codex/skills`
- `project`：安装到当前执行命令时所在的项目目录，也就是当前 `pwd`

这意味着你可以把通用方法论和系统型 skills 安装到全局，同时把强业务耦合、强项目耦合的 skills 安装到某个具体项目里，而不是默认污染所有仓库。

## 改成 catalog 驱动，而不是“扫到什么装什么”

本次安装流程不再简单扫描仓库里的 skills 目录，而是改为由 `config/skills-catalog.json` 驱动。

这样带来的直接好处是：

- skill 是否可见、可安装，由 catalog 明确定义
- `global` 和 `project` 下的可见范围可以分开控制
- 默认勾选哪些 skills，也可以按系统核心能力单独配置

对于像小红书、即梦这类特定工作流 skill，这个变化尤其关键。它们现在依然可以在 `global` 和 `project` 中显示，但不再默认勾选，避免新用户首次安装时被过多业务型能力干扰。

## Skill Picker 现在更容易扫读

这次还重做了 TUI 里的 skill 选择器：

- 增加 `Core` 和 `Optional` 分组
- 每个 skill 显示简短描述
- 长描述会自动截断，避免终端换行把列表打散

这样用户第一次进入安装界面时，可以先快速识别：

- 哪些是系统核心能力
- 哪些是扩展或业务型能力

目前被归为 `Core` 的不仅有 `find-skills`、`verification-loop`、`skill-constraints`，也包括：

- `aios-project-system`
- `aios-long-running-harness`
- `contextdb-autopilot`

这些都属于这套系统实际运行时会频繁用到的基础能力。

## 卸载交互更保守

之前如果卸载列表展示全部 skills，再默认勾选已安装项，终端里会比较容易误操作。

现在的卸载逻辑更直接：

- 只显示当前 `scope + client` 下已经安装的 skills
- 默认一个都不勾选
- 用户只需要勾选自己想卸载的项

这让卸载动作更符合直觉，也更接近“面向真实状态操作”的产品方式。

## 覆盖关系也会在 doctor 中提示

如果同一个 skill 同时存在于 `project` 和 `global`，`doctor` 现在会给出覆盖提示，明确告诉用户：

- `project install overrides global install`

这样在多项目、多 client 使用时，排查技能来源会更直接。

## 适合谁升级

如果你满足下面任一场景，这轮更新会比较有价值：

- 你在多个项目中共用一套 CLI 环境
- 你不希望业务型 skill 默认进入所有仓库
- 你希望首次安装时只启用核心能力，再按需扩展
- 你希望卸载行为更保守、更不容易误删

## 查看完整更新

```bash
rex changelog
```

## 相关链接

- [完整更新日志](../changelog.md)
- [快速开始](../getting-started.md)
- [Superpowers](../superpowers.md)
- [ContextDB](../contextdb.md)
