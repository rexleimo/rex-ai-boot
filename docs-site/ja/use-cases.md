---
title: CLI ワークフロー
description: 対話モードと one-shot モード。
---

# CLI ワークフロー

## クイックアンサー（AI 検索）

日常開発には対話モードで自動再開、確定的なフルループ実行には one-shot モードを使用します。

具体的なシナリオとコマンドレベルの例が必要ですか？[公式ケースライブラリ](case-library.md)を参照してください。

## モード A：対話モード再開（デフォルト）

ネイティブコマンドを使用。ラッパーが自動実行：

`init -> session:latest/new -> context:pack -> CLI 起動`

```bash
codex
claude
gemini
```

日常開発に最適で、自動起動コンテキストが注入されます。

## モード B：One-shot 自動化

1 コマンドでフルクローズドループが必要な場合：

`init -> session:latest/new -> event:add -> checkpoint -> context:pack`

```bash
scripts/ctx-agent.sh --agent claude-code --prompt "エラーを要約して次のステップを提案"
scripts/ctx-agent.sh --agent gemini-cli --prompt "チェックポイントから実装を続行"
scripts/ctx-agent.sh --agent codex-cli --prompt "テストを実行してタスクステータスを更新"
```

## クロス CLI handoff

よくあるフロー：

1. Claude で分析。
2. Codex で実装。
3. Gemini で検証/比較。

三者とも同じプロジェクト ContextDB を読み書きするため、handoff は一貫性を保ちます。

## 透伝コマンド

管理コマンドはラップされずにネイティブで動作します：

```bash
codex mcp
claude doctor
gemini extensions
```

## FAQ

### one-shot モードはいつ使うべきですか？

監査可能でステージ完了の実行を1コマンドで必要とする場合に one-shot を使用します。

### 1つのタスクで CLI を切り替えられますか？

はい。共有プロジェクト ContextDB により、タスク状態を失うことなくクロス CLI handoff できます。
