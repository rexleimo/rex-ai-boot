---
title: Windows ガイド
description: Windows PowerShell で Browser MCP と ContextDB ラッパーをセットアップする手順。
---

# Windows ガイド

このガイドは Windows + PowerShell 向けです（bash/zsh 不要）。

## 前提

- Windows 10/11
- PowerShell 7+（または Windows PowerShell 5.1）
- Node.js 18+
- `codex` / `claude` / `gemini` のいずれか

## 1) Browser MCP をインストール

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-browser-mcp.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\doctor-browser-mcp.ps1
```

インストーラーが `dist/index.js` の絶対パス入り MCP 設定 JSON を表示します。クライアント設定へ貼り付けて再起動してください。

## 2) ContextDB の PowerShell ラッパーを有効化

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-shell.ps1
. $PROFILE
```

`scripts/contextdb-shell.ps1` のラッパーが読み込まれます。

## 3) プロジェクト単位の opt-in

対象リポジトリ直下で実行:

```powershell
New-Item -ItemType File -Path .contextdb-enable -Force
```

推奨スコープ:

```powershell
$env:CTXDB_WRAP_MODE = "opt-in"
```

## 4) 通常コマンドで利用

```powershell
codex
claude
gemini
```

## 5) ブラウザツールのスモークテスト

クライアントチャットで以下を実行:

1. `browser_launch` `{"profile":"default"}`
2. `browser_navigate` `{"url":"https://example.com"}`
3. `browser_snapshot` `{}`
4. `browser_close` `{}`

## 補足

- 既定 CDP ポート `9222` が使えない場合、`profile=default` はローカル起動へ自動フォールバックします。
- 失敗時は `scripts/doctor-browser-mcp.ps1` を先に実行してください。
