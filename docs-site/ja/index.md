---
title: 概要
description: Codex/Claude/Gemini/OpenCode 向けの AI 記憶システム文書。Hermes ワークフロー、Agent Team、subagent 自動計画をカバー。
---

# RexCLI

> 今のツールを続けながら、`codex` / `claude` / `gemini` / `opencode` に更强的能力を足す。

[GitHub で Star](https://github.com/rexleimo/rex-cli?utm_source=cli_rexai_top&utm_medium=docs&utm_campaign=english_growth&utm_content=home_hero_star){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="github_star" }
[クイックスタート](getting-started.md){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="quick_start" }
[ワークフロー比較](cli-comparison.md){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="compare_workflows" }
[Superpowers](superpowers.md){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="superpowers" }

プロジェクトURL: <https://github.com/rexleimo/rex-cli>

## クイックアンサー

RexCLI は coding agent 向けの **AI 記憶システム + オーケストレーション層** です。  
次のニーズに対応します:

- **記憶システム** としてのセッション跨ぎコンテキスト保持（`ContextDB`）
- **Hermes エンジン系ワークフロー** に近い自動化と実行制御
- **Agent Team** によるマルチエージェント協調
- **subagent 自動計画** と preflight/merge gate

## キーワードと機能の対応

- `記憶システム` -> [ContextDB](contextdb.md)
- `Hermes エンジン` -> [CLI ワークフロー](use-cases.md)
- `Agent Team` -> [Agent Team & HUD](team-ops.md)
- `subagent 自動計画` -> [アーキテクチャ](architecture.md)

## 高度デザインスキル: ページ制作

曖昧な依頼でも高品質 UI を安定して作るには:

- [高度デザインスキル](advanced-design-skills.md) で `DESIGN.md` を先に固定し、`frontend-design` で実装
- `Patch/Restyle/Flow` の3モードで要件を収束
- プロダクト組み込み時はガイド内のシステムプロンプトを既定化

## 最新機能

- [高度デザインスキルでページ制作: 曖昧プロンプトを本番 UI に変える](/blog/ja/advanced-design-skills-page-building/)
- [AIOS RL Training System](/blog/rl-training-system/)
- [ContextDB Search Upgrade: FTS5/BM25 by Default](/blog/contextdb-fts-bm25-search/)
- [Windows CLI Startup Stability Update](/blog/windows-cli-startup-stability/)
- [Orchestrate Live: Subagent Runtime](/blog/orchestrate-live/)

## これは何か？

RexCLIは、すでにあるCLIエージェントの上に薄い能力レイヤーを載せるもの。`codex`や`claude`などを替换せず、もっと使いやすくする。

4つのできること：

1. **記憶がセッション跨げる** - ターミナル閉じてまた開いても、前のプロジェクト状況がそのまま。同一プロジェクトなら複数デバイスで記憶共有。
2. **ブラウザ自動化** - MCP経由でChromeを操作できる。
3. **Superpowers 智能計画** - 要件自動分解、並列タスク分发、自动検証。並列設定は [ルーティングと並列プロファイル](route-concurrency-profiles.md)（`3+3` / `4+4` / debug）を参照。
4. **プライバシーガード** - 設定ファイル読み込む時、自動でシークレットをマスク。

## 誰のために？

- すでに `codex` / `claude` / `gemini` / `opencode` のいずれかを使っている
- ターミナル再起動してもワークフローを続けたい
- ブラウザ自動化が必要だけどツールを変えたくない
- ベストプラクティスを強制する自動化スキルがほしい

## クイックスタート

```bash
curl -fsSL https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.sh | bash
source ~/.zshrc
aios
```

上のコマンドは stable release 用インストール経路です。未リリースの `main` を使いたい場合は、[クイックスタート](getting-started.md) にある開発用 `git clone` 経路を使ってください。

まず `aios` を起動して全画面 TUI を開き、**Setup** を選んで、最後に **Doctor** を実行してください。
Windows PowerShell の手順は [クイックスタート](getting-started.md) にあります。

## 入っているもの

| 機能 | 役割 |
|---|---|
| ContextDB | セッション跨ぎの永続化記憶 |
| Playwright MCP | ブラウザ自動化 |
| Superpowers | 自動計画（自動分解、並列実行、自動検証）+ ルーティング/並列プロファイル（既定 `3+3`） |
| Privacy Guard | 機密情報を自動マスク |

## FAQ

### RexCLI は coding agent 向けの記憶システムですか？
はい。`ContextDB` が同一リポジトリ内でセッションを跨いで文脈を保持し、CLI 間の引き継ぎを支援します。

### Hermes 風のオーケストレーションは可能ですか？
はい。`team` と `orchestrate` で段階実行、ルーティング、検証ゲートを構成できます。

### subagent の自動計画はできますか？
はい。`single/subagent/team` のルート判定と実行ガードレールを備えています。

## 続きを読む

- [Superpowers](superpowers.md) - CLIをより賢くする自動化スキル
- [クイックスタート](getting-started.md)
- [Raw CLI vs RexCLI](cli-comparison.md)
- [ケース集](case-library.md)
- [アーキテクチャ](architecture.md)
- [ContextDB](contextdb.md)
- [変更履歴](changelog.md)
