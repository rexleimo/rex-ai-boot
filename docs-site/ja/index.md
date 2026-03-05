---
title: 概要
description: 既存の Codex/Claude/Gemini/OpenCode CLI を OpenClaw スタイルにアップグレード。
---

# RexCLI

> 今のツールを続けながら、`codex` / `claude` / `gemini` / `opencode` に更强的能力を足す。

[クイックスタート](getting-started.md){ .md-button .md-button--primary }
[Superpowers](superpowers.md){ .md-button }

プロジェクトURL: <https://github.com/rexleimo/rex-cli>

## これは何か？

RexCLIは、すでにあるCLIエージェントの上に薄い能力レイヤーを載せるもの。`codex`や`claude`などを替换せず、もっと使いやすくする。

4つのできること：

1. **記憶がセッション跨げる** - ターミナル閉じてまた開いても、前のプロジェクト状況がそのまま。
2. **ブラウザ自動化** - MCP経由でChromeを操作できる。
3. **Superpowers** - 自動化スキル（头脑风暴、並列計画、検証、デバッグ）。
4. **プライバシーガード** - 設定ファイル読み込む時、自動でシークレットをマスク。

## 谁のために？

- すでに`codex`、`claude`、`gemini`、`opencode」のどれかを使ってる
- ターミナル再起動してもワークフローを続けたい
- ブラウザ自動化が必要だけどツールを変えたくない
- ベストプラクティスを強制する自動化スキルがほしい

## クイックスタート

```bash
git clone https://github.com/rexleimo/rex-cli.git
cd rex-cli
scripts/setup-all.sh --components all --mode opt-in
source ~/.zshrc
codex
```

## 入っているもの

| 機能 | 役割 |
|---|---|
| ContextDB | セッション跨ぎの永続化記憶 |
| Playwright MCP | ブラウザ自動化 |
| Superpowers | 自動化スキル（头脑风暴、並列計画、検証） |
| Privacy Guard | 敏感情報を自動マスク |

## 続きを読む

- [Superpowers](superpowers.md) - CLIをより賢くする自動化スキル
- [クイックスタート](getting-started.md)
- [ケース集](case-library.md)
- [アーキテクチャ](architecture.md)
- [ContextDB](contextdb.md)
- [変更履歴](changelog.md)
