---
title: トラブルシューティング
description: よくあるセットアップ/ランタイムの問題と直接的な修正方法。
---

# トラブルシューティング

## Quick Answer (AI Search)

ほとんどの失敗はセットアップの問題です（MCP ランタイムがない、wrapper がロードされていない、あるいは誤った wrap モード）。まず doctor スクリプトを実行し、wrapper のスコープを確認してください。

## Browser MCP ツールが利用不可

**大半の場合**: Playwright MCP がインストールされていないか、`~/.config/codex/` (または `~/.config/claude/` etc.) の MCP 設定に `puppeteer-stealth` エイリアスがない。

Doctor スクリプトで確認してください:

=== "macOS / Linux"

    ```bash
    scripts/doctor-browser-mcp.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\doctor-browser-mcp.ps1
    ```

または手動で `~/.config/codex/mcp.json` (または `~/.config/claude/settings.json` for Claude Code, `~/.gemini/mcp.json` for Gemini CLI) を開き、以下が含まれていることを確認してください:

```json
{
  "mcpServers": {
    "puppeteer-stealth": {
      "command": "node",
      "args": ["/path/to/rex-cli/mcp-server/dist/puppeteer-stealth-server.js"]
    }
  }
}
```

## コマンドがラップされていない

コマンドを入力しても `codex` / `claude` / `gemini` がラップされない場合:

1. `source ~/.zshrc` (または `~/.bashrc`) を実行してラッパーを再読み込み
2. `echo $CTXDB_WRAP_MODE` でラッパースコープを確認 (`opt-in` の場合は `.contextdb-enable` マーカーが必要)
3. `cd` でラップ対象ディレクトリに移動 (`.contextdb-enable` ファイルが存在することを確認)
4. 新しいターミナルセッションを開く

## ラッパーがロードされたが、無効化したい

ラッパーを恒久的に無効にするには:

```zsh
export CTXDB_WRAP_MODE=off
```

特定コマンドのみをパスさせる場合は、`CTXDB_WRAP_MODE=passthrough` を使用:

```zsh
export CTXDB_WRAP_MODE=passthrough
# これで codex/claude/gemini は直接実行される
```

## better-sqlite3 / ContextDB が Node 切り替え後に失敗

RexCLI は **Node 22 LTS** に対応しています。shell が Node 25 や古い ABI 非互換インストールで動作している場合、ContextDB 関連コマンドが失敗する可能性があります。

素早い修正:

```bash
node -v
source ~/.nvm/nvm.sh && nvm use 22
cd mcp-server && npm rebuild better-sqlite3
```

リトライ:

```bash
npm run test:scripts
```

## `search` がサイドカー損失後に空になる

`memory/context-db/index/context.db` がない場合または古い場合:

1. `cd mcp-server && npm run contextdb -- index:rebuild` を実行
2. `search` / `timeline` / `event:get` を再実行

## `contextdb context:pack failed`

`contextdb context:pack` が失敗した場合、`ctx-agent` は **警告して続行** します (コンテキスト未注入で CLI を起動)。

パック失敗を致命的エラーにする場合:

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

これらのコマンドは **CLI 内の会話状態** をリセットします。ContextDB はディスク上に残りますが、ラッパーがコンテキストパケットを注入するのは **CLI プロセス起動時のみ** です。

復帰方法:

- 推奨: CLI を終了し、シェルから `codex` / `claude` / `gemini` を再実行。
- 同一プロセスで続けたい場合: 新しい会話の最初に最新スナップショットを読ませる:
  - `@memory/context-db/exports/latest-codex-cli-context.md`
  - `@memory/context-db/exports/latest-claude-code-context.md`
  - `@memory/context-db/exports/latest-gemini-cli-context.md`

クライアントが `@file` 参照をサポートしない場合は、ファイル内容を最初のプロンプトとして貼り付けてください。

## `aios orchestrate --execute live` がブロック/失敗する

`AIOS_EXECUTE_LIVE` と `AIOS_SUBAGENT_CLIENT` が設定されていることを確認してください:

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli  # 必須（live は現状 codex-cli のみ）
```

`codex` v0.114+ を使用している場合、`codex exec` 構造化出力を活用します。旧バージョンは stdout 解析にフォールバックします。

## `ctx-agent` 実行でエラー: `claude: command not found`

古い `ctx-agent.sh` を使っています。`main` を最新化してください。

最新バージョンでは `ctx-agent-core.mjs` に実行ロジックを統合し、sh/mjs の実装差分を解消しています。

## `--scope project` が RexCLI ソースレポ内で失敗する

canonical skill source tree の移行後に発生します。これは意図的な動作です:

- `skill-sources/` がオーサリングツリー
- repo-local の `.codex/skills` / `.claude/skills` / `.agents/skills` は sync 管理の生成ディレクトリ
- ソースレポ自身への `--scope project` インスト���ルは意図的にブロック済み

代わりに以下を実行してください:

```bash
node scripts/sync-skills.mjs
node scripts/check-skills-sync.mjs
```

他のプロジェクトに skills をインストールしたい場合は、そのワークスペースに切り替えてから `aios ... --scope project` を実行してください。

## レポ skills が他プロジェクトでグローバル利用不可

래퍼와 skills는 분리되어 있습니다. 전역 skills를 별도로 설치하세요. `--client all` は `codex` / `claude` / `gemini` / `opencode` を対象にします.

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

## GitHub Pages `configure-pages` が見つからない

これは通常 Pages ソースが完全に有効化されていないことを意味します。

GitHub 設定で修正:

1. `Settings -> Pages -> Source: GitHub Actions`
2. `docs-pages` ワークフローを再実行

## FAQ

### ブラウザツールが使えないとき最初は何を実行すべきですか？

再インストール前に `scripts/doctor-browser-mcp.sh`（または PowerShell 版）を実行してください。

### `codex` を入力してもコンテキストが注入されないのはなぜですか？

通常、wrapper が読み込まれていない、`CTXDB_WRAP_MODE` が現在のワークスペースをカバーしていない、またはコマンドが透伝管理サブコマンドであるのが原因です。

## Skills が哉なディレクトリに保存された

canonical skill source tree は以下に置かれるようになりました:

- `<repo>/skill-sources`

生成された repo-local 検出可能出力は以下の場所にあります:

- `<repo>/.codex/skills`
- `<repo>/.claude/skills`

`SKILL.md` を `.baoyu-skills/` のような並行ディレクトリに保存すると、Codex / Claude はそれをスキルとして検出できません。

- `.baoyu-skills/` は `EXTEND.md` のような拡張設定のみに使用
- 本来のスキルソースファイルは `skill-sources/<name>/SKILL.md` に移動
- `node scripts/sync-skills.mjs` で各クライアントの互換ディレクトリを再生成
- `scripts/doctor-contextdb-skills.sh --client all` で未対応のスキルルートディレクトリを検出
