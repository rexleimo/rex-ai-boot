---
title: クイックスタート
description: インストールから初回利用までの最短経路。まず TUI を開き、Doctor を実行し、プロジェクトで agent を起動します。
---

# クイックスタート

目標: **約3分でインストールし、TUI を開き、Doctor を1回実行し、プロジェクト内で agent を起動します。**

RexCLI の全機能をまだ知らなくても問題ありません。まずこのページを進め、その後 [シナリオ別コマンド](use-cases.md) を見てください。

## 必要なもの

- Node.js **22 LTS** と `npm`
- coding CLI のいずれか: `codex`、`claude`、`gemini`
- 作業したいプロジェクトディレクトリ

Node を確認:

```bash
node -v
npm -v
```

Node が 22 でない場合は先に切り替えます:

```bash
nvm install 22
nvm use 22
```

## 1) Stable Release をインストール

=== "macOS / Linux"

    ```bash
    curl -fsSL https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.sh | bash
    source ~/.zshrc
    aios
    ```

    bash を使っている場合は `source ~/.zshrc` を `source ~/.bashrc` に置き換えてください。

=== "Windows PowerShell"

    ```powershell
    irm https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.ps1 | iex
    . $PROFILE
    aios
    ```

インストール先の既定値は `~/.rexcil/rex-cli`、統一入口は `aios` です。

!!! tip "git clone はいつ使う？"
    未リリースの `main` ブランチ挙動を明示的に使いたい場合だけ `git clone` を使ってください。通常ユーザーは GitHub Releases installer を優先してください。

## 2) TUI で Setup と Doctor を完了

実行:

```bash
aios
```

推奨順序:

1. **Setup** を選択。
2. コンポーネントは `all`、または最小構成 `shell,skills,superpowers` を選択。
3. インストール完了後に **Doctor** を選択。
4. Doctor の critical errors が 0 になってから使い始めます。

<figure class="rex-visual">
  <img src="../assets/visual-tui-setup-doctor.svg" alt="aios TUI で先に Setup、次に Doctor を選ぶ図">
  <figcaption>図: TUI を開いたらまず Setup、その後 Doctor。critical errors が 0 になったら、プロジェクトに入って `codex` / `claude` / `gemini` を起動します。</figcaption>
</figure>

shell wrapper を変更した場合は現在の shell を再読み込みします:

=== "macOS / Linux"

    ```bash
    source ~/.zshrc
    ```

=== "Windows PowerShell"

    ```powershell
    . $PROFILE
    ```

## 3) プロジェクトで記憶を有効化

プロジェクトディレクトリへ移動:

=== "macOS / Linux"

    ```bash
    cd /path/to/your/project
    touch .contextdb-enable
    codex
    ```

=== "Windows PowerShell"

    ```powershell
    cd C:\path	o\your\project
    New-Item -ItemType File -Path .contextdb-enable -Force
    codex
    ```

最後の行は次に置き換えても構いません:

```bash
claude
gemini
```

同じプロジェクトディレクトリで実行すれば、同じ ContextDB を読み書きします。

## 4) 初回に動作確認

プロジェクト内で実行:

=== "macOS / Linux"

    ```bash
    aios doctor --native --verbose
    ls -la memory/context-db
    ```

=== "Windows PowerShell"

    ```powershell
    aios doctor --native --verbose
    Get-ChildItem -Path memory/context-db -ErrorAction SilentlyContinue
    ```

`sessions/`、`index/`、`exports/` などのディレクトリが見えれば、ContextDB が記録を開始しています。

まだディレクトリがない場合は、`codex` / `claude` / `gemini` を一度普通に起動して RexCLI に自動初期化させてください。すぐに再インストールする必要はありません。

それでも見えない場合は実行:

```bash
aios doctor --native --fix
```

## 5) よく使う6つのコマンド

| シナリオ | コマンド |
|---|---|
| TUI を開く | `aios` |
| 記憶付き Codex を起動 | `codex` |
| 現在セッションを見る | `aios hud --provider codex` |
| multi-agent タスクを実行 | `aios team 3:codex "X を実装し、完了前にテストを実行"` |
| team 進捗を監視 | `aios team status --provider codex --watch` |
| 提出前 quality check | `aios quality-gate pre-pr --profile strict` |

## 6) Memo で継続メモを管理

ContextDB ファイルを手で触らず、継続的なプロジェクトメモを残したい場合:

```bash
aios memo use release-train
aios memo add "Need strict pre-PR checks #quality"
aios memo pin add "Avoid destructive git commands."
aios memo recall "quality gate" --limit 5
```

記憶レイヤー:

- `memo add/list/search/recall` -> ContextDB イベント
- `memo pin` -> ワークスペースの `pinned.md`
- `memo persona/user` -> グローバル identity ファイル（`~/.aios/SOUL.md`、`~/.aios/USER.md`）

## 7) Agent Team の最短利用

タスクが比較的独立した部分へ分割できる時だけ使います:

```bash
aios team 3:codex "ユーザー設定ページを実装し、テストを追加し、ドキュメントを更新"
aios team status --provider codex --watch
```

小さな bug 修正、または分割方法がまだ分からない場合は、普通に起動します:

```bash
codex
```

判断基準は [Agent Team](team-ops.md) を参照してください。

## 8) ブラウザ自動化の最初の診断

RexCLI は既定で CDP/browser-use 経路のブラウザ自動化を使います。ブラウザ関連の問題はまず次を実行してください:

```bash
aios internal browser doctor --fix
aios internal browser cdp-status
```

複雑なページでは、まず agent にページテキスト/DOM を読ませ、スクリーンショットは fallback として使ってください。最初から盲目的にボタンを押さないでください。

## 9) Privacy-safe read

`.env`、token、cookies、クラウド設定をそのまま model に貼らないでください。次を使います:

```bash
aios privacy read --file <path>
```

RexCLI に wrap された `codex` / `claude` / `gemini` 起動時には、Privacy Shield パネルで現在の保護状態が表示されます。

## 10) 更新とアンインストール

TUI を優先します:

```bash
aios
```

コマンドでも実行できます:

```bash
aios update --components all --client all
aios uninstall --components shell,skills,native
```

## 11) 開発インストール経路

メンテナー、または未リリース機能を試したい場合:

=== "macOS / Linux"

    ```bash
    git clone https://github.com/rexleimo/rex-cli.git ~/.rexcil/rex-cli
    cd ~/.rexcil/rex-cli
    scripts/aios.sh
    ```

=== "Windows PowerShell"

    ```powershell
    git clone https://github.com/rexleimo/rex-cli.git $HOME\.rexcilex-cli
    cd $HOME\.rexcilex-cli
    powershell -ExecutionPolicy Bypass -File .\scriptsios.ps1
    ```

開発インストールは stable release とは異なります。通常ユーザーは step 1 の one-liner を使ってください。

## FAQ

### RexCLI は native CLI を置き換えますか？

いいえ。引き続き `codex`、`claude`、`gemini` を実行します。RexCLI はその周辺に記憶、skills、診断、orchestration を追加します。

### なぜ `.contextdb-enable` を作るのですか？

すべてのディレクトリで文脈を記録しないための opt-in スイッチです。プロジェクト記憶を有効化したいリポジトリにだけ作成してください。

### ContextDB / Superpowers / Team Ops を先に学ぶ必要がありますか？

不要です。新規ユーザーは最初に3つだけ覚えれば十分です: `aios` で setup/diagnostics、`.contextdb-enable` で project memory、`codex` で通常作業。

### Agent は何個から始めるべきですか？

まず `3` を推奨します:

```bash
aios team 3:codex "task"
```

衝突が増えたら `2` に下げ、タスクが非常に独立している場合だけ `4` を検討してください。

### `CODEX_HOME points to ".codex"` が出たら？

`CODEX_HOME` が相対パスになっています。絶対パスへ変更します:

```bash
export CODEX_HOME="$HOME/.codex"
mkdir -p "$CODEX_HOME"
```

### 次に何を読む？

- [シナリオ別コマンド](use-cases.md)
- [Agent Team](team-ops.md)
- [ContextDB](contextdb.md)
- [トラブルシューティング](troubleshooting.md)
