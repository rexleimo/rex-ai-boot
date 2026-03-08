---
title: トラブルシューティング
description: よくある問題と対処。
---

# トラブルシューティング

## Browser MCP ツールが使えない

まず実行 (macOS / Linux):

```bash
scripts/doctor-browser-mcp.sh
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-browser-mcp.ps1
```

不足がある場合はインストーラーを実行:

```bash
scripts/install-browser-mcp.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\install-browser-mcp.ps1
```

## `EXTRA_ARGS[@]: unbound variable`

古い `ctx-agent.sh` の既知問題です。`main` を最新化してください。

最新版では `ctx-agent-core.mjs` に実行ロジックを統合し、sh/mjs の実装差分を解消しています。

## `search` が空になる

`memory/context-db/index/context.db` が欠損/古い場合:

1. `cd mcp-server && npm run contextdb -- index:rebuild`
2. `search` / `timeline` / `event:get` を再実行

## ラップされない

- ContextDB を有効化したいワークスペース/ディレクトリ内か確認（非 git ディレクトリでも可）
- `~/.zshrc` で wrapper が読み込まれているか確認
- `CTXDB_WRAP_MODE` と `.contextdb-enable` を確認

まず wrapper 診断を実行:

```bash
scripts/doctor-contextdb-shell.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-contextdb-shell.ps1
```

## `CODEX_HOME points to ".codex"` エラー

原因: `CODEX_HOME` が相対パスです。

修正:

```bash
export CODEX_HOME="$HOME/.codex"
mkdir -p "$CODEX_HOME"
```

最新版 wrapper は実行時に相対 `CODEX_HOME` を自動正規化します。

## このリポジトリの skills が他プロジェクトで見えない

wrapper と skills は分離です。グローバル skills を明示的にインストールしてください:
`--client all` は `codex` / `claude` / `gemini` / `opencode` を対象にします。

```bash
scripts/install-contextdb-skills.sh --client all
scripts/doctor-contextdb-skills.sh --client all
```

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\install-contextdb-skills.ps1 -Client all
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-contextdb-skills.ps1 -Client all
```
