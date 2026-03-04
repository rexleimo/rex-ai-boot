---
title: ContextDB
description: 5단계 흐름, SQLite 사이드카, 명령 예시.
---

# ContextDB

## 실행 5단계

1. `init`
2. `session:new / session:latest`
3. `event:add`
4. `checkpoint`
5. `context:pack`

## 예시

```bash
cd mcp-server
npm run contextdb -- init
npm run contextdb -- context:pack --session <id> --out memory/context-db/exports/<id>-context.md
npm run contextdb -- index:rebuild
```

## 컨텍스트 패킷 제어 (P0)

`context:pack`은 토큰 예산과 이벤트 필터를 지원합니다.

```bash
npm run contextdb -- context:pack \
  --session <id> \
  --limit 60 \
  --token-budget 1200 \
  --kinds prompt,response,error \
  --refs core.ts,cli.ts
```

- `--token-budget`: L2 이벤트를 추정 토큰 기준으로 제한
- `--kinds` / `--refs`: 조건에 맞는 이벤트만 포함
- 중복 이벤트는 기본적으로 제거

## 검색 명령 (P1)

```bash
npm run contextdb -- search --query "auth race" --project demo --kinds response --refs auth.ts
npm run contextdb -- timeline --session <id> --limit 30
npm run contextdb -- event:get --id <sessionId>#<seq>
npm run contextdb -- index:rebuild
```

- `index:rebuild`: `sessions/*` 기준으로 SQLite 사이드카 인덱스를 재생성합니다.

## 선택적 시맨틱 검색 (P2)

시맨틱 모드는 선택 기능이며, 사용할 수 없으면 lexical 검색으로 자동 폴백됩니다.

```bash
export CONTEXTDB_SEMANTIC=1
export CONTEXTDB_SEMANTIC_PROVIDER=token
npm run contextdb -- search --query "issue auth" --project demo --semantic
```

- `CONTEXTDB_SEMANTIC_PROVIDER=token`: 로컬 token-overlap 재정렬
- 알 수 없거나 비활성 provider는 lexical 검색으로 자동 폴백됩니다.

## 저장 레이아웃

```text
memory/context-db/
  sessions/<session_id>/*        # source of truth
  index/context.db               # SQLite sidecar (rebuildable)
```
