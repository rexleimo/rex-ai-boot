---
title: ContextDB
description: 5단계 흐름, SQLite 사이드카, 명령 예시.
---

# ContextDB 런타임

## 빠른 답변 (AI 검색)

ContextDB는 다중 CLI agent를 위한 파일시스템 세션 계층입니다. 프로젝트별로 이벤트, 체크포인트, 재개 가능한 컨텍스트 패킷을 저장하며高速 검색를 위해 SQLite 사이드카 인덱스를 사용합니다.

## 표준 5단계

런타임에 ContextDB는 다음 시퀀스를 실행할 수 있습니다:

1. `init` - DB 폴더와 사이드카 인덱스 존재 확인.
2. `session:new` 또는 `session:latest` - `agent + project`별로 세션 해석.
3. `event:add` - user/model/tool 이벤트 저장.
4. `checkpoint` - 단계 요약, 상태, 다음 작업 기록.
5. `context:pack` - 다음 CLI 호출용 markdown 패킷 내보내기.

## 인터랙티브 vs 원샷

- 인터랙티브 모드는 보통 CLI 열기 전에 단계 `1, 2, 5`를 실행.
- 원샷 모드는 `1..5`를 단일 명령으로 실행.

## Fail-Open Packing

`contextdb context:pack`이 실패하면, `ctx-agent`는 **경고 후 계속 진행** 합니다 (컨텍스트 미주입 상태로 CLI 실행).

패킹 실패를 치명적으로 만들려면:

```bash
export CTXDB_PACK_STRICT=1
```

셸 래퍼(`codex`/`claude`/`gemini`)는 기본이 fail-open이며, `CTXDB_PACK_STRICT=1`을 설정해도 인터랙티브 세션이 직접 망가지지 않도록 합니다. 래퍼 층도 엄격하게执法하려면:

```bash
export CTXDB_PACK_STRICT_INTERACTIVE=1
```

## 수동 명령 예시

```bash
cd mcp-server
npm run contextdb -- init
npm run contextdb -- session:new --agent codex-cli --project demo --goal "implement feature"
npm run contextdb -- event:add --session <id> --role user --kind prompt --text "start"
npm run contextdb -- checkpoint --session <id> --summary "phase done" --status running --next "write tests|implement"
npm run contextdb -- context:pack --session <id> --out memory/context-db/exports/<id>-context.md
npm run contextdb -- index:sync --stats --jsonl-out memory/context-db/exports/index-sync-stats.jsonl
npm run contextdb -- index:rebuild
```

## Workspace Memory (`aios memo`)

CLI 흐름 안에서 지속적인 운영자 메모를 관리하려면 `aios memo`를 사용하세요.

저장 경계:

- `memo add/list/search`는 ContextDB `workspace-memory--<space>` 세션에 memo 이벤트를 기록/조회
- `memo recall`은 ContextDB `recall:sessions`를 호출해 프로젝트 단위 교차 세션 회상을 수행
- `memo pin show/set/add`는 `memory/context-db/sessions/workspace-memory--<space>/pinned.md`를 읽고 씁니다
- `memo persona ...`와 `memo user ...`는 전역 파일 레이어를 사용합니다 (기본값: `~/.aios/SOUL.md`, `~/.aios/USER.md`)

예시:

```bash
aios memo use release-train
aios memo add "Need strict pre-PR gate before merge #quality"
aios memo pin add "Never run destructive git commands without explicit approval."
aios memo list --limit 10
aios memo search "pre-PR" --limit 5
aios memo recall "release gate" --limit 5
aios memo persona init
aios memo persona add "Response style: concise, direct, evidence-first"
aios memo user init
aios memo user add "Preferred language: zh-CN + technical English terms"
```

## 레이지 로드 시작 (P0) {#lazy-load}

ContextDB는 이제 인터랙티브 CLI 세션을 위한 **레이지 로드 모드**를 지원합니다. 매번 시작할 때 전체 `context:pack`을 실행하는 대신(2~5초), 래퍼가 경량 캐시된 퍼사드(< 50ms)를 로드하고 에이전트가 필요할 때 메모리를 자율 발견하도록 합니다.

### 작동 방식

1. **빠른 퍼사드 읽기** — 시작 시 `memory/context-db/.facade.json`(캐시된 세션 요약)을 로드합니다.
2. **작은 프롬프트 주입** — 150토큰 미만의 퍼사드 프롬프트를 주입하여 에이전트에게 다음을 알려줍니다:
   - ContextDB가 존재함
   - 전체 기록을 찾을 위치
   - 언제 로드할지
3. **백그라운드 부트스트랩** — 분리된 프로세스를 포크하여 전체 컨텍스트 패킷을 비동기적으로 재구축합니다.
4. **런타임 에이전트 트리거** — 에이전트가 사용자 턴을 수신하면 세 가지 신호를 단락 순서로 평가합니다:
   - **A. 의도 감지** — "remember", "之前", "continue", "resume" 등의 키워드
   - **B. 작업 복잡도** — 다단계, 교차 도메인, orchestrate/team 언어
   - **C. RL 정책 게이트** — 학습된 로드 결정을 위한 향후 `rl-core` 통합

### 활성화 / 비활성화

레이지 로드는 인터랙티브 세션에서 **기본 ON**입니다.

```bash
# 옵트아웃 (매 시작 시 즉시 패킹)
export CTXDB_LAZY_LOAD=0

# 명시적으로 옵트인
export CTXDB_LAZY_LOAD=1
```

원샷 모드(`--prompt`)는 이 설정과 관계없이 항상 즉시 경로를 사용합니다.

### 퍼사드 JSON

퍼사드 사이드카는 각 성공적인 패킹 후 자동 생성됩니다:

```json
{
  "version": 1,
  "generatedAt": "2026-04-19T10:00:00Z",
  "ttlSeconds": 3600,
  "sessionId": "claude-code-20260419T095454-e6eb600d",
  "goal": "Shared context session for claude-code on aios",
  "status": "running",
  "lastCheckpointSummary": "...",
  "keyRefs": ["scripts/ctx-agent-core.mjs"],
  "contextPacketPath": "memory/context-db/exports/latest-claude-code-context.md",
  "hasStalePack": false
}
```

퍼사드가 누락되었거나 만료된 경우, 최신 세션 헤더에서 새 퍼사드를 생성하는 폴리백이 실행됩니다.

## 패킷 제어 (P0)

`context:pack`은 토큰 예산과 이벤트 필터를 지원합니다:

```bash
npm run contextdb -- context:pack \
  --session <id> \
  --limit 60 \
  --token-budget 1200 \
  --kinds prompt,response,error \
  --refs core.ts,cli.ts
```

- `--token-budget`: 추정 토큰수로 L2 이벤트 볼륨 제한.
- `--kinds` / `--refs`: 일치하는 이벤트만 포함.
- 기본적으로 중복 이벤트 제외(de-dup)가 활성화.

## 검색 명령 (P1)

ContextDB는 SQLite 사이드카 인덱스를 지원하는 검색을 제공합니다:

```bash
npm run contextdb -- search --query "auth race" --project demo --kinds response --refs auth.ts
npm run contextdb -- timeline --session <id> --limit 30
npm run contextdb -- event:get --id <sessionId>#<seq>
npm run contextdb -- index:sync --stats
npm run contextdb -- index:rebuild
```

- `search`: 인덱스된 이벤트 쿼리.
- `timeline`: 이벤트/체크포인트 병합 피드.
- `event:get`: 안정적 ID로 특정 이벤트 조회.
- `index:sync`: 세션 원본 파일에서 사이드카로 증분 동기화.
- `index:rebuild`: sessions/* 파일에서 SQLite 사이드카 재구축.
- 기본 랭킹 경로: SQLite FTS5 `MATCH` + `bm25(...)` (kind/text/refs 대상).
- 호환성 폴백: FTS 사용 불가 시, search는 자동으로 어휘 매칭으로 폴백.

## 증분 동기화 + refs 정규화 (P1.5)

ContextDB는 SQLite에 정규화된 `event_refs` 테이블을 유지합니다.  
`--refs` 필터는 이 테이블의 정규화 refs 정확 일치를 사용하므로, 부분 문자열 매칭으로 인한 오탐을 줄입니다.

```bash
npm run contextdb -- index:sync --stats
npm run contextdb -- index:sync --force --stats
npm run contextdb -- index:sync --stats --jsonl-out memory/context-db/exports/index-sync-stats.jsonl
```

- `--stats`: sessions/events/checkpoints의 `scanned/upserted`, 소요 시간, throttle skip, force 플래그를 출력.
- `--jsonl-out`: 실행마다 JSON 레코드 1줄(타임스탬프 포함)을 추가해 추세 분석에 사용.
- sidecar 누락/손상 또는 스키마 전체 재구축이 필요할 때만 `index:rebuild` 사용.

## refs 쿼리 성능 벤치마크

refs 쿼리 지연을 추적하고 회귀를 gate 하려면 다음 스크립트를 사용하세요.

```bash
cd mcp-server
npm run bench:contextdb:refs -- --events 2000 --refs-pool 200 --queries 300 --warmup 30 --json-out test-results/contextdb-refs-bench.local.json
npm run bench:contextdb:refs:ci
npm run bench:contextdb:refs:gate
```

- `bench:contextdb:refs`: 로컬에서 데이터셋을 조정할 수 있는 벤치마크.
- `bench:contextdb:refs:ci`: CI 표준 데이터셋 프로필.
- `bench:contextdb:refs:gate`: 지연/히트율 임계값을 만족하지 못하면 실패.

## 선택적 시맨틱 검색 (P2)

시맨틱 모드는 선택적 기능이며, 사용 불가 시 자동으로 어휘 검색으로 폴백합니다.

```bash
export CONTEXTDB_SEMANTIC=1
export CONTEXTDB_SEMANTIC_PROVIDER=token
npm run contextdb -- search --query "issue auth" --project demo --semantic
```

- `--semantic`: 시맨틱 리랭킹 요청.
- `CONTEXTDB_SEMANTIC_PROVIDER=token`: 로컬 token overlap 리랭킹, 네트워크 호출 없음.
- 알 수 없거나 비활성 provider는 자동으로 어휘 쿼리 경로로 폴백.
- 시맨틱 리랭킹은 "현재 쿼리의 어휘 후보 세트"에서 실행되므로, 최근 이벤트만 샘플링하는 것보다 오래된 완전 일치가 기본적으로 드롭되는 것을 줄입니다.

## 저장 레이아웃

ContextDB는 진릿 데이터를 세션 파일에 저장하고, 속도를 위해 사이드카 인덱스를 사용합니다:

```text
memory/context-db/
  sessions/<session_id>/*        # 진릿 데이터 (source of truth)
  index/context.db               # SQLite 사이드카 (재구축 가능)
  index/sessions.jsonl           # 호환성 인덱스
  index/events.jsonl             # 호환성 인덱스
  index/checkpoints.jsonl        # 호환성 인덱스
```

## 세션 ID 형식

세션 ID는 다음 형식을 사용합니다:

`<agent>-<YYYYMMDDTHHMMSS>-<random>`

이를 통해 시간 순서가 명확하고 충돌을 피할 수 있습니다.

## FAQ

### ContextDB는 클라우드 데이터베이스인가요?

아닙니다. 기본적으로 워크스페이스 아래의 로컬 파일시스템에 저장합니다.

### `/new` (Codex)이나 `/clear` (Claude/Gemini) 후에 컨텍스트가 사라지는 이유는?

이 명령들은 **CLI 내부 대화 상태**를 리셋합니다. ContextDB의 데이터는 디스크에 남아 있지만, 래퍼가 컨텍스트 패킷을 주입하는 것은 **CLI 프로세스 시작 시**뿐입니다.

복구 방법:

- 권장: CLI를 종료한 뒤 셸에서 `codex` / `claude` / `gemini`를 다시 실행 (래퍼가 다시 `context:pack` 후 주입).
- 같은 프로세스에서 계속해야 한다면: 새 대화 첫 메시지에서 최신 스냅샷을 읽도록 요청:
  - `@memory/context-db/exports/latest-codex-cli-context.md`
  - `@memory/context-db/exports/latest-claude-code-context.md`
  - `@memory/context-db/exports/latest-gemini-cli-context.md`

클라이언트가 `@file` 참조를 지원하지 않으면, 파일 내용을 첫 프롬프트로 붙여넣으세요.

### Codex, Claude, Gemini는 컨텍스트를 공유하나요?

네. 같은 래핑된 워크스페이스에서 실행되면 (git 루트를 사용할 수 있으면 같은 git 루트, 없으면 같은 현재 디렉터리), 같은 `memory/context-db/`를 사용합니다.

### CLI 간 작업을 인계하려면 어떻게 하나요?

동일한 프로젝트 세션을 유지하고, 다음 CLI 실행 전에 `context:pack`을 실행하세요.
