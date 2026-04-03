# 更新日志

本文件记录本项目的所有重要变更。

格式基于 Keep a Changelog，遵循语义化版本规范。

## [未发布]

## [1.1.0] - 2026-04-02

- feat(tui): 切换到 React Ink + Ink UI 组件架构重构 TUI 安装器
- feat(tui-ink): 添加基于 MemoryRouter 的屏幕导航（MainScreen、SetupScreen、UpdateScreen、UninstallScreen、DoctorScreen、SkillPickerScreen、ConfirmScreen）
- feat(tui-ink): 添加 useSetupOptions hook 共享选项状态
- feat(tui-ink): 添加自定义 ScrollableSelect 组件实现技能选择器滚动窗口
- feat(tui-ink): 添加 Header、Footer、Checkbox 组件
- refactor(tui): 移除旧的字符串渲染 TUI 实现
- fix(tui-ink): 补充 React 导入并修复 tsx 执行
- docs: 添加 Ink TUI 重构设计与实现计划文档

## [1.0.0] - 2026-03-17

- feat(skills): 采用规范化的技能源码树，统一使用 Node 22
- feat(aios): 将编排器 agent 接入生命周期组件
- feat(orchestrate): 从编排器蓝图派生各阶段
- feat(harness): 通过 CLI 子代理实现 `subagent-runtime` 实时执行（`AIOS_SUBAGENT_CLIENT=codex-cli|claude-code|gemini-cli`）
- feat(harness): 优先使用 codex-cli v0.114+ 的结构化输出（`--output-schema`、`--output-last-message`、stdin）实现稳定的 JSON 交接（对旧版本做降级处理）
- feat(skills): 添加作用域感知的目录驱动安装流程，支持 `global` 和 `project` 作用域
- feat(skills): 在两个作用域选择器中暴露项目级技能，不做默认选中
- feat(skills): 默认核心技能集包含 `skill-constraints`、`aios-project-system`、`aios-long-running-harness` 和 `contextdb-autopilot`
- feat(tui): 显示技能描述，将技能分组为 `Core` / `Optional`，卸载时仅显示已安装技能
- fix(skills): doctor 检查时警告项目安装覆盖全局安装的情况
- fix(learn-eval): 将 ContextDB 质量失败路由到具体门控目标
- fix(ctx-agent): context:pack 失败时默认开放（设置 `CTXDB_PACK_STRICT=1` 使其致命）
- fix(ctx-agent): 通过 shell 感知的 spawn 规范支持 cmd 封装的 CLI 包装器（防止 Windows 包装器回归）
- fix(contextdb): 容错旧版 context 记录（缺失 text/refs/actions）于 context pack 中
- test(contextdb): 添加 ContextDB 质量门控，防止 context:pack 回归
- docs: 记录 orchestrate 实时执行与子代理运行时环境控制
- docs(blog): 添加子代理运行时发布说明
- docs(blog): 添加作用域感知技能安装体验发布说明

## [0.17.0] - 2026-03-17

- feat(tui): 添加卸载选择器滚动、底部锚定批量操作，以及安装/更新选择器中的已安装标记
- fix(tui): 保持卸载选择器光标选择与渲染分组顺序对齐
- docs: 更新 README 和文档站 onboarding 文案，适配改进后的技能选择器 UX
- docs(blog): 在技能安装体验文章中补充最新 TUI 卸载和已安装标记改进

## [0.16.0] - 2026-03-10

- feat(aios): 添加编排器 agent 目录和生成器

## [0.15.0] - 2026-03-10

- feat(aios): 将实时 orchestrate 执行门控在 `AIOS_EXECUTE_LIVE` 之后

## [0.14.0] - 2026-03-10

- feat(aios): 添加子代理运行时存根适配器

## [0.13.0] - 2026-03-10

- feat(aios): 外部化运行时清单规范

## [0.12.0] - 2026-03-10

- feat(aios): 添加运行时适配器边界

## [0.11.0] - 2026-03-10

- feat(aios): 扩展本地 orchestrate 预检覆盖

## [0.10.4] - 2026-03-08

- fix: 修复非 git 工作区上的 wrapper 回退逻辑并同步文档

## [0.10.3] - 2026-03-08

- fix(windows): 支持 cmd 封装的 CLI 启动

## [0.10.2] - 2026-03-08

- fix(windows): 将 contextdb npm 调用路由经 node cli

## [0.10.1] - 2026-03-08

- fix(windows): 解决 node 生命周期中的 npm cli 启动问题

## [0.10.0] - 2026-03-08

- feat(onboarding): 将生命周期流程整合到 node

## [0.9.0] - 2026-03-07

- feat: 添加混合浏览器快照和可见优先启动默认值

## [0.8.1] - 2026-03-05

- docs: 添加 contextdb Node ABI 不匹配排查指南

## [0.8.0] - 2026-03-05

- 添加基于 ollama 的隐私保护与脱敏功能

## [0.7.0] - 2026-03-05

- feat: 添加浏览器挑战检测和人工接管信号

## [0.6.2] - 2026-03-04

- fix: 为 opt-in 包装器模式自动创建 .contextdb-enable

## [0.6.1] - 2026-03-04

- fix(windows): 强化浏览器 doctor 并明确 Node 20+ 前置要求

## [0.6.0] - 2026-03-04

- feat: 添加跨 CLI doctor + 安全扫描技能包

## [0.5.3] - 2026-03-04

- docs(site): 双向连接 docs/blog 导航，简化博客首页 footer 区域

## [0.5.2] - 2026-03-03

- docs(site): 将 rexai 链接移至全局 footer 导航

## [0.5.1] - 2026-03-03

- docs: 对齐 superpowers 工作流路由并添加 RexAI 友链

## [0.5.0] - 2026-03-03

- feat(contextdb): 添加 SQLite 辅助索引（`memory/context-db/index/context.db`）及 `index:rebuild`
- feat(contextdb): 将 `search`/`timeline`/`event:get` 切换到 SQLite 检索，附带回退逻辑
- feat(contextdb): 添加可选的语义重排路径（`--semantic`、`CONTEXTDB_SEMANTIC=1`）
- refactor(scripts): 通过 `ctx-agent-core.mjs` 统一 `ctx-agent.sh` 和 `ctx-agent.mjs`

## [0.4.3] - 2026-03-03

- docs: 通过 AI 搜索答案和改进变更日志导航提升功能页面 SEO/GEO

## [0.4.2] - 2026-03-03

- docs: 将 Windows 指南合并到快速入门并添加 OS 选项卡

## [0.4.1] - 2026-03-03

- docs: 添加独立的 Windows 指南页面和快速入门交叉链接

## [0.4.0] - 2026-03-03

- feat: 添加 Windows PowerShell 浏览器/contextdb 设置支持

## [0.3.1] - 2026-03-03

- chore: 浏览器 MCP 上线后提升版本

## [0.3.0] - 2026-03-03

- feat: 添加一键命令安装/诊断浏览器 MCP 及默认 cdp 回退

## [0.2.0] - 2026-03-03

- feat: 添加语义版本治理和 versioning-by-impact 技能

## [0.1.0] - 2026-03-03

- 初始化项目版本管理（`VERSION`、`CHANGELOG.md`）和发布工具基线。
