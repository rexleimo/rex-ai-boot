---
title: 공식 사례 라이브러리
description: rex-ai-boot로 실제로 무엇을 할 수 있는지 재현 가능한 명령 기준으로 정리.
---

# 공식 사례 라이브러리

이 페이지는 `rex-ai-boot`의 대표 운영 시나리오 모음입니다.

각 사례는 다음 3가지를 포함합니다.

- 사용 시점
- 실행 명령
- 성공 증거

## 사례 1: 신규 환경 5분 초기 설정

```bash
scripts/setup-all.sh --components all --mode opt-in
scripts/verify-aios.sh
```

## 사례 2: Browser MCP 스모크 테스트

```bash
scripts/install-browser-mcp.sh
scripts/doctor-browser-mcp.sh
```

```text
browser_launch {"profile":"default"}
browser_navigate {"url":"https://example.com"}
browser_snapshot {}
browser_close {}
```

## 사례 3: CLI 간 핸드오프

```bash
scripts/ctx-agent.sh --agent claude-code --prompt "현재 이슈와 다음 단계 요약"
scripts/ctx-agent.sh --agent codex-cli --prompt "checkpoint 기준으로 구현 진행"
scripts/ctx-agent.sh --agent gemini-cli --prompt "리스크와 테스트 누락 검토"
```

## 사례 4: 인증 벽 Human-in-the-loop

`browser_auth_check` 결과가 `requiresHumanAction=true`면 수동 로그인 후 이어서 자동화합니다.

## 사례 5: one-shot 감사 가능한 실행 체인

```bash
scripts/ctx-agent.sh --agent codex-cli --project rex-ai-boot --prompt "최신 checkpoint에서 다음 작업 실행"
```

## 사례 6: Skills 라이프사이클 운영

```bash
scripts/install-contextdb-skills.sh
scripts/doctor-contextdb-skills.sh
scripts/update-contextdb-skills.sh
scripts/uninstall-contextdb-skills.sh
```

## 사례 7: Shell 래퍼 복구/롤백

```bash
scripts/doctor-contextdb-shell.sh
scripts/update-contextdb-shell.sh
scripts/uninstall-contextdb-shell.sh
```

## 사례 8: 릴리스 전 보안 점검

```bash
scripts/doctor-security-config.sh
```

최신 상세판은 영어 페이지를 참고하세요: [`/case-library/`](../case-library.md)
