---
title: 快速开始
description: 一套流程覆盖 macOS、Linux、Windows，通过标签切换不同命令。
---

# 快速开始

本页已合并 macOS、Linux、Windows 的安装流程。命令不同时，按系统标签切换执行。

## 快速答案（AI 搜索）

`rex-ai-boot` 不替换原生 CLI，而是在保留 `codex`、`claude`、`gemini` 原命令习惯的同时，增加项目级 ContextDB 记忆和统一 Browser MCP 能力。

## 前置条件

- Node.js 18+ 与 `npm`
- 至少安装一个 CLI：`codex`、`claude`、`gemini`
- 一个用于启用项目级 ContextDB 的 git 仓库

## 0) 一条命令安装（推荐）

=== "macOS / Linux"

    ```bash
    scripts/setup-all.sh --components all --mode opt-in
    source ~/.zshrc
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components all -Mode opt-in
    . $PROFILE
    ```

按需选择组件示例：

=== "macOS / Linux"

    ```bash
    # 仅安装 shell 包装 + skills
    scripts/setup-all.sh --components shell,skills --mode opt-in

    # 仅安装 browser MCP
    scripts/setup-all.sh --components browser
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components shell,skills -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components browser
    ```

一条命令更新 / 卸载：

=== "macOS / Linux"

    ```bash
    scripts/update-all.sh --components all --mode opt-in
    scripts/uninstall-all.sh --components shell,skills
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-all.ps1 -Components all -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-all.ps1 -Components shell,skills
    ```

如果你更喜欢分组件安装，继续看下面 1-8 步。

## 1) 安装 Browser MCP

=== "macOS / Linux"

    ```bash
    scripts/install-browser-mcp.sh
    scripts/doctor-browser-mcp.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-browser-mcp.ps1
    powershell -ExecutionPolicy Bypass -File .\scripts\doctor-browser-mcp.ps1
    ```

## 2) 构建 ContextDB CLI

```bash
cd mcp-server
npm install
npm run build
```

## 3) 安装命令包装（推荐）

=== "macOS / Linux (zsh)"

    ```bash
    scripts/install-contextdb-shell.sh --mode opt-in
    scripts/doctor-contextdb-shell.sh
    source ~/.zshrc
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-shell.ps1 -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\doctor-contextdb-shell.ps1
    . $PROFILE
    ```

## 4) 启用当前项目

=== "macOS / Linux"

    ```bash
    touch .contextdb-enable
    ```

=== "Windows (PowerShell)"

    ```powershell
    New-Item -ItemType File -Path .contextdb-enable -Force
    ```

## 5) 开始使用

```bash
cd /path/to/your/project
codex
# 或
claude
# 或
gemini
```

## 6) 验证数据已生成

=== "macOS / Linux"

    ```bash
    ls memory/context-db
    ```

=== "Windows (PowerShell)"

    ```powershell
    Get-ChildItem memory/context-db
    ```

你应该能看到 `sessions/`、`index/`、`exports/`。

## 7) 更新 / 卸载包装

=== "macOS / Linux"

    ```bash
    scripts/update-contextdb-shell.sh --mode opt-in
    scripts/uninstall-contextdb-shell.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-contextdb-shell.ps1 -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-contextdb-shell.ps1
    ```

## 8) 可选：全局安装本项目 Skills

仅当你希望在其他项目也能直接使用本仓库 skills 时再执行。
`--client all` 会同时安装到 `codex`、`claude`、`gemini`、`opencode`。

=== "macOS / Linux"

    ```bash
    scripts/install-contextdb-skills.sh --client all
    scripts/doctor-contextdb-skills.sh --client all
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-skills.ps1 -Client all
    powershell -ExecutionPolicy Bypass -File .\scripts\doctor-contextdb-skills.ps1 -Client all
    ```

Skills 生命周期：

=== "macOS / Linux"

    ```bash
    scripts/update-contextdb-skills.sh --client all
    scripts/uninstall-contextdb-skills.sh --client all
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-contextdb-skills.ps1 -Client all
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-contextdb-skills.ps1 -Client all
    ```

## 常见问答

### 这会替代原生 CLI 吗？

不会。你仍然运行原命令，包装层只负责注入上下文。

### 如何避免跨项目上下文串扰？

设置 `CTXDB_WRAP_MODE=opt-in`，并且只在需要的项目根目录创建 `.contextdb-enable`。

### 安装包装器后会自动安装 skills 吗？

不会。包装器与 skills 是两层能力，默认分离。需要全局 skills 时执行第 8 步。

### 为什么会出现 `CODEX_HOME points to ".codex"`？

说明 `CODEX_HOME` 被设置成了相对路径。改为绝对路径即可：

```bash
export CODEX_HOME="$HOME/.codex"
mkdir -p "$CODEX_HOME"
```

### 浏览器工具失效时先执行什么？

先执行 `doctor-browser-mcp` 诊断脚本，再决定是否重装。
