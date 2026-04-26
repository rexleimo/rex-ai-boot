---
title: "Solo Harness: 1つの Agent を夜通し動かしても制御を失わない"
description: "AIOS 1.7 で `aios harness` を追加。run journal、status/stop/resume 制御、HUD 表示、任意の worktree 分離を備えた再開可能な単一 Agent 実行を提供します。"
date: 2026-04-26
tags: ["AIOS", "Solo Harness", "単一 Agent", "ContextDB", "自動化"]
---

# Solo Harness: 1つの Agent を夜通し動かしても制御を失わない

多くの coding CLI は短い prompt を処理するのは得意ですが、「1つの目的に対して数時間、あるいは自分が寝ている間も作業を続ける」という使い方になると、途端に運用しづらくなります。端末を離れた瞬間に、可視性、停止制御、そしてスムーズな再開が失われがちです。

AIOS 1.7 で追加した `aios harness` は、そのための単一 Agent 長時間実行レーンです。

## ワンショット CLI ループの弱点

- 短い依頼には向いていても、無人の単一目的実行には向きません。
- 数時間後に Agent が何をしたのか追いづらくなります。
- 止めたいときに、安全な境界まで待つのではなく強制中断になりがちです。
- 再開時にコンテキストと operator 意図を手で組み直すことが多いです。
- メイン checkout で直接走らせると、扱いにくい diff が残りやすくなります。

## `aios harness` で追加されたもの

`aios harness` は、「1つの Agent が1つの目的を継続して進める」ための再開可能な operator loop を提供します。

- `run` - session を開始し、目的を記録します。
- `status` - 最新の構造化状態と artifact を確認します。
- `stop` - 次の安全な境界で停止するよう要求します。
- `resume` - 新しい run を作り直さず、同じ session を再開します。
- `hud` - solo harness session を自動認識し、最新サマリを表示します。
- `--worktree` - 夜間実行の変更を破棄可能な git worktree に隔離します。

## クイックスタート

```bash
# 分離された worktree で夜間実行を開始
aios harness run --objective "明朝の引き継ぎメモをまとめる" --session nightly-demo --worktree

# 構造化ステータスを確認
aios harness status --session nightly-demo --json

# HUD で同じ session を監視
aios hud --session nightly-demo --json

# 安全な境界で停止するよう依頼
aios harness stop --session nightly-demo --reason "朝に人が引き継ぐ"

# 後で同じ session を再開
aios harness resume --session nightly-demo
```

token を使う前に artifact 契約を確認したい場合は、まず dry-run を使います。

```bash
aios harness run --objective "明朝の引き継ぎメモをまとめる" --session nightly-demo --worktree --dry-run --json
```

## 実行中に書き出されるもの

各 session の run journal は次に保存されます。

```text
memory/context-db/sessions/<session-id>/artifacts/solo-harness/
```

主なファイル:

- `objective.md` - 正規化された目的。
- `run-summary.json` - 現在の状態、反復回数、backoff 状態、worktree メタデータ。
- `control.json` - operator の停止要求とメモ。
- `iteration-0001.json` - 各反復の正規化済み結果。
- `iteration-0001.log.jsonl` - デバッグ用の生ログストリーム。

翌朝引き継ぐときに、曖昧な「昨夜しばらく動いていた」ではなく、読み取れる run journal が残ります。

## なぜ `--worktree` が重要か

夜間実行の後始末を、乱暴な `git reset --hard` に頼るべきではありません。

`--worktree` を付けると、AIOS は harness session 用の分離 git worktree を作成し、Agent がメイン checkout を直接汚さないようにします。成果がなければ一時 worktree は掃除できますし、価値のある変更が出た場合は、worktree メタデータが run summary に残るため、レビューとマージに引き継げます。

## Solo Harness / Agent Team / Orchestrate の使い分け

| 必要なもの | 向いている選択 |
|---|---|
| 1つの目的・1つの provider・再開可能な夜間実行 | `aios harness ...` |
| 明確に分割できるタスクの並列 worker | `aios team ...` |
| preflight gate 付きの段階的オーケストレーション | `aios orchestrate ...` |

要するに、この仕事を1つの Agent に持たせ続けたいなら Solo Harness、最初から複数 worker を束ねるなら別ルートです。

## 関連ドキュメント

- [Solo Harness ドキュメント](https://cli.rexai.top/ja/solo-harness/)
- [HUD ガイド](https://cli.rexai.top/ja/hud-guide/)
- [Agent Team ガイド](https://cli.rexai.top/ja/team-ops/)
- [ユースケース集](https://cli.rexai.top/ja/use-cases/)
