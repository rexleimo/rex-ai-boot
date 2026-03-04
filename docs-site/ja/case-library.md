---
title: 公式ケースライブラリ
description: rex-ai-boot で実行できる代表シナリオを再現可能なコマンド付きで整理。
---

# 公式ケースライブラリ

このページは `rex-ai-boot` の実運用ケース集です。

各ケースは次の 3 点で構成します。

- 使うタイミング
- 実行コマンド
- 成功証跡

## ケース 1: 新規マシン初期セットアップ

```bash
scripts/setup-all.sh --components all --mode opt-in
scripts/verify-aios.sh
```

## ケース 2: Browser MCP スモークテスト

```bash
scripts/install-browser-mcp.sh
scripts/doctor-browser-mcp.sh
```

```text
browser_launch {"profile":"default"}
browser_navigate {"url":"https://example.com"}
browser_snapshot {}
browser_close {}
```

## ケース 3: CLI 間ハンドオフ

```bash
scripts/ctx-agent.sh --agent claude-code --prompt "現在の課題を要約"
scripts/ctx-agent.sh --agent codex-cli --prompt "checkpoint から実装を継続"
scripts/ctx-agent.sh --agent gemini-cli --prompt "リスクとテスト不足をレビュー"
```

## ケース 4: 認証ウォールの人手介入

`browser_auth_check` で `requiresHumanAction=true` の場合は手動ログイン後に継続。

## ケース 5: one-shot 監査可能フロー

```bash
scripts/ctx-agent.sh --agent codex-cli --project rex-ai-boot --prompt "最新 checkpoint から次を実行"
```

## ケース 6: Skills ライフサイクル運用

```bash
scripts/install-contextdb-skills.sh
scripts/doctor-contextdb-skills.sh
scripts/update-contextdb-skills.sh
scripts/uninstall-contextdb-skills.sh
```

## ケース 7: Shell ラッパー復旧/ロールバック

```bash
scripts/doctor-contextdb-shell.sh
scripts/update-contextdb-shell.sh
scripts/uninstall-contextdb-shell.sh
```

## ケース 8: リリース前セキュリティ確認

```bash
scripts/doctor-security-config.sh
```

最新の詳細版は英語ページを参照してください: [`/case-library/`](../case-library.md)
