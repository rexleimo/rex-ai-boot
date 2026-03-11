# Orchestrate Live が実用段階へ: Subagent Runtime を追加

`aios orchestrate` を「blueprint + dry-run の安全なハーネス」として使っている場合、今回の更新で `subagent-runtime` による live 実行が利用できるようになりました。

## 何が変わったか

以前:

- `--execute dry-run` は DAG 生成と handoff のローカル模擬のみ (0 トークン)
- `--execute live` は gate があるだけで、実行自体は stub に近い

現在:

- `--execute live` が `codex` / `claude` / `gemini` の CLI 経由で各フェーズを実行
- 並列フェーズは `AIOS_SUBAGENT_CONCURRENCY` で並列度を制御
- merge-gate が JSON handoff を検証し、ファイル所有権の衝突をブロック

## 使い方 (opt-in)

live 実行はデフォルト無効です:

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli  # または claude-code, gemini-cli
aios orchestrate --session <session-id> --dispatch local --execute live --format json
```

Tip (codex-cli): Codex CLI v0.114+ は `codex exec` の構造化出力 (`--output-schema`, `--output-last-message`, stdin) をサポートします。AIOS は利用可能なら自動で使用し、JSON handoff を安定化します。

## よく使う環境変数

- `AIOS_SUBAGENT_CONCURRENCY` (default: `2`)
- `AIOS_SUBAGENT_TIMEOUT_MS` (default: `600000`)
- `AIOS_SUBAGENT_CONTEXT_LIMIT` (default: `30`)
- `AIOS_SUBAGENT_CONTEXT_TOKEN_BUDGET` (optional)

注意:

- `dry-run` はモデル呼び出しなし
- `live` は選択した CLI を呼ぶため、トークン/コストはそのクライアント依存です
