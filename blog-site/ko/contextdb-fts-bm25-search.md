# ContextDB 검색 업그레이드: 기본값을 FTS5/BM25로

ContextDB 검색은 “단순 문자열(lexical) 스캔” 중심 경로에서, SQLite FTS5 + BM25 를 기본 경로로 사용하는 방식으로 업그레이드되었습니다. FTS 사용이 불가능한 로컬 런타임을 위한 호환성 폴백과, 선택적 semantic rerank 도 그대로 유지합니다.

## 왜 바꿨나

세션 히스토리가 길어질수록, 단순 lexical 스캔은 속도와 랭킹 품질 모두에서 불안정해집니다. 우리가 원했던 것은:

- 큰 이벤트 집합에서 더 빠른 검색
- 정확/준정확 매칭에 더 강한 랭킹
- 로컬 환경에서 FTS 가 없을 때도 안전한 폴백

## 현재 기본 동작

`contextdb search` 는 다음 순서로 실행됩니다.

1. SQLite FTS5 `MATCH` 쿼리
2. 인덱싱된 필드(`kind/text/refs`)에 대한 BM25 랭킹(`bm25(...)`)
3. FTS 사용 불가 시 자동 lexical 폴백

일반 사용에는 별도 마이그레이션이 필요 없습니다.

## Semantic rerank 조정

`--semantic` 을 켰을 때, rerank 는 “최근성 후보”가 아니라 “쿼리 기반 lexical 후보”에서 시작합니다.  
이로 인해 오래된 기록이라도 정확한 히트가 너무 빨리 탈락하는 확률이 줄었습니다.

## 명령어

```bash
cd mcp-server
npm run contextdb -- search --query "auth race" --project demo
npm run contextdb -- search --query "auth race" --project demo --semantic
npm run contextdb -- index:rebuild
```

## 실무 영향

- `contextdb search` 기본 관련도 향상
- 로컬 SQLite 빌드 차이에 대해 더 예측 가능한 동작
- 긴 세션에서 semantic 모드가 더 안전

장시간 세션이나 크로스-CLI 핸드오프를 운영한다면, 이 기본 경로를 추천합니다.
