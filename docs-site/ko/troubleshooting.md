---
title: 문제 해결
description: 자주 발생하는 이슈와 해결 방법.
---

# 문제 해결

## Browser MCP 도구를 사용할 수 없음

먼저 실행:

```bash
scripts/doctor-browser-mcp.sh
```

의존성이 부족하면 실행:

```bash
scripts/install-browser-mcp.sh
```

## `EXTRA_ARGS[@]: unbound variable`

구버전 `ctx-agent.sh`의 알려진 이슈입니다. 최신 `main`으로 업데이트하세요.

## 래퍼가 동작하지 않음

- git 저장소 내부인지 확인
- `~/.zshrc`에서 wrapper 로딩 확인
- `CTXDB_WRAP_MODE` 및 `.contextdb-enable` 확인
