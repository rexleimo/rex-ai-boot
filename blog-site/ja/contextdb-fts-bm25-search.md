# ContextDB 検索アップグレード: デフォルトで FTS5/BM25

ContextDB の検索は、語彙（lexical）優先のスキャンから、SQLite の FTS5 + BM25 をデフォルトとする経路へ移行しました。互換性のためのフォールバックと、任意のセマンティック再ランクも維持しています。

## なぜ変更したのか

セッション履歴が増えるほど、単純な文字列スキャンは速度面でもランキング品質面でも不安定になります。必要だったのは次の 3 点です。

- 大量のイベント集合に対する高速な検索
- 完全一致/ほぼ一致に強いランキング
- ローカル環境で FTS が使えない場合の安全なフォールバック

## 現在のデフォルト動作

`contextdb search` は次の順序で実行されます。

1. SQLite FTS5 の `MATCH` クエリ
2. インデックス済みフィールド（`kind/text/refs`）に対する BM25（`bm25(...)`）
3. FTS が利用できない場合は自動で語彙スキャンへフォールバック

通常利用ではマイグレーション不要です。

## セマンティック再ランクの調整

`--semantic` を有効にした場合、再ランクは「直近優先の候補」ではなく、「クエリに対する語彙候補（lexical candidates）」を起点に行います。  
これにより、古いが正確なヒットが早期に落ちる確率が下がります。

## コマンド

```bash
cd mcp-server
npm run contextdb -- search --query "auth race" --project demo
npm run contextdb -- search --query "auth race" --project demo --semantic
npm run contextdb -- index:rebuild
```

## 実務上の効果

- `contextdb search` のデフォルト関連度が向上
- ローカル SQLite ビルド差異に対して予測可能な挙動
- 長期セッションでのセマンティック検索がより安全

長時間セッションやクロス CLI のハンドオフ運用を行う場合、このデフォルト経路を推奨します。
