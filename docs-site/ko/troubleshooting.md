---
title: 문제 해결
description: 자주 발생하는 이슈와 해결 방법.
---

# 문제 해결

## Browser MCP 도구를 사용할 수 없음

먼저 실행 (macOS / Linux):

```bash
scripts/doctor-browser-mcp.sh
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-browser-mcp.ps1
```

의존성이 부족하면 설치 스크립트 실행:

```bash
scripts/install-browser-mcp.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\install-browser-mcp.ps1
```

## `EXTRA_ARGS[@]: unbound variable`

구버전 `ctx-agent.sh`의 알려진 이슈입니다. 최신 `main`으로 업데이트하세요.

최신 버전은 `ctx-agent-core.mjs` 단일 실행 코어로 통합되어 sh/mjs 구현 드리프트를 줄였습니다.

## `search` 결과가 비어 보일 때

`memory/context-db/index/context.db`가 누락/오래된 경우:

1. `cd mcp-server && npm run contextdb -- index:rebuild`
2. `search` / `timeline` / `event:get` 재실행

## `contextdb context:pack failed`

ContextDB의 `context:pack`이 실패하면, `ctx-agent`는 **경고 후 계속 진행** 합니다 (컨텍스트 미주입 상태로 CLI 실행).

패킹 실패를 치명적으로 만들려면:

```bash
export CTXDB_PACK_STRICT=1
```

셸 래퍼(`codex`/`claude`/`gemini`)는 인터랙티브 세션이 깨지는 것을 피하기 위해 `CTXDB_PACK_STRICT=1`이 있어도 기본은 fail-open 입니다. 인터랙티브 래핑도 엄격 모드로 강제하려면:

```bash
export CTXDB_PACK_STRICT_INTERACTIVE=1
```

자주 발생하면 품질 게이트(ContextDB 회귀 체크 포함)를 먼저 실행하세요:

```bash
aios quality-gate pre-pr --profile strict
```

## `/new`(Codex) 또는 `/clear`(Claude/Gemini) 후 컨텍스트가 사라짐

`/new`와 `/clear`는 **CLI 내부 대화 상태** 를 리셋합니다. ContextDB는 디스크에 남아 있지만, 래퍼는 **CLI 프로세스 시작 시** 에만 컨텍스트 패킷을 주입합니다.

해결 방법:

1. 권장: CLI를 종료한 뒤 셸에서 `codex` / `claude` / `gemini`를 다시 실행하세요.
2. 같은 프로세스에서 계속해야 한다면: 새 대화 첫 메시지에서 아래 파일을 읽도록 요청하세요:
   - `@memory/context-db/exports/latest-codex-cli-context.md`
   - `@memory/context-db/exports/latest-claude-code-context.md`
   - `@memory/context-db/exports/latest-gemini-cli-context.md`

클라이언트가 `@file` 참조를 지원하지 않으면, 파일 내용을 첫 프롬프트로 붙여넣으세요.

## `aios orchestrate --execute live`가 막히거나 실패함

live 실행은 opt-in 입니다:

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli  # 필수 (live는 현재 codex-cli만 지원)
```

`codex`가 `PATH`에 있고 인증되어 있는지 확인하세요 (예: `codex --version`).

Windows 빠른 점검 (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-contextdb-shell.ps1
codex --version
codex
```

기대값: `stdout is not a terminal` 같은 TTY 오류가 없고, 인터랙티브 `codex` 세션이 터미널에 정상적으로 붙어야 합니다.

Tip (codex-cli): Codex CLI v0.114+는 `codex exec` 구조화 출력(`--output-schema`, `--output-last-message`, stdin)을 지원합니다. AIOS는 가능하면 자동 사용해 JSON handoff 안정성을 높입니다.

Tip: 먼저 DAG를 검증하고 싶다면 `--execute dry-run`을 사용하거나, `AIOS_SUBAGENT_SIMULATE=1`로 live 런타임을 로컬 시뮬레이션할 수 있습니다.

자주 보이는 실패 패턴:

- `type: upstream_error` / `server_error`: 업스트림 불안정. 잠시 후 재시도하세요(AIOS가 몇 번 자동 재시도합니다).
- `Timed out after 600000 ms`: `AIOS_SUBAGENT_TIMEOUT_MS`를 늘리거나(예: `900000`), `AIOS_SUBAGENT_CONTEXT_LIMIT` / `AIOS_SUBAGENT_CONTEXT_TOKEN_BUDGET`로 컨텍스트 패킷을 줄이세요.
- `invalid_json_schema` (`param: text.format.schema`): 백엔드가 구조화 출력 스키마를 거부했습니다. 최신 `main`으로 업데이트 후 재시도하세요. AIOS는 감지 시 `--output-schema` 없이도 재시도합니다.

최소 structured-output 스모크 체크(macOS/Linux):

```bash
printf '%s' 'Return a JSON object matching the schema.' | codex exec --output-schema memory/specs/agent-handoff.schema.json -
```

## 래퍼가 동작하지 않음

- ContextDB를 켜려는 워크스페이스/디렉터리 안인지 확인 (non-git 디렉터리도 가능)
- `~/.zshrc`에서 wrapper 로딩 확인
- `CTXDB_WRAP_MODE` 및 `.contextdb-enable` 확인

먼저 래퍼 진단 실행:

```bash
scripts/doctor-contextdb-shell.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-contextdb-shell.ps1
```

## `CODEX_HOME points to ".codex"` 오류

원인: `CODEX_HOME`가 상대 경로로 설정됨.

해결:

```bash
export CODEX_HOME="$HOME/.codex"
mkdir -p "$CODEX_HOME"
```

최신 래퍼는 실행 시 상대 `CODEX_HOME`를 자동 정규화합니다.

## 이 저장소 skills가 다른 프로젝트에서 보이지 않음

래퍼와 skills는 분리되어 있습니다. 전역 skills를 별도로 설치하세요:
`--client all`은 `codex` / `claude` / `gemini` / `opencode`를 함께 대상으로 합니다.

```bash
scripts/install-contextdb-skills.sh --client all
scripts/doctor-contextdb-skills.sh --client all
```

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\install-contextdb-skills.ps1 -Client all
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-contextdb-skills.ps1 -Client all
```
