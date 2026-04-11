---
title: HUD ユーザーガイド
description: エージェントセッションの監視に HUD（Heads-Up Display）を使用するための完全ガイド。
---

# HUD ユーザーガイド

HUD（Heads-Up Display）は、エージェントセッションの状態、dispatch 結果、改善機会をリアルタイムで可視化します。

## HUD の使用場面

- **長実行タスク**: エージェントを妨害せずに進捗を監視
- **失敗のデバッグ**: quality-gate 結果と hindsight 分析を確認
- **スキル改善**: skill candidate パッチを発見して適用
- **チーム調整**: 複数の同時セッションを追跡

## HUD モード

### Minimal モード

長実行セッションのウォッチに最適：
- 基本状態のみ表示
- 高速リフレッシュ（1 秒データポーリング）
- リソース使用を削減する適応間隔

```bash
aios hud --watch --preset minimal --fast
```

### Compact モード

ターミナルフレンドリーな要約：
- セッション目標
- Dispatch 要約
- Quality-gate 状態

```bash
aios hud --preset compact
```

### Focused モード (デフォルト)

ほとんどのユースケースに適したバランス：
- すべての compact 情報
- 最近の dispatch artifacts
- Skill candidate hints

```bash
aios hud --preset focused
```

### Full モード

完全診断：
- すべての focused 情報
- 完全な hindsight 分析
- Quality-gate 詳細
- Fix hints と推奨事項

```bash
aios hud --preset full
```

## 基本的な使い方

### 現在のセッションを表示

```bash
# デフォルト focused ビュー
aios hud

# プロバイダー指定
aios hud --provider claude
aios hud --provider gemini
```

### ウォッチモード

```bash
# 継続的監視（1 秒リフレッシュ）
aios hud --watch

# カスタム間隔（ミリ秒）
aios hud --watch --interval-ms 2000

# 適応間隔付きファストモード
aios hud --watch --fast
```

### セッション指定

```bash
# セッション ID で
aios hud --session <session-id>
```

### JSON 出力

```bash
# 機械可読出力
aios hud --json

# jq でフィルタリング
aios hud --json | jq '.selection.qualityGate'
```

## Skill Candidate 機能

### Skill Candidates を表示

```bash
# HUD にcandidates をインライン表示
aios hud --show-skill-candidates

# 詳細ビュー（candidates のみ、HUD なし）
aios hud --show-skill-candidates --skill-candidate-view detail

# 候補数を制限（1-20）
aios hud --show-skill-candidates --skill-candidate-limit 10
```

### パッチテンプレートをエクスポート

```bash
# デフォルト場所にエクスポート
aios hud --export-skill-candidate-patch-template

# 特定の draft ID フィルター付きでエクスポート
aios hud --export-skill-candidate-patch-template --draft-id <draft-id>
```

**出力先**: `memory/context-db/sessions/<session-id>/artifacts/skill-candidate-patch-template-<timestamp>.md`

## トラブルシューティング

### HUD に古いデータが表示される

```bash
# ウォッチを再起動して強制リフレッシュ
aios hud --watch --interval-ms 500
```

### Skill Candidates が表示されない

考えられる理由:
- セッションが選択されていない（`--session` を使用）
- セッションに quality-gate 失敗がない
- Learn-eval がまだ実行されていない

```bash
# quality-gate 失敗を確認
aios hud --json | jq '.selection.qualityGate'
```

## 関連ドキュメント

- [Team Ops](team-ops.md) - Team Operations の概要
- [Skill Candidates](skill-candidates.md) - パッチの理解と適用
- [ContextDB](contextdb.md) - セッションストレージ
