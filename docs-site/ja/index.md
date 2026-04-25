---
title: 概要
description: まずやりたい作業からコマンドを選び、ContextDB、Agent Team、ブラウザ自動化、skills に進みます。
---

# RexCLI

> 今の習慣を変えずに、普段使っている `codex` / `claude` / `gemini` に記憶、協調、検証を追加します。

[3分クイックスタート](getting-started.md){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="quick_start" }
[Agent Team の使い方](team-ops.md){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="team_ops" }
[シナリオ別コマンド](use-cases.md){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="use_cases" }
[GitHub](https://github.com/rexleimo/rex-cli?utm_source=cli_rexai_top&utm_medium=docs&utm_campaign=ja_onboarding&utm_content=home_hero_star){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="github_star" }

<figure class="rex-visual">
  <img src="../assets/visual-new-user-path.svg" alt="RexCLI 初心者の3ステップ: Doctor、プロジェクト記憶、必要時だけ Agent Team">
  <figcaption>新規ユーザーは最短経路から始めます。インストール後に Doctor を実行し、プロジェクト記憶を有効化し、タスクが明確に分割できる時だけ Agent Team を使います。</figcaption>
</figure>

## まず何をしたいか選ぶ

| 今やりたいこと | 先に読む | 最短コマンド |
|---|---|---|
| インストールして TUI を開く | [クイックスタート](getting-started.md) | `aios` |
| agent にプロジェクト文脈を覚えさせる | [ContextDB](contextdb.md) | `touch .contextdb-enable && codex` |
| 複数 agent で作業する | [Agent Team](team-ops.md) | `aios team 3:codex "X を実装し、テストを実行"` |
| 進捗を見る | [HUD ガイド](hud-guide.md) | `aios team status --provider codex --watch` |
| ブラウザ自動化を診断する | [トラブルシューティング](troubleshooting.md) | `aios internal browser doctor --fix` |

## RexCLI とは

RexCLI は新しい coding agent ではありません。ローカル優先の能力レイヤーです。

1. **記憶レイヤー ContextDB**: イベント、checkpoint、context pack を現在のプロジェクトに保存し、ターミナル再起動後も続きから作業できます。
2. **ワークフローレイヤー Superpowers**: 要件を計画に分解し、証拠ベースでデバッグし、完了前に検証します。
3. **協調レイヤー Agent Team**: 明確に分割できるタスクを複数 CLI worker に渡し、HUD で状態を追跡します。
4. **ツールレイヤー Browser MCP + Privacy Guard**: agent がブラウザを使えるようにし、機密設定は共有前にマスクします。

つまり、あなたは引き続き `codex`、`claude`、`gemini` を実行します。RexCLI はそれらに記憶、協調、検証を足します。

## 新規ユーザーの推奨ルート

### 1日目: まず動かす

```bash
curl -fsSL https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.sh | bash
source ~/.zshrc
aios
```

TUI で **Setup** を選び、その後 **Doctor** を実行します。

### Step 2: プロジェクトで記憶を有効化

```bash
cd /path/to/your/project
touch .contextdb-enable
codex
```

以後、このプロジェクトで `codex` / `claude` / `gemini` を起動すると、RexCLI が同じプロジェクト文脈へ接続します。

### Step 3: 分割できる時だけ Agent Team を使う

```bash
aios team 3:codex "ログインモジュールをリファクタし、完了前に関連テストを実行"
aios team status --provider codex --watch
```

タスクがまだ曖昧なら、まず通常の対話型 `codex` で分析します。明確に分割できる時だけ `team` を使ってください。

## よくある誤解

- **すべての作業に Agent Team は不要**: 単一ファイル修正、小さな bug、曖昧な要件は単一 agent から始めます。
- **初日に全環境変数を覚える必要はありません**: まず `aios` TUI を使ってください。
- **機能一覧から始めない**: 「今何をしたいか」からコマンドを選びます。
- **Doctor を飛ばさない**: install、browser、skills、native 設定を手で直す前に診断します。

## 次に読む

- [クイックスタート](getting-started.md): install、Setup、Doctor、初回実行。
- [シナリオ別コマンド](use-cases.md): 作業別に入口を選ぶ。
- [Agent Team](team-ops.md): いつ team を使うか、どう監視し、どう完了するか。
- [ContextDB](contextdb.md): 記憶がセッションをまたいで残る仕組み。
- [トラブルシューティング](troubleshooting.md): install、browser、live 実行の問題。
