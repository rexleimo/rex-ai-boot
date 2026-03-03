---
title: クイックスタート
description: セットアップと初回実行手順。
---

# クイックスタート

## 前提

- macOS/Linux + `zsh`
- `node` / `npm`
- `codex` / `claude` / `gemini` のいずれか

## 1) Browser MCP をワンコマンドで導入

```bash
scripts/install-browser-mcp.sh
scripts/doctor-browser-mcp.sh
```

## 2) ContextDB CLI をビルド

```bash
cd mcp-server
npm install
npm run build
```

## 3) `~/.zshrc` を設定

```zsh
# >>> contextdb-shell >>>
export ROOTPATH="${ROOTPATH:-$HOME/cool.cnb/rex-ai-boot}"
export CTXDB_WRAP_MODE=opt-in
if [[ -f "$ROOTPATH/scripts/contextdb-shell.zsh" ]]; then
  source "$ROOTPATH/scripts/contextdb-shell.zsh"
fi
# <<< contextdb-shell <<<
```

```bash
source ~/.zshrc
```

## 4) プロジェクトで有効化

```bash
touch .contextdb-enable
```
