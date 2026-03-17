---
title: "RexCli Skills 安装体验更新：全局/项目范围、更清晰的选择器"
description: "RexCli 本次更新不只重做了 skills 安装与卸载体验，也把仓库内 skill 主源收口到 skill-sources/，默认安装模式改成可移植 copy，并把 Node 运行基线统一到 22 LTS。"
date: 2026-03-17
tags: [RexCli, Skills, TUI, Onboarding, AI Development]
---

# RexCli Skills 安装体验更新：全局/项目范围、更清晰的选择器

这次迭代主要围绕两个实际问题展开：

1. 并不是所有 skills 都适合默认出现在每个项目里，尤其是带有明显业务语义或项目语义的技能。
2. 仓库里的 skills 既充当“源文件”，又充当“安装目标”，会让跨机器、跨项目同步越来越难维护。

为了解决这两个问题，RexCli 对 `skills` 的安装、卸载、同步和仓库内存放方式做了一轮收敛，让“系统核心能力”“按需扩展能力”“canonical source tree”“生成产物”之间的边界都更清楚。

## Canonical source tree 改成 `skill-sources/`

现在仓库内 skill 的主源目录不再是 `.codex/skills` 或 `.claude/skills`。

新的约定是：

- `skill-sources/` 是 canonical source tree
- `.codex/skills`、`.claude/skills`、`.agents/skills`、`.gemini/skills`、`.opencode/skills` 是生成出来的兼容目录
- repo 内这些兼容目录由 `node scripts/sync-skills.mjs` 统一写入和更新

这意味着以后跨电脑、跨项目拷贝 skill 时，应该以 `skill-sources/` 为主，而不是把某个 client 的 discoverable 目录当作源文件夹继续复制。

同时，`node scripts/check-skills-sync.mjs` 现在会作为 release preflight 的一部分，确保仓库里生成目录和 canonical source tree 没有漂移。

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

## 默认安装模式改成 `copy`

以前 skills 更偏向 link/symlink 式安装，这对本地开发方便，但对跨机器迁移和打包分发并不友好。

现在默认行为改成：

- 安装时默认复制 skill 树
- 目标目录写入元数据，供 `doctor` / `uninstall` 识别
- 只有在明确需要本地开发联动时，才使用 `--install-mode link`

这让全局安装、项目安装、离线发布包和跨机器迁移的行为更一致，也更符合“安装出来的东西应该自己能跑”的预期。

## source repo 不再允许把 `--scope project` 当安装入口

canonical source tree 收口之后，source repo 自己的 repo-local skill roots 已经有明确 owner，也就是 `sync-skills`。

所以现在如果你在 RexCli 源仓库里执行：

```bash
aios setup --components skills --scope project
```

会直接被拦住，并提示你改用：

```bash
node scripts/sync-skills.mjs
```

这个限制看起来更严格，但它能避免“同一个目录既像安装目标，又像源码目录”的所有权混乱。

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

这一轮还继续把 TUI 细节补齐了：

- 小终端里，卸载列表会按可用高度滚动，而不是把内容一次性铺满
- `Select all`、`Clear all`、`Done` 固定在底部，更容易反复操作
- 卸载列表内部的光标和实际勾选项现在严格一一对应，不再出现“光标在 A，实际勾到 B”的错位

同时，安装和更新场景也补了一个更直接的状态提示：

- 在 `setup` / `update` 的 skill picker 中，已经安装过的 skill 会显示 `(installed)`

这样用户在做增量安装或整理全局环境时，不需要先退出 TUI 再查一次状态。

## Node 运行基线也一起收口到 22 LTS

这轮更新还顺手把运行时口径统一了。

RexCli 现在明确以 **Node 22 LTS** 为推荐和约束基线。原因很简单：`better-sqlite3` 这类 native 依赖一旦遇到错误的 Node ABI，表面看像“功能坏了”，实际只是运行时版本漂移。

这次文档和版本文件也同步加上了：

- `.nvmrc`
- `.node-version`
- `package.json` / `mcp-server/package.json` 的 engine 约束

这样本地环境、CI 和发布流程终于对齐到同一条线。

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
