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

## Context Pack Fail-Open

`contextdb context:pack`이 실패하면, `ctx-agent`는 **경고 후 계속 진행** 합니다 (컨텍스트 미주입 상태로 CLI 실행).

패킹 실패를 치명적으로 만들려면:

```bash
export CTXDB_PACK_STRICT=1
```

셸 래퍼(`codex`/`claude`/`gemini`)는 인터랙티브 세션이 깨지는 것을 피하기 위해 `CTXDB_PACK_STRICT=1`이 있어도 기본은 fail-open 입니다. 인터랙티브 래핑도 엄격 모드로 강제하려면:

```bash
export CTXDB_PACK_STRICT_INTERACTIVE=1
```

## `/new`(Codex) / `/clear`(Claude/Gemini) 후 컨텍스트가 사라짐

이 명령들은 **CLI 내부 대화 상태** 를 리셋합니다. ContextDB 데이터는 디스크에 남아 있지만, 래퍼는 **CLI 프로세스 시작 시** 에만 컨텍스트 패킷을 주입합니다.

복구 방법:

- 권장: CLI를 종료한 뒤 셸에서 `codex` / `claude` / `gemini`를 다시 실행(다시 `context:pack` 후 주입)
- 같은 프로세스에서 계속해야 한다면: 새 대화 첫 메시지에서 최신 스냅샷을 읽도록 요청:
  - `@memory/context-db/exports/latest-codex-cli-context.md`
  - `@memory/context-db/exports/latest-claude-code-context.md`
  - `@memory/context-db/exports/latest-gemini-cli-context.md`

클라이언트가 `@file` 참조를 지원하지 않으면, 파일 내용을 첫 프롬프트로 붙여넣으세요.

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
