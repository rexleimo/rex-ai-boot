---
title: クイックスタート
description: macOS・Linux・Windows を 1 つの手順に統合し、OS タブで切り替えるガイド。
---

# クイックスタート

このページは macOS・Linux・Windows のセットアップを 1 つの流れに統合しています。コマンド差分は OS タブで切り替えてください。

## 前提

- Node.js **20+**（推奨：**22 LTS**）と `npm`
- `codex` / `claude` / `gemini` のいずれか
- プロジェクト単位 ContextDB を有効化する対象のワークスペース/ディレクトリ

## 0) インストール（推奨）

このリポジトリは `~/.rexcil/rex-cli` にインストールされます。統一エントリは `aios` です:

- `aios`（引数なし）: 全画面 TUI を起動
- `aios doctor|update|privacy ...`: 既存のサブコマンド

### 方式 C: ワンライナー（GitHub Releases）

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

- `AIOS_SUBAGENT_CONCURRENCY` (default: `2`)
- `AIOS_SUBAGENT_TIMEOUT_MS` (default: `600000`)

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

### `CODEX_HOME points to ".codex"` が出る

`CODEX_HOME` が相対パスになっています。絶対パスにしてください:

```bash
export CODEX_HOME="$HOME/.codex"
mkdir -p "$CODEX_HOME"
```

### ラッパー導入で skills も自動インストールされますか?

いいえ。ラッパーと skills は分離されています。グローバル skills が必要な場合は手順 8 を実行してください。
