---
title: Agent Team & HUD
description: HUD ダッシュボードと Team Ops 状態追跡でマルチエージェントコラボレーションを監視および管理。
---

# Agent Team と HUD

AIOS は **Team Operations (Team Ops)** を提供します — Codex CLI、Claude Code、Gemini CLI セッション全体のマルチエージェントコラボレーションを監視および管理するためのツールセット。

## 概要

Team Ops により以下を確認できます：
- **リアルタイムセッション状態** HUD（Heads-Up Display）経由
- **履歴セッション分析** quality-gate 追跡付き
- **スキル改善の機会** skill candidates 経由
- **Dispatch hindsight** 失敗した実行のデバッグ用

## クイックスタート

### 現在のセッション状態を表示

```bash
# 現在のセッションの最小 HUD
aios hud

# ウォッチモードで完全詳細
aios hud --watch --preset full

# プロバイダーとセッションを指定
aios hud --provider codex --session <session-id>
```

### Team Status と History

```bash
# チーム状態をリアルタイムで監視
aios team status --provider codex --watch

# セッション履歴を表示（直近 20 回の実行）
aios team history --provider codex --limit 20
```

## 主要コンポーネント

### HUD (Heads-Up Display)

HUD は単一セッションのリアルタイムダッシュボードを提供：
- 現在のタスク目標
- Dispatch 状態（ジョブ実行済み、ブロック済み、保留中）
- Quality-gate 結果
- Skill candidate の可用性
- Hindsight 分析（失敗パターン、回帰）

**HUD Presets:**
| Preset | ユースケース |
|--------|----------|
| `minimal` | 長時間のウォッチセッション |
| `compact` | ターミナルフレンドリーな要約 |
| `focused` (デフォルト) | バランスの取れた詳細 |
| `full` | 完全診断 |

### Team Status

プロバイダーのすべての最近セッションの集計状態を表示：
- アクティブ vs 完了セッション
- 成功/失敗率
- Quality-gate の要約
- 主要 skill candidates

### Team History

過去のセッションの履歴分析：
- Dispatch 結果
- カテゴリ別 quality-gate 失敗
- Hindsight パターン（繰り返し失敗、回帰）
- Fix hints と推奨

## Skill Candidates

**Skill Candidates** は失敗したセッションから抽出された自動化された改善提案：

1. セッションが quality-gate に失敗
2. Learn-eval が失敗パターンを分析
3. Skill patch draft を生成
4. あなたがレビューしてパッチを適用

### Skill Candidates を表示

```bash
# 現在のセッションの candidates を表示
aios team status --show-skill-candidates

# skill candidate 詳細ビュー付き HUD
aios hud --show-skill-candidates --skill-candidate-view detail

# 特定セッションの candidates をリスト
aios team skill-candidates list --session-id <session-id>
```

### パッチのエクスポートと適用

```bash
# パッチテンプレートを artifact ファイルにエクスポート
aios team status --export-skill-candidate-patch-template

# カスタム出力パスでエクスポート
aios team skill-candidates export --output-path ./my-patch.md

# skill candidate パッチを適用
aios skill-candidate apply <candidate-id>
```

### Draft ID でフィルタ

```bash
# draft ID で skill candidates をフィルタ
aios team status --show-skill-candidates --draft-id <draft-id>

# draft フィルタ付き HUD
aios hud --show-skill-candidates --draft-id <draft-id>
```

## Quality-Gate フィルタ

quality-gate 結果で履歴をフィルタ：

```bash
# 失敗したセッションのみ表示
aios team history --quality-failed-only

# 特定カテゴリでフィルタ
aios team history --quality-category clarity
aios team history --quality-category sample.latency-watch

# カテゴリプレフィックスでフィルタ（いずれかに一致）
aios team history --quality-category-prefix clarity,sample

# プレフィックスでフィルタ（すべてに一致）
aios team history --quality-category-prefixes clarity,dispatch --prefix-mode all
```

## コマンドリファレンス

### `aios hud`

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--session-id` | current | ターゲットセッション ID |
| `--provider` | codex | プロバイダー (codex/claude/gemini) |
| `--preset` | focused | HUD preset (minimal/compact/focused/full) |
| `--watch` | false | 継続的監視 |
| `--fast` | false | ファストモード（データ取得削減） |
| `--show-skill-candidates` | false | skill candidate 詳細を表示 |
| `--skill-candidate-limit` | 6 | 表示する最大 candidates (1-20) |
| `--skill-candidate-view` | inline | ビューモード (inline/detail) |
| `--export-skill-candidate-patch-template` | false | パッチ artifact をエクスポート |
| `--draft-id` | - | draft ID でフィルタ |
| `--json` | false | JSON で出力 |
| `--interval-ms` | 1000 | ウォッチ更新間隔 |

### `aios team status`

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--session-id` | current | ターゲットセッション ID |
| `--provider` | codex | プロバイダー (codex/claude/gemini) |
| `--preset` | focused | HUD preset |
| `--watch` | false | 継続的監視 |
| `--fast` | false | ファストモード |
| `--show-skill-candidates` | false | skill candidates を表示 |
| `--skill-candidate-limit` | 6 | 最大 candidates (1-20) |
| `--export-skill-candidate-patch-template` | false | パッチ artifact をエクスポート |
| `--draft-id` | - | draft ID でフィルタ |
| `--json` | false | JSON で出力 |

### `aios team history`

| オプション | デフォルト | 説明 |
|--------|---------|-------------|
| `--provider` | codex | プロバイダー (codex/claude/gemini) |
| `--limit` | 10 | 表示する最大セッション数 |
| `--concurrency` | 4 | 並列セッション読み取り |
| `--fast` | false | hindsight 詳細をスキップ |
| `--quality-failed-only` | false | 失敗したセッションのみ表示 |
| `--quality-category` | - | カテゴリでフィルタ |
| `--quality-category-prefix` | - | プレフィックスでフィルタ |
| `--quality-category-prefixes` | - | 複数のプレフィックス |
| `--quality-category-prefix-mode` | any | 一致モード (any/all) |
| `--draft-id` | - | draft ID でフィルタ |
| `--since` | - | 日でフィルタ (ISO) |
| `--status` | - | 状態でフィルタ |
| `--json` | false | JSON で出力 |

### `aios team skill-candidates`

| サブコマンド | 説明 |
|------------|-------------|
| `list` | セッションの skill candidates をリスト |
| `export` | パッチテンプレート artifact をエクスポート |

## 関連ドキュメント

- [HUD ガイド](hud-guide.md) - 詳細な HUD の使用法とカスタマイズ
- [Skill Candidates](skill-candidates.md) - スキルパッチの理解と適用
- [ContextDB](contextdb.md) - セッションストレージとメモリシステム
