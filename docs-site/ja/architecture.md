---
title: アーキテクチャ
description: wrapper / runner / ContextDB の構成。
---

# アーキテクチャ

- `scripts/contextdb-shell.zsh`: CLI ラッパー
- `scripts/contextdb-shell-bridge.mjs`: wrap / passthrough 判定ブリッジ
- `scripts/ctx-agent.mjs`: 実行ランナー
- `mcp-server/src/contextdb/*`: ContextDB 実装

```text
ユーザーコマンド -> zsh wrapper -> contextdb-shell-bridge.mjs -> ctx-agent.mjs -> contextdb CLI -> ネイティブ CLI
```
