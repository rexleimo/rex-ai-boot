---
title: ContextDB
description: 5ステップ、SQLite サイドカー、主要コマンド。
---

# ContextDB ランタイム

## クイックアンサー（AI 検索）

ContextDB はマルチ CLI agent 用のファイルシステムセッション層です。プロジェクトごとにイベント、チェックポイント、コンテキストパケットを保存し、高速な検索のために SQLite サイドカーインデックスを使用します。

## 標準 5 ステップ

ランタイムで ContextDB は以下のシーケンスを実行できます:

1. `init` - DB フォルダとサイドカーインデックスの存在を確認。
2. `session:new` または `session:latest` - `agent + project` ごとにセッションを解決。
3. `event:add` - user/model/tool イベントを保存。
4. `checkpoint` - ステージサマリー、ステータス、next アクションを記録。
5. `context:pack` - 次の CLI 呼び出し用の markdown パケットをエクスポート。

## インタラクティブ vs ワンショット

- インタラクティブモードは通常 CLI 起動前にステップ `1, 2, 5` を実行。
- ワンショットモードは `1..5` を単一コマンドで実行。

## Fail-Open Packing

`contextdb context:pack` が失敗した場合、`ctx-agent` は **警告して続行** します（コンテキスト未注入で CLI を起動）。

パック失敗を致命的エラーにする場合:

```bash
export CTXDB_PACK_STRICT=1
```

シェルラッパー（`codex`/`claude`/`gemini`）はデフォルトで fail-open であり、`CTXDB_PACK_STRICT=1` を設定してもインタラクティブセッションを直接壊すことはありません。ラップ層も厳密に執行する場合:

```bash
export CTXDB_PACK_STRICT_INTERACTIVE=1
```

## 手動コマンド例

```bash
cd mcp-server
npm run contextdb -- init
npm run contextdb -- session:new --agent codex-cli --project demo --goal "implement feature"
npm run contextdb -- event:add --session <id> --role user --kind prompt --text "start"
npm run contextdb -- checkpoint --session <id> --summary "phase done" --status running --next "write tests|implement"
npm run contextdb -- context:pack --session <id> --out memory/context-db/exports/<id>-context.md
npm run contextdb -- index:sync --stats --jsonl-out memory/context-db/exports/index-sync-stats.jsonl
npm run contextdb -- index:rebuild
```

## パック制御（P0）

`context:pack` はトークン予算とイベントフィルタ，支持します:

```bash
npm run contextdb -- context:pack \
  --session <id> \
  --limit 60 \
  --token-budget 1200 \
  --kinds prompt,response,error \
  --refs core.ts,cli.ts
```

- `--token-budget`: 推定トークン数で L2 イベント量の上限を設定。
- `--kinds` / `--refs`: 一致イベントのみ含める。
- デフォルトで重複イベントの除外が有効。

## 検索コマンド（P1）

ContextDB は SQLite サイドカーインデックスによる検索を提供します:

```bash
npm run contextdb -- search --query "auth race" --project demo --kinds response --refs auth.ts
npm run contextdb -- timeline --session <id> --limit 30
npm run contextdb -- event:get --id <sessionId>#<seq>
npm run contextdb -- index:sync --stats
npm run contextdb -- index:rebuild
```

- `search`: インデックス付きイベントをクエリ。
- `timeline`: イベント/チェックポイントのマージ済みフィード。
- `event:get`: 安定 ID で特定のイベントを取得。
- `index:sync`: セッション真源ファイルからサイドカーへ増分同期。
- `index:rebuild`: セッションファイルから SQLite サイドカーを再構築。
- デフォルトランキングパス: SQLite FTS5 `MATCH` + `bm25(...)`（`kind/text/refs` 対象）。
- 互換性フォールバック: FTS が利用不可の場合、`search` は自動的にレキシカルマッチングにフォールバック。

## 増分同期 + refs 正規化（P1.5）

ContextDB は SQLite に正規化済みの `event_refs` テーブルを保持します。  
`--refs` フィルタはこのテーブルで正規化 refs の完全一致を使うため、部分文字列一致による誤検出を減らせます。

```bash
npm run contextdb -- index:sync --stats
npm run contextdb -- index:sync --force --stats
npm run contextdb -- index:sync --stats --jsonl-out memory/context-db/exports/index-sync-stats.jsonl
```

- `--stats`: sessions/events/checkpoints の `scanned/upserted`、所要時間、throttle skip、force フラグを表示。
- `--jsonl-out`: 実行ごとに 1 行の JSON レコード（タイムスタンプ付き）を追記し、傾向分析に利用可能。
- `index:rebuild` は sidecar 欠損/破損時、またはスキーマ全面再構築が必要な場合のみ使用。

## refs クエリ性能ベンチマーク

refs クエリの遅延を監視し、回帰を gate するには次のスクリプトを使用します。

```bash
cd mcp-server
npm run bench:contextdb:refs -- --events 2000 --refs-pool 200 --queries 300 --warmup 30 --json-out test-results/contextdb-refs-bench.local.json
npm run bench:contextdb:refs:ci
npm run bench:contextdb:refs:gate
```

- `bench:contextdb:refs`: ローカルでデータセットを調整可能なベンチマーク。
- `bench:contextdb:refs:ci`: CI 用の標準データセット。
- `bench:contextdb:refs:gate`: 遅延/ヒット率しきい値を満たさない場合に失敗。

## 任意セマンティック検索（P2）

セマンティックモードは任意機能であり、利用不可時は自動的にレキシカル検索にフォールバックします。

```bash
export CONTEXTDB_SEMANTIC=1
export CONTEXTDB_SEMANTIC_PROVIDER=token
npm run contextdb -- search --query "issue auth" --project demo --semantic
```

- `--semantic`: セマンティックリランキングを要求。
- `CONTEXTDB_SEMANTIC_PROVIDER=token`: ローカル token overlap リランキング。网络呼び出しなし。
- 不明/無効な provider は自動的にレキシカルクエリパスにフォールバック。
- セマンティックリランキングは「現在のクエリのレキシカル候補セット」に対して実行されるため、最近イベントのみをサンプリングするよりも、古い完全一致がデフォルトでドロップされることを防ぎます。

## 保存レイアウト

ContextDB は真源データをセッションファイルに保存し、スピードのためにサイドカーインデックスを使用します:

```text
memory/context-db/
  sessions/<session_id>/*        # 真源データ
  index/context.db               # SQLite サイドカー（再構築可能）
  index/sessions.jsonl           # 互換性インデックス
  index/events.jsonl             # 互換性インデックス
  index/checkpoints.jsonl        # 互換性インデックス
```

## セッション ID フォーマット

セッション ID は以下の形式を使用します:

`<agent>-<YYYYMMDDTHHMMSS>-<random>`

これにより時系列が明確になり、衝突を避けます。

## FAQ

### ContextDB はクラウドデータベースですか？

いいえ。デフォルトでワークスペース下のローカルファイルシステムに保存します。

### `/new` (Codex) や `/clear` (Claude/Gemini) の後にコンテキストが消えるのはなぜですか？

これらのコマンドは **CLI 内の会話状態** をリセットします。ContextDB のデータはディスクに残りますが、ラッパーがコンテキストパケットを注入するのは **CLI プロセス起動時のみ** です。

復帰方法:

- 推奨: CLI を終了し、シェルから `codex` / `claude` / `gemini` を再実行（ラップが再 `context:pack` して注入）。
- 同一プロセスで続けたい場合: 新規会話の最初のメッセージで最新スナップショットを読ませる:
  - `@memory/context-db/exports/latest-codex-cli-context.md`
  - `@memory/context-db/exports/latest-claude-code-context.md`
  - `@memory/context-db/exports/latest-gemini-cli-context.md`

クライアントが `@file` 参照をサポートしない場合は、ファイル内容を最初のプロンプトとして貼り付けてください。

### Codex、Claude、Gemini はコンテキストを共有しますか？

はい。同じラップワークスペースで実行される場合（git ルートが利用可能なら同じ git ルート、なければ同じカレントディレクトリ）、同じ `memory/context-db/` を使用します。

### CLI 間のタスク引継ぎはどうしますか？

同一プロジェクトセッションを維持し、次の CLI 実行前に `context:pack` を実行してください。
