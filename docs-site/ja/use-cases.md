---
title: CLI ワークフロー
description: 対話モードと one-shot モード。
---

# CLI ワークフロー

具体的な再現コマンド付きシナリオは[公式ケースライブラリ](case-library.md)を参照してください。

## 対話モード

`codex` / `claude` / `gemini` 実行時に、起動前コンテキストを自動注入します。

## one-shot モード

```bash
scripts/ctx-agent.sh --agent claude-code --prompt "現在の状態を要約して次の手順を示して"
```

5 ステップ（`init -> session -> event -> checkpoint -> pack`）を 1 コマンドで実行します。
