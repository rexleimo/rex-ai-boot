---
title: ContextDB
description: 5 ステップ、SQLite サイドカー、主要コマンド。
---

# ContextDB

## 実行 5 ステップ

1. `init`
2. `session:new / session:latest`
3. `event:add`
4. `checkpoint`
5. `context:pack`

## 例

```bash
cd mcp-server
npm run contextdb -- init
npm run contextdb -- context:pack --session <id> --out memory/context-db/exports/<id>-context.md
npm run contextdb -- index:rebuild
```

## コンテキストパック制御（P0）

`context:pack` はトークン予算とイベントフィルタに対応します。

```bash
npm run contextdb -- context:pack \
  --session <id> \
  --limit 60 \
  --token-budget 1200 \
  --kinds prompt,response,error \
  --refs core.ts,cli.ts
```

- `--token-budget`: L2イベントを推定トークン数で制限。
- `--kinds` / `--refs`: 一致イベントのみ含める。
- 重複イベントはデフォルトで除外。

## 検索コマンド（P1）

```bash
npm run contextdb -- search --query "auth race" --project demo --kinds response --refs auth.ts
npm run contextdb -- timeline --session <id> --limit 30
npm run contextdb -- event:get --id <sessionId>#<seq>
npm run contextdb -- index:rebuild
```

- `index:rebuild`: `sessions/*` から SQLite サイドカーを再構築。

## セマンティック検索（P2, 任意）

利用可能な場合のみ有効化され、未設定時は lexical 検索へ自動フォールバックします。

```bash
export CONTEXTDB_SEMANTIC=1
export CONTEXTDB_SEMANTIC_PROVIDER=token
npm run contextdb -- search --query "issue auth" --project demo --semantic
```

- `CONTEXTDB_SEMANTIC_PROVIDER=token`: ローカル token-overlap で再ランク。
- 未知/無効なプロバイダは lexical 検索へ自動フォールバックします。

## 保存レイアウト

```text
memory/context-db/
  sessions/<session_id>/*        # source of truth
  index/context.db               # SQLite sidecar (rebuildable)
```
