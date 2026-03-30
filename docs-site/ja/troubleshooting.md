---
title: トラブルシューティング
description: よくある問題と対処。
---

# トラブルシューティング

## クイックアンサー（AI 検索）

ほとんどの失敗は環境のセットアップの問題です（MCP ランタイム缺失、wrapper 未ロード、wrap モード不一致）。まず doctor スクリプトを実行し、wrapper スコープを確認してください。

## Node 切り替え後 `better-sqlite3` / ContextDB が失敗する

RexCLI は **Node 22 LTS** を対象としています。シェルがまだ Node 25 を実行している、または native 依存関係が別の Node ABI 用にビルドされている場合、ContextDB 関連コマンドが失敗する可能性があります。

クイック修復:

```bash
node -v
source ~/.nvm/nvm.sh && nvm use 22
cd mcp-server && npm rebuild better-sqlite3
```

再試行:

```bash
npm run test:scripts
```

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

## `contextdb context:pack failed`

ContextDB の `context:pack` が失敗した場合、`ctx-agent` は **警告して続行** します (コンテキスト未注入で CLI を起動)。

パック失敗を致命的にする場合:

```bash
export CTXDB_PACK_STRICT=1
```

シェルラッパー (`codex`/`claude`/`gemini`) は対話セッションの破損を避けるため、`CTXDB_PACK_STRICT=1` を設定してもデフォルトは fail-open です。対話ラップも厳格化する場合:

```bash
export CTXDB_PACK_STRICT_INTERACTIVE=1
```

頻発する場合は、品質ゲート (ContextDB 回帰チェックを含む) を実行してください:

```bash
aios quality-gate pre-pr --profile strict
```

## `/new` (Codex) / `/clear` (Claude/Gemini) 後にコンテキストが消える

`/new` と `/clear` は **CLI 内の会話状態** をリセットします。ContextDB はディスク上に残りますが、ラッパーが注入するのは **CLI 起動時のみ** です。

対処:

1. 推奨: CLI を終了して、シェルから `codex` / `claude` / `gemini` を再実行。
2. 同一プロセスで続けたい場合: 新しい会話の最初に次のファイルを読ませる:
   - `@memory/context-db/exports/latest-codex-cli-context.md`
   - `@memory/context-db/exports/latest-claude-code-context.md`
   - `@memory/context-db/exports/latest-gemini-cli-context.md`

`@file` 参照が使えないクライアントでは、ファイル内容を最初のプロンプトとして貼り付けてください。

## `aios orchestrate --execute live` がブロック/失敗する

live 実行は opt-in です:

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli  # 必須（live は現状 codex-cli のみ）
```

`codex` が `PATH` 上に存在し、認証済みであることを確認してください (例: `codex --version`)。

Windows 確認 (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-contextdb-shell.ps1
codex --version
codex
```

期待値: `stdout is not a terminal` のような TTY エラーが出ず、対話 `codex` がターミナルに正しく接続されること。

Tip (codex-cli): Codex CLI v0.114+ は `codex exec` の構造化出力 (`--output-schema`, `--output-last-message`, stdin) をサポートします。AIOS は利用可能なら自動で使用し、JSON handoff の安定性を上げます。

Tip: まず DAG を検証したい場合は `--execute dry-run`、または `AIOS_SUBAGENT_SIMULATE=1` を使ってライブランタイムをローカル模擬できます。

よくある失敗パターン:

- `type: upstream_error` / `server_error`: 上流の不安定。時間を置いて再実行（AIOS は数回自動リトライします）。
- `Timed out after 600000 ms`: `AIOS_SUBAGENT_TIMEOUT_MS` を増やす（例: `900000`）、または `AIOS_SUBAGENT_CONTEXT_LIMIT` / `AIOS_SUBAGENT_CONTEXT_TOKEN_BUDGET` でコンテキストを縮小。
- `invalid_json_schema`（`param: text.format.schema`）: 構造化出力スキーマがバックエンドに拒否された。最新 `main` に更新して再実行。AIOS は検出時に `--output-schema` なしでも再試行します。

最小の structured-output スモークチェック（macOS/Linux）:

```bash
printf '%s' 'Return a JSON object matching the schema.' | codex exec --output-schema memory/specs/agent-handoff.schema.json -
```

## コマンドがラップされていない

チェック項目：

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

## ラップ有効だが無効化したい

シェル設定で以下を設定:

```zsh
export CTXDB_WRAP_MODE=off
```

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

## RexCLI ソースレポ内で `--scope project` が失敗する

これは意図的な動作です。

canonical skill source tree の移行後：

- `skill-sources/` が authoring tree
- repo-local の `.codex/skills` / `.claude/skills` / `.agents/skills` は sync 管理の生成ディレクトリ
- ソースレポ自身への `--scope project` インストールは意図的にブロック済み

代わりに以下を実行してください：

```bash
node scripts/sync-skills.mjs
node scripts/check-skills-sync.mjs
```

他のプロジェクトに skills をインストールしたい場合は、そのワークスペースに切り替えてから `aios ... --scope project` を実行してください。

## GitHub Pages `configure-pages` が見つからない

これは通常 Pages ソースが完全に有効化されていないことを意味します。

GitHub 設定で修正：

1. `Settings -> Pages -> Source: GitHub Actions`
2. `docs-pages` ワークフローを再実行

## FAQ

### ブラウザツールが使えないとき最初は何を実行すべきですか？

再インストール前に `scripts/doctor-browser-mcp.sh`（または PowerShell 版）を実行してください。

### `codex` を入力してもコンテキストが注入されないのはなぜですか？

通常、wrapper が読み込まれていない、`CTXDB_WRAP_MODE` が現在のワークスペースをカバーしていない、またはコマンドが透伝管理サブコマンドであるのが原因です。

## Skills が 잘못なディレクトリに保存された

canonical skill source tree は以下に置かれるようになりました：

- `<repo>/skill-sources`

生成された repo-local 検出可能出力は以下の場所にあります：

- `<repo>/.codex/skills`
- `<repo>/.claude/skills`

`SKILL.md` を `.baoyu-skills/` のような並行ディレクトリに保存すると、Codex / Claude はそれをスキルとして検出できません。

- `.baoyu-skills/` は `EXTEND.md` のような拡張設定のみに使用
- 本来のスキルソースファイルは `skill-sources/<name>/SKILL.md` に移動
- `node scripts/sync-skills.mjs` で各クライアントの互換ディレクトリを再生成
- `scripts/doctor-contextdb-skills.sh --client all` で未対応のスキルルートディレクトリを検出
