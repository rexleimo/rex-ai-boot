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
