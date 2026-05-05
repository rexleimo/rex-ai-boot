---
title: ルーティングと並列プロファイル
description: RexCLI のルーティングと並列設定を最小変数で選ぶためのクイックガイド。
---

# ルーティングと並列プロファイル

環境変数をたくさん覚えたくない場合は、このページのプリセットをそのまま使ってください。

## 主要変数

- `CTXDB_INTERACTIVE_AUTO_ROUTE`: interactive 自動ルーティング（`single/subagent/team/harness`）の有効化
- `CTXDB_CODEX_DISABLE_MCP`: wrapper 経由 `codex` の MCP 起動をスキップするか
- `CTXDB_HARNESS_PROVIDER`: 注入される `harness` route の provider（`codex|claude|gemini|opencode`、既定は現在の CLI）
- `CTXDB_HARNESS_MAX_ITERATIONS`: 注入される `harness` route の反復予算（既定 `8`）
- `CTXDB_TEAM_WORKERS`: `aios team ...` の並列 worker 数
- `AIOS_SUBAGENT_CONCURRENCY`: `aios orchestrate --execute live` の並列実行数

## 推奨プリセット

### 1) バランス（推奨）

```bash
export CTXDB_INTERACTIVE_AUTO_ROUTE=1
export CTXDB_CODEX_DISABLE_MCP=1
export CTXDB_HARNESS_MAX_ITERATIONS=8
export CTXDB_TEAM_WORKERS=3
export AIOS_SUBAGENT_CONCURRENCY=3
```

### 2) 高スループット

```bash
export CTXDB_INTERACTIVE_AUTO_ROUTE=1
export CTXDB_CODEX_DISABLE_MCP=1
export CTXDB_HARNESS_MAX_ITERATIONS=12
export CTXDB_TEAM_WORKERS=4
export AIOS_SUBAGENT_CONCURRENCY=4
```

### 3) デバッグ安定モード

```bash
export CTXDB_INTERACTIVE_AUTO_ROUTE=0
export CTXDB_CODEX_DISABLE_MCP=1
export CTXDB_HARNESS_MAX_ITERATIONS=4
export CTXDB_TEAM_WORKERS=1
export AIOS_SUBAGENT_CONCURRENCY=1
```

## 注意

- 変更は新しいセッション起動時に反映されます（CLI 再起動が必要）。
- 並列数は `CTXDB_TEAM_WORKERS` と `AIOS_SUBAGENT_CONCURRENCY` で決まります。
- Harness の自己トリガーは単一 provider ループであり、並列 team ではありません。注入される harness provider を現在の CLI と変えたい時だけ `CTXDB_HARNESS_PROVIDER` を設定してください。
- MCP ツールが必要な実行だけ一時的に:

```bash
CTXDB_CODEX_DISABLE_MCP=0 codex
```
