---
title: Skill Candidates ガイド
description: 失敗したセッションからスキル改善パッチを発見、レビュー、適用する方法を学ぶ。
---

# Skill Candidates ガイド

**Skill Candidates** は、失敗したエージェントセッションから抽出された自動化された改善提案です。

## 概要

エージェントセッションが quality-gate に失敗すると、AIOS は自動的に:
1. 失敗パターンを分析
2. 根本原因を特定
3. Skill patch draft を生成
4. **skill candidate** としてレビュー用に提示

## Skill Candidates の表示

```bash
# HUD から表示
aios hud --show-skill-candidates

# Team Status から表示
aios team status --show-skill-candidates

# リストコマンド
aios team skill-candidates list --session-id <session-id>

# JSON 出力
aios team skill-candidates list --json
```

## パッチのエクスポート

```bash
# デフォルト場所にエクスポート
aios team skill-candidates export

# カスタム出力パス
aios team skill-candidates export --output-path ./patches/my-fix.md

# draft ID でフィルタ
aios team skill-candidates export --draft-id <draft-id>
```

## パッチの適用

### レビュープロセス

**パッチ適用前に:**
1. failure class を読む - 何が悪かったかを理解
2. lesson をレビュー - 何を学んだか
3. patch hint を確認 - 提案された変更
4. パッチが現在のスキルに適用可能か確認

### 適用コマンド

```bash
# 特定の candidate を適用
aios skill-candidate apply <candidate-id>

# レビューモードで適用
aios skill-candidate apply <candidate-id> --review

# ドライラン（変更をプレビュー）
aios skill-candidate apply <candidate-id> --dry-run
```

## ベストプラクティス

### 優先順位

1. 高頻度の失敗（同じ失敗クラスが複数回）
2. 重要なパスのスキル（認証、セキュリティ、データ整合性）
3. 簡単な修正（1 行の修正、明確な改善）

### レビューガイド

- **自動適用しない** - すべてのパッチは人間の検証が必要
- **個別にテスト** - パッチが既存機能を壊さないことを確認
- **競合を確認** - 複数のパッチが同じコードを変更する可能性
- **決定を文書化** - 承認/拒否した理由を記録

## トラブルシューティング

### 失敗セッション後に candidates がない

```bash
# 手動で learn-eval を実行
aios learn-eval --session <session-id>
```

### パッチが適用できない

理由:
- ターゲットスキルが変更された
- パッチ形式が非互換
- 競合する変更

```bash
# candidate ソースバージョンを確認
aios team skill-candidates list --json | jq '.[0].sourceArtifactPath'
```

## 関連ドキュメント

- [Team Ops](team-ops.md) - Team Operations の概要
- [HUD ガイド](hud-guide.md) - HUD でのセッション監視
- [ContextDB](contextdb.md) - セッションストレージ
