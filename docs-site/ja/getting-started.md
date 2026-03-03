---
title: クイックスタート
description: macOS・Linux・Windows を 1 つの手順に統合し、OS タブで切り替えるガイド。
---

# クイックスタート

このページは macOS・Linux・Windows のセットアップを 1 つの流れに統合しています。コマンド差分は OS タブで切り替えてください。

## 前提

- Node.js 18+ と `npm`
- `codex` / `claude` / `gemini` のいずれか
- プロジェクト単位 ContextDB を有効化する対象 git リポジトリ

## 1) Browser MCP をインストール

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

## 2) ContextDB CLI をビルド

```bash
cd mcp-server
npm install
npm run build
```

## 3) コマンドラッパーを有効化

=== "macOS / Linux (zsh)"

    `~/.zshrc` に以下を追加:

    ```zsh
    # >>> contextdb-shell >>>
    export ROOTPATH="${ROOTPATH:-$HOME/cool.cnb/rex-ai-boot}"
    export CTXDB_WRAP_MODE=opt-in
    if [[ -f "$ROOTPATH/scripts/contextdb-shell.zsh" ]]; then
      source "$ROOTPATH/scripts/contextdb-shell.zsh"
    fi
    # <<< contextdb-shell <<<
    ```

    反映:

    ```bash
    source ~/.zshrc
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-shell.ps1
    . $PROFILE
    $env:CTXDB_WRAP_MODE = "opt-in"
    ```

## 4) 対象プロジェクトで有効化

=== "macOS / Linux"

    ```bash
    touch .contextdb-enable
    ```

=== "Windows (PowerShell)"

    ```powershell
    New-Item -ItemType File -Path .contextdb-enable -Force
    ```

## 5) 利用開始

```bash
cd /path/to/your/project
codex
# または
claude
# または
gemini
```

## 6) 生成データを確認

=== "macOS / Linux"

    ```bash
    ls memory/context-db
    ```

=== "Windows (PowerShell)"

    ```powershell
    Get-ChildItem memory/context-db
    ```

`sessions/`、`index/`、`exports/` が表示されれば成功です。
