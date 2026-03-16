---
title: 아키텍처
description: wrapper, runner, ContextDB 구성.
---

# 아키텍처

- `scripts/contextdb-shell.zsh`: CLI 래퍼
- `scripts/contextdb-shell-bridge.mjs`: wrap/passthrough 판단 브리지
- `scripts/ctx-agent.mjs`: 통합 러너
- `mcp-server/src/contextdb/*`: ContextDB 구현

```text
사용자 명령 -> zsh wrapper -> contextdb-shell-bridge.mjs -> ctx-agent.mjs -> contextdb CLI -> 네이티브 CLI
```

## Harness 레이어 (AIOS)

AIOS는 ContextDB 위에 운영용 harness를 제공합니다:

- `aios orchestrate`는 blueprint 기반 로컬 dispatch DAG 생성
- `dry-run`은 `local-dry-run` 사용 (토큰 비용 없음)
- `live`는 `subagent-runtime` 사용, 외부 CLI (`codex`)로 페이즈 실행 (현재 codex-cli만 지원)
- `AIOS_SUBAGENT_CLIENT=codex-cli`일 때 AIOS는 `codex exec` 구조화 출력(`--output-schema`, `--output-last-message`, stdin)을 우선 사용해 JSON handoff를 안정화합니다 (구버전 폴백).

`live`는 기본 비활성입니다. 아래 설정이 필요합니다:

- `AIOS_EXECUTE_LIVE=1`
- `AIOS_SUBAGENT_CLIENT=codex-cli`
