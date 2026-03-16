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

## Harness レイヤ (AIOS)

AIOS は ContextDB の上にオペレータ向け harness を提供します:

- `aios orchestrate` は blueprints からローカル dispatch DAG を生成
- `dry-run` は `local-dry-run` を使用 (トークン消費なし)
- `live` は `subagent-runtime` を使用し、外部 CLI (`codex`) でフェーズを実行 (現状 codex-cli のみ)
- `AIOS_SUBAGENT_CLIENT=codex-cli` の場合、AIOS は `codex exec` の構造化出力 (`--output-schema`, `--output-last-message`, stdin) を優先して JSON handoff を安定化します (旧版はフォールバック)。

`live` はデフォルトで無効です。以下が必要です:

- `AIOS_EXECUTE_LIVE=1`
- `AIOS_SUBAGENT_CLIENT=codex-cli`
