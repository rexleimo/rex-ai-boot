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

- `0.8.0`（2026-03-05）：新增严格 Privacy Guard（`~/.rexcil`），配置类文件必须走脱敏读取路径，支持 Ollama（`qwen3.5:4b`）并接入安装流程
- `0.7.0`（2026-03-05）：新增浏览器反自动化挑战检测（`browser_challenge_check`）与明确人工接管信号
- `0.6.2`（2026-03-04）：修复 opt-in wrapper 模式下未自动创建 `.contextdb-enable` 的问题
- `0.6.1`（2026-03-04）：加固 Windows `browser doctor`，并明确 Node 20+ 前置要求
- `0.6.0`（2026-03-04）：新增跨 CLI `doctor` 与安全扫描 skills 套件
- `0.5.3`（2026-03-04）：docs 站点导航更新与博客首页页脚简化
- `0.5.2`（2026-03-03）：docs 站点页脚统一为 RexAI 全局链接
- `0.5.1`（2026-03-03）：文档与 superpowers 默认流程对齐
- `0.5.0`（2026-03-03）：ContextDB 新增 SQLite sidecar 索引、`index:rebuild`、可选 `--semantic` 检索路径，以及统一 `ctx-agent` 运行核心
- `0.4.2`（2026-03-03）：将 Windows 步骤合并到标签化 Quick Start
- `0.4.1`（2026-03-03）：新增独立 Windows 指南与互链
- `0.4.0`（2026-03-03）：新增 Windows PowerShell 安装脚本

## 相关阅读

- [快速开始](getting-started.md)
- [ContextDB](contextdb.md)
- [故障排查](troubleshooting.md)

## 更新规则

凡是涉及安装、运行行为、兼容性的发布，必须在同一 PR 同步更新文档并在本页体现。
