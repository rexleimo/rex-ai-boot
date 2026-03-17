---
title: 更新日志
description: 版本历史、升级说明与文档变更入口。
---

# 更新日志

本页用于追踪 `RexCLI` 的版本变化，并快速跳转到相关文档。

## 官方发布记录

- GitHub 变更文件：[CHANGELOG.md](https://github.com/rexleimo/rex-cli/blob/main/CHANGELOG.md)
- GitHub Releases：[releases](https://github.com/rexleimo/rex-cli/releases)

## 最近版本

- `main`（未发布）：
  - `aios orchestrate` 上线 `subagent-runtime` live 执行（需 `AIOS_EXECUTE_LIVE=1`）
  - 新增有界 work-item 队列调度与 ownership hints 传播
  - 新增 no-op 快路径：上游 `filesTouched=[]` 时自动完成 `reviewer` / `security-reviewer`
  - 新增 Windows PowerShell 冒烟工作流：每次 push `main` 触发（`.github/workflows/windows-shell-smoke.yml`）
  - `skills` 安装支持 `global` / `project` 两种范围选择
  - skill 选择器改为 catalog 驱动，区分核心默认项与按需业务项；卸载时只显示已安装技能
  - TUI skill picker 新增 `Core` / `Optional` 分组，并对长描述做终端友好截断
  - `doctor` 会提示同名 skill 的 `project` 安装覆盖 `global` 安装
- `0.16.0`（2026-03-10）：新增 orchestrator agent catalog 与生成器
- `0.15.0`（2026-03-10）：`orchestrate live` 默认门禁（`AIOS_EXECUTE_LIVE`）
- `0.14.0`（2026-03-10）：新增 `subagent-runtime` 运行时适配器（stub）
- `0.13.0`（2026-03-10）：运行时 manifest 外置化
- `0.11.0`（2026-03-10）：扩展本地 orchestrate preflight 覆盖范围
- `0.10.4`（2026-03-08）：非 git 工作区 wrapper fallback 与文档同步
- `0.10.3`（2026-03-08）：修复 Windows cmd-backed CLI 启动
- `0.10.0`（2026-03-08）：安装/更新/卸载生命周期统一为 Node
- `0.8.0`（2026-03-05）：新增严格 Privacy Guard（支持 Ollama）并接入安装流程
- `0.5.0`（2026-03-03）：ContextDB SQLite sidecar 索引（`index:rebuild`）、可选 `--semantic` 检索路径、统一 `ctx-agent` 运行核心

## 2026-03-16 运行观测状态

- 连续 live sample 维持成功（`dispatchRun.ok=true`），最新 artifact：
  - `memory/context-db/sessions/codex-cli-20260303T080437-065e16c0/artifacts/dispatch-run-20260316T111419Z.json`
- `learn-eval` 当前仍给出：
  - `[fix] runbook.failure-triage`（`clarity-needs-input=5`）
  - `[observe] sample.latency-watch`（`avgElapsedMs=160678`）
- 结论：timeout 暂不下调，继续按 latency-watch 观测。

## 相关阅读

- [博客：Skills 安装体验更新](blog/2026-03-rexcli-skills-install-experience.md)
- [快速开始](getting-started.md)
- [ContextDB](contextdb.md)
- [故障排查](troubleshooting.md)

## 更新规则

凡是涉及安装、运行行为、兼容性的发布，必须在同一 PR 同步更新文档并在本页体现。
