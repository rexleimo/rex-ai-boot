---
title: クイックスタート
description: macOS・Linux・Windows を 1 つの手順に統合し、OS タブで切り替えるガイド。
---

# クイックスタート

このページは macOS・Linux・Windows のセットアップを 1 つの流れに統合しています。コマンド差分は OS タブで切り替えてください。

## クイックアンサー（AI 検索）

`RexCLI` は `codex`、`claude`、`gemini` をそのまま使いながら、プロジェクトスコープの ContextDB 記憶と統合 Browser MCP セットアップを追加します。

## 前提

- Node.js **22 LTS** と `npm`
- `codex` / `claude` / `gemini` のいずれか
- プロジェクト単位 ContextDB を有効化する対象のワークスペース/ディレクトリ

## 0) インストール（推奨）

このリポジトリは `~/.rexcil/rex-cli` にインストールされます。統一エントリは `aios` です:

- `aios`（引数なし）: 全画面 TUI を起動
- `aios doctor|update|privacy ...`: 既存のサブコマンド

### 方式 C: ワンライナー（GitHub Releases）

これは stable インストール経路で、公開済み GitHub Release asset が前提です。

=== "macOS / Linux"

    ```bash
    curl -fsSL https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.sh | bash
    source ~/.zshrc
    aios
    ```

=== "Windows (PowerShell)"

    ```powershell
    irm https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.ps1 | iex
    . $PROFILE
    aios
    ```

### 方式 A: git clone（開発向け）

未リリースの `main` ブランチ挙動を明示的に使いたい場合だけこちらを使ってください。これは開発用経路であり、stable release 経路ではありません。

=== "macOS / Linux"

    ```bash
    git clone https://github.com/rexleimo/rex-cli.git ~/.rexcil/rex-cli
    cd ~/.rexcil/rex-cli
    scripts/aios.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    git clone https://github.com/rexleimo/rex-cli.git $HOME\.rexcil\rex-cli
    cd $HOME\.rexcil\rex-cli
    powershell -ExecutionPolicy Bypass -File .\scripts\aios.ps1
    ```

### 方式 B: GitHub Releases からダウンロード（オフライン向け）

Releases から `rex-cli.tar.gz`（macOS/Linux）または `rex-cli.zip`（Windows）をダウンロードして `~/.rexcil/` に展開し、
`scripts/aios.sh` / `scripts/aios.ps1` を実行してください。

### TUI 起動時のウェルカムバナー

`aios` で TUI を起動すると、最初にシアン色の ASCII アートバナーが表示されます：

```
  ╔══════════════════════════════════════════╗
  ║   ██████╗ ██╗  ██╗██╗██████╗  ██████╗    ║
  ║   ██╔══██╗██║ ██╔╝██║██╔══██╗██╔════╝    ║
  ║   ██████╔╝█████╔╝ ██║██████╔╝██║         ║
  ║   ██╔══██╗██╔═██╗ ██║██╔══██╗██║         ║
  ║   ██║  ██║██║  ██╗██║██║  ██║╚██████╗    ║
  ║   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝ ╚═════╝    ║
  ║          Hello, Rex CLI!                 ║
  ╚══════════════════════════════════════════╝
```

バナーの下にリポジトリパスが表示され、TUI が準備完了したことを確認できます。

### 推奨: TUI でセットアップを完了する

インストール後は、このリリースで推奨している TUI フローを使ってください:

1. `aios` を実行
2. **Setup** を選択
3. 目的に合わせてコンポーネントを選択
   - `all`: フルセット
   - `shell,skills,superpowers`: 共有メモリ + skills を先に有効化
   - `browser`: Browser MCP のみ
4. セットアップ完了後、同じ TUI で **Doctor** を実行
5. shell wrapper を入れた場合は再読み込み
   - macOS / Linux: `source ~/.zshrc`
   - Windows PowerShell: `. $PROFILE`

コンポーネント選択例:

ヒント: ワンライナーでインストールした場合、リポジトリは `~/.rexcil/rex-cli` にあります。
このディレクトリでスクリプトを実行するか、`aios` を起動して TUI の **Setup** を選んでください。

### リポジトリ貢献者: skills は now `skill-sources/` を來源とする

このレポジトリ自体を編集している（火安装ではなく）場合：

- canonical skill source files は `skill-sources/` に置かれています
- repo-local の `.codex/skills`、`.claude/skills`、`.agents/skills`、`.gemini/skills`、`.opencode/skills` は生成された互換出力です
- 以下で再生成:

```bash
node scripts/sync-skills.mjs
node scripts/check-skills-sync.mjs
```

=== "macOS / Linux"

    ```bash
    # shell ラッパー + skills のみ
    scripts/setup-all.sh --components shell,skills --mode opt-in

    # browser MCP のみ
    scripts/setup-all.sh --components browser
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components shell,skills -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components browser
    ```

ワンコマンド更新 / アンインストール:

=== "macOS / Linux"

    ```bash
    scripts/update-all.sh --components all --mode opt-in
    scripts/uninstall-all.sh --components shell,skills
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-all.ps1 -Components all -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-all.ps1 -Components shell,skills
    ```

コンポーネント別の手順を使いたい場合は、以下の 1-8 を参照してください。

### 0.1 Privacy Guard 厳格読み取り（デフォルト有効）

シェルセットアップは今 `~/.rexcil/privacy-guard.json` で Privacy Guard 設定を初期化し、厳格なリダクションポリシーをデフォルトで有効にします。
設定ファイルや機密情報を含むファイルを読む場合は、厳格読み取りパスを使用してください：

=== "macOS / Linux"

    ```bash
    aios privacy read --file <path>
    ```

=== "Windows (PowerShell)"

    ```powershell
    aios privacy read --file <path>
    ```

オプションのローカルモデルパス（Ollama + `qwen3.5:4b`）：

=== "macOS / Linux"

    ```bash
    aios privacy ollama-on
    ```

=== "Windows (PowerShell)"

    ```powershell
    aios privacy ollama-on
    ```

## 1) Browser MCP をインストール

=== "macOS / Linux"

    ```bash
    scripts/install-browser-mcp.sh
    scripts/doctor-browser-mcp.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-browser-mcp.ps1
    powershell -ExecutionPolicy Bypass -File .\scripts\doctor-browser-mcp.ps1
    ```

## 2) ContextDB CLI をビルド

```bash
cd mcp-server
npm install
npm run build
```

## 3) コマンドラッパーをインストール（推奨）

=== "macOS / Linux (zsh)"

    ```bash
    scripts/install-contextdb-shell.sh --mode opt-in
    scripts/doctor-contextdb-shell.sh
    source ~/.zshrc
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-shell.ps1 -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\doctor-contextdb-shell.ps1
    . $PROFILE
    ```

## 4) 対象プロジェクトで有効化

=== "macOS / Linux"

    ```bash
    touch .contextdb-enable
    ```

=== "Windows (PowerShell)"

    ```powershell
    New-Item -ItemType File -Path .contextdb-enable -Force
    ```

## 5) 利用開始

```bash
cd /path/to/your/project
codex
# または
claude
# または
gemini
```

## 5.1) 任意: オペレーターツール (quality-gate + learn-eval + orchestrate)

リポジトリ健康チェック (ContextDB 回帰チェックを含む):

```bash
aios quality-gate pre-pr --profile strict
```

直近セッションのテレメトリを解析:

```bash
aios learn-eval --limit 10
```

ローカルでオーケストレーション骨格を生成 (モデル呼び出しなし):

```bash
aios orchestrate --session <session-id> --preflight auto --format json
```

CLI サブエージェント経由で live 実行 (トークン消費あり、opt-in):

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli  # 必須（live は現状 codex-cli のみ）
aios orchestrate --session <session-id> --dispatch local --execute live --format json
```

Tip (codex-cli): Codex CLI v0.114+ は `codex exec` の構造化出力 (`--output-schema`, `--output-last-message`, stdin) をサポートします。AIOS は利用可能なら自動で使用し、旧バージョンでは stdout 解析にフォールバックします。

任意の制御:

- `AIOS_SUBAGENT_CONCURRENCY` (default: `3`)
- `AIOS_SUBAGENT_TIMEOUT_MS` (default: `600000`)

### 5.1.1) ルーティング + 並列数プロファイル（推奨）

並列実行を使いつつ設定を最小化したい場合は、次をそのまま使ってください:

単独の早見ページは [ルーティングと並列プロファイル](route-concurrency-profiles.md) を参照。

```bash
export CTXDB_INTERACTIVE_AUTO_ROUTE=1
export CTXDB_CODEX_DISABLE_MCP=1
export CTXDB_TEAM_WORKERS=3
export AIOS_SUBAGENT_CONCURRENCY=3
```

各変数の役割:

- `CTXDB_INTERACTIVE_AUTO_ROUTE`: interactive wrapper が自動ルーティング（`single/subagent/team`）を注入するか
- `CTXDB_CODEX_DISABLE_MCP`: wrapper 経由の `codex` で MCP 起動をスキップするか（`1` で cold-start 待ちを回避）
- `CTXDB_TEAM_WORKERS`: `aios team ...` の並列 worker 数
- `AIOS_SUBAGENT_CONCURRENCY`: `aios orchestrate --execute live` の並列実行数

推奨プリセット:

- バランス（推奨）: `3 + 3`
- 高スループット: `4 + 4`
- デバッグ安定モード: `1 + 1`

## 5.2) 任意：HUD と Team Ops の可視化

HUD でセッション状態を表示:

```bash
aios hud --provider codex
aios hud --watch --preset full
aios hud --session <session-id> --json
```

Team Ops ステータスと履歴:

```bash
aios team status --provider codex --watch
aios team history --provider codex --limit 20
```

Skill-candidate 詳細ビュー (2026-04-09 以降):

```bash
# デフォルトリミットで skill candidates を表示（通常モード 6 個、fast-watch minimal モード 3 個）
aios team status --show-skill-candidates

# candidate 制限を設定 (1-20)
aios team status --show-skill-candidates --skill-candidate-limit 10

# Fast-watch モードは自動的最小制限 (3 個 candidates)
aios team status --watch --fast

# HUD も skill-candidate ビューに対応
aios hud --show-skill-candidates --skill-candidate-limit 5
```

Quality-gate カテゴリフィルター (2026-04-08 以降):

```bash
# quality-gate 失敗セッションのみ表示
aios team history --quality-failed-only

# quality category prefix でフィルター
aios team history --quality-category clarity
aios team history --quality-category sample.latency-watch
```

Dispatch hindsight と draft 推奨 (2026-04-07 以降):

```bash
# Learn-eval が draft skill-candidate patches を表示
aios learn-eval --limit 10

# HUD は利用可能な場合に skill-candidate apply コマンドを提案
aios hud --session <session-id>
```

## 6) 生成データを確認

=== "macOS / Linux"

    ```bash
    ls memory/context-db
    ```

=== "Windows (PowerShell)"

    ```powershell
    Get-ChildItem memory/context-db
    ```

`sessions/`、`index/`、`exports/` が表示されれば成功です。

## 7) 更新 / アンインストール

=== "macOS / Linux (zsh)"

    ```bash
    scripts/update-contextdb-shell.sh --mode opt-in
    scripts/uninstall-contextdb-shell.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-contextdb-shell.ps1 -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-contextdb-shell.ps1
    ```

## 8) 任意: このリポジトリの Skills をグローバル導入

他プロジェクトでもこのリポジトリの skills を使いたい場合のみ実行してください。
`--client all` は `codex` / `claude` / `gemini` / `opencode` を対象にします。

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

Skills ライフサイクル:

=== "macOS / Linux"

    ```bash
    scripts/update-contextdb-skills.sh --client all
    scripts/uninstall-contextdb-skills.sh --client all
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-contextdb-skills.ps1 -Client all
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-contextdb-skills.ps1 -Client all
    ```

## FAQ

### これはネイティブ CLI クライアントを置き換えますか？

いいえ。ネイティブコマンドをそのまま実行します。ラッパーはコンテキスト注入と互換性維持のみを行います。

### 跨プロジェクト記憶汚染を避ける方法は？

`CTXDB_WRAP_MODE=opt-in` を使用し、必要なプロジェクトのみで `.contextdb-enable` を作成してください。

### ラッパーインストールで skills も自動インストールされますか？

いいえ。ラッパーと skills は意図的に分離されています。グローバル skills が必要な場合は手順 8 を実行してください。

### `CODEX_HOME points to ".codex"` が出る

`CODEX_HOME` が相対パスになっています。絶対パスにしてください:

```bash
export CODEX_HOME="$HOME/.codex"
mkdir -p "$CODEX_HOME"
```

### ブラウザツールが失敗した場合最初に何コマンドを実行すべきですか？

再インストール前に `scripts/doctor-browser-mcp.sh`（または PowerShell 版）を実行してください。
