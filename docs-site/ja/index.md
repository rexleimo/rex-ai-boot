---
title: 概要
description: rex-ai-boot の目的と主要機能。
---

# rex-ai-boot ドキュメント

プロジェクト URL: [https://github.com/rexleimo/rex-ai-boot](https://github.com/rexleimo/rex-ai-boot)

`rex-ai-boot` は次の CLI 向けローカルワークフローレイヤーです。

- Codex CLI
- Claude Code
- Gemini CLI
- OpenCode

追加する機能は 2 つです。

1. ファイルシステム ContextDB（セッション記憶）
2. 透過ラッパー（`codex` / `claude` / `gemini` をそのまま利用）

## 30 秒で開始（まず使う）

```bash
git clone https://github.com/rexleimo/rex-ai-boot.git
cd rex-ai-boot
scripts/setup-all.sh --components all --mode opt-in
source ~/.zshrc
codex
```

## すぐに試す

```bash
codex
claude
gemini
```

## 次に読む

- [プロジェクト（GitHub）](https://github.com/rexleimo/rex-ai-boot)
- [クイックスタート](getting-started.md)
- [ブログサイト](https://cli.rexai.top/blog/ja/)
- [リンク集](friends.md)
- [変更履歴](changelog.md)
- [CLI ワークフロー](use-cases.md)
- [公式ケースライブラリ](case-library.md)
- [アーキテクチャ](architecture.md)
- [ContextDB](contextdb.md)
