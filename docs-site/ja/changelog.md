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

- `main`（未リリース）: `aios orchestrate` に `subagent-runtime` の live 実行を追加（`AIOS_EXECUTE_LIVE=1` が必要）；Codex CLI v0.114+ の構造化出力で JSON handoff を安定化
- `0.16.0`（2026-03-10）: orchestrator の agent catalog と生成器を追加
- `0.15.0`（2026-03-10）: `orchestrate live` をデフォルトで gate（`AIOS_EXECUTE_LIVE`）
- `0.14.0`（2026-03-10）: `subagent-runtime` ランタイムアダプタ（stub）を追加
- `0.13.0`（2026-03-10）: ランタイム manifest を外部化
- `0.11.0`（2026-03-10）: ローカル orchestrate preflight の対応範囲を拡張
- `0.10.4`（2026-03-08）: 非 git ワークスペースの wrapper fallback と docs 同期
- `0.10.3`（2026-03-08）: Windows の cmd-backed CLI 起動を修正
- `0.10.0`（2026-03-08）: セットアップ/更新/削除のライフサイクルを Node に統合
- `0.8.0`（2026-03-05）: 厳格な Privacy Guard（Ollama 対応）とセットアップ統合を追加
- `0.5.0`（2026-03-03）: ContextDB の SQLite sidecar index（`index:rebuild`）、任意の `--semantic` 検索、`ctx-agent` 実行コア統合

## 関連記事

- [クイックスタート](getting-started.md)
- [ContextDB](contextdb.md)
- [トラブルシューティング](troubleshooting.md)

## 更新ルール

セットアップ、実行挙動、互換性に関わる変更は、同一 PR でドキュメントを更新し本ページにも反映します。
