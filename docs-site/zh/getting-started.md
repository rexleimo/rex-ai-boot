---
title: 快速开始
description: 一套流程覆盖 macOS、Linux、Windows，通过标签切换不同命令。
---

# 快速开始

本页已合并 macOS、Linux、Windows 的安装流程。命令不同时，按系统标签切换执行。

## 前置条件

- Node.js 18+ 与 `npm`
- 至少安装一个 CLI：`codex`、`claude`、`gemini`
- 一个用于启用项目级 ContextDB 的 git 仓库

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

## 3) 启用命令包装

=== "macOS / Linux (zsh)"

    将以下内容加入 `~/.zshrc`：

    ```zsh
    # >>> contextdb-shell >>>
    export ROOTPATH="${ROOTPATH:-$HOME/cool.cnb/rex-ai-boot}"
    export CTXDB_WRAP_MODE=opt-in
    if [[ -f "$ROOTPATH/scripts/contextdb-shell.zsh" ]]; then
      source "$ROOTPATH/scripts/contextdb-shell.zsh"
    fi
    # <<< contextdb-shell <<<
    ```

    重新加载：

    ```bash
    source ~/.zshrc
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-shell.ps1
    . $PROFILE
    $env:CTXDB_WRAP_MODE = "opt-in"
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
