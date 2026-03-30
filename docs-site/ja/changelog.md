---
title: 変更履歴
description: リリース履歴、アップグレード情報、関連ドキュメントへの入口。
---

# 変更履歴

このページでは `RexCLI` の変更点を追跡し、関連ドキュメントへ移動できます。

## 公式リリース履歴

- GitHub 変更ファイル: [CHANGELOG.md](https://github.com/rexleimo/rex-cli/blob/main/CHANGELOG.md)
- GitHub Releases: [releases](https://github.com/rexleimo/rex-cli/releases)

## 最近のバージョン

- `main` (未リリース):
  - **マルチ環境 RL トレーニングシステム**: shell、browser、orchestrator アダプタを持つ共有 `rl-core` 制御プレーン；3ポインター checkpoint 系列；4レーン replay pool；PPO + teacher 蒸留トレーニング
  - **混合環境キャンペーン** (`rl-mixed-v1`): 1つのライブバッチが shell + browser + orchestrator episode にまたがり、統一ロールバック判断で実行
  - ContextDB `search` がデフォルトで SQLite FTS5 + `bm25(...)` ランキングになり、FTS 利用不可時は自動レキシカルフォールバック
  - ContextDB セマンティックリランキングがクエリスクープのレキシカル候補で動作し、古い完全一致のドロップを削減
  - `aios orchestrate` の `subagent-runtime` live 実行（`AIOS_EXECUTE_LIVE=1` で opt-in）
  - 所有権ヒント付きバウンド work-item キューScheduling
  - no-op ファストパス: 上流 handoff がファイルをタッチしなかった場合に `reviewer` / `security-reviewer` を自動完了
  - `main` への各push時に Windows PowerShell shell-smoke ワークフロー（`.github/workflows/windows-shell-smoke.yml`）
  - `global` / `project` ターゲット選択を持つスコープ対応 `skills` インストールフロー
  - canonical skill オーサリングが `skill-sources/` に移動、repo-local クライアントルートは `node scripts/sync-skills.mjs` で生成
  - デフォルト skills インストールモードがポータブル `copy` に；明示的 `--install-mode link` はローカル開発向けに維持
  - リリース packaging/preflight が `check-skills-sync` で生成 skill roots を検証
  - コアデフォルト、オプショナル business skills、アンインストールでインストール済み項目のみ表示のカタログ駆動 skill ピッカー
  - TUI skill ピッカーが `Core` と `Optional` にグループ化し、ターミナル可読性のために説明を切り詰める
  - `doctor` が同名グローバルインストールのプロジェクト skill 上書きを警告
  - Node ランタイムガイダンスが Node 22 LTS に明示的に整合
- `0.17.0` (2026-03-17):
  - TUI アンインストールピッカーが小さいターミナルでスクロールし、`Select all` / `Clear all` / `Done` を下部に固定
  - アンインストールカーソル選択が描画グループリストと整合 유지
  - セットアップ/更新 skill ピッカーがすでにインストール済みスキルを `(installed)` でラベル付け
- `0.16.0` (2026-03-10): orchestrator agent catalog と生成器を追加
- `0.15.0` (2026-03-10): `orchestrate live` をデフォルトで gate（`AIOS_EXECUTE_LIVE`）
- `0.14.0` (2026-03-10): `subagent-runtime` ランタイムアダプタ（stub）を追加
- `0.13.0` (2026-03-10): ランタイム manifest を外部化
- `0.11.0` (2026-03-10): ローカル orchestrate preflight の対応範囲を拡張
- `0.10.4` (2026-03-08): 非 git ワークスペースの wrapper fallback と docs 同期
- `0.10.3` (2026-03-08): Windows の cmd-backed CLI 起動を修正
- `0.10.0` (2026-03-08): セットアップ/更新/削除のライフサイクルを Node に統合
- `0.8.0` (2026-03-05): 厳格な Privacy Guard（Ollama 対応）とセットアップ統合を追加
- `0.5.0` (2026-03-03): ContextDB の SQLite sidecar index（`index:rebuild`）、任意の `--semantic` 検索、`ctx-agent` 実行コア統合

## 2026-03-16 運用状況

- 継続的ライブサンプルが成功中（`dispatchRun.ok=true`）、最新アーティファクト:
  - `memory/context-db/sessions/codex-cli-20260303T080437-065e16c0/artifacts/dispatch-run-20260316T111419Z.json`
- `learn-eval` がまだ以下を推奨:
  - `[fix] runbook.failure-triage`（`clarity-needs-input=5`）
  - `[observe] sample.latency-watch`（`avgElapsedMs=160678`）
- latency-watch 観察が続く間、Timeout 予算は現状維持。

## 関連記事

- [ブログ: Skills インストール体験アップデート](/blog/ja/2026-03-rexcli-skills-install-experience/)
- [クイックスタート](getting-started.md)
- [ContextDB](contextdb.md)
- [トラブルシューティング](troubleshooting.md)

## 更新ルール

セットアップ、実行挙動、互換性に関わる変更は、同一 PR でドキュメントを更新し本ページにも反映します。
