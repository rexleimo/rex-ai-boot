---
title: 라우팅/병렬 프로필
description: RexCLI 라우팅과 병렬 설정을 최소 변수로 선택하는 빠른 가이드.
---

# 라우팅/병렬 프로필

환경 변수를 많이 기억하지 않으려면 이 페이지의 프리셋을 그대로 사용하세요.

## 핵심 변수

- `CTXDB_INTERACTIVE_AUTO_ROUTE`: interactive 자동 라우팅(`single/subagent/team`) 사용 여부
- `CTXDB_CODEX_DISABLE_MCP`: wrapper로 실행한 `codex`에서 MCP 시작 건너뛰기 여부
- `CTXDB_TEAM_WORKERS`: `aios team ...` 병렬 worker 수
- `AIOS_SUBAGENT_CONCURRENCY`: `aios orchestrate --execute live` 병렬 실행 수

## 권장 프리셋

### 1) 균형 기본값(권장)

```bash
export CTXDB_INTERACTIVE_AUTO_ROUTE=1
export CTXDB_CODEX_DISABLE_MCP=1
export CTXDB_TEAM_WORKERS=3
export AIOS_SUBAGENT_CONCURRENCY=3
```

### 2) 고처리량

```bash
export CTXDB_INTERACTIVE_AUTO_ROUTE=1
export CTXDB_CODEX_DISABLE_MCP=1
export CTXDB_TEAM_WORKERS=4
export AIOS_SUBAGENT_CONCURRENCY=4
```

### 3) 디버그 안정 모드

```bash
export CTXDB_INTERACTIVE_AUTO_ROUTE=0
export CTXDB_CODEX_DISABLE_MCP=1
export CTXDB_TEAM_WORKERS=1
export AIOS_SUBAGENT_CONCURRENCY=1
```

## 참고

- 변경 사항은 새 세션에서 반영됩니다(CLI 재시작 필요).
- 병렬 수는 `CTXDB_TEAM_WORKERS`와 `AIOS_SUBAGENT_CONCURRENCY`가 결정합니다.
- MCP 도구가 필요한 실행만 일시적으로:

```bash
CTXDB_CODEX_DISABLE_MCP=0 codex
```
