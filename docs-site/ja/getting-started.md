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

## 0) ワンコマンドセットアップ（推奨）

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

コンポーネント選択例:

=== "macOS / Linux"

    ```bash
    # shell ラッパー + skills のみ
    scripts/setup-all.sh --components shell,skills --mode opt-in

    # browser MCP のみ
    scripts/setup-all.sh --components browser
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components shell,skills -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components browser
    ```

ワンコマンド更新 / アンインストール:

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

コンポーネント別の手順を使いたい場合は、以下の 1-8 を参照してください。

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

## 3) コマンドラッパーをインストール（推奨）

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

## 7) 更新 / アンインストール

=== "macOS / Linux (zsh)"

    ```bash
    scripts/update-contextdb-shell.sh --mode opt-in
    scripts/uninstall-contextdb-shell.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-contextdb-shell.ps1 -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-contextdb-shell.ps1
    ```

## 8) 任意: このリポジトリの Skills をグローバル導入

他プロジェクトでもこのリポジトリの skills を使いたい場合のみ実行してください。
`--client all` は `codex` / `claude` / `gemini` / `opencode` を対象にします。

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

Skills ライフサイクル:

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

## FAQ

### `CODEX_HOME points to ".codex"` が出る

`CODEX_HOME` が相対パスになっています。絶対パスにしてください:

```bash
export CODEX_HOME="$HOME/.codex"
mkdir -p "$CODEX_HOME"
```

### ラッパー導入で skills も自動インストールされますか?

いいえ。ラッパーと skills は分離されています。グローバル skills が必要な場合は手順 8 を実行してください。
