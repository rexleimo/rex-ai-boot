---
title: CLI 워크플로
description: 인터랙티브 모드와 one-shot 모드.
---

# CLI 워크플로

명령 단위 예시가 포함된 시나리오는 [공식 사례 라이브러리](case-library.md)를 참고하세요.

## 인터랙티브 모드

`codex` / `claude` / `gemini` 실행 시 시작 컨텍스트를 자동 주입합니다.

## one-shot 모드

```bash
scripts/ctx-agent.sh --agent codex-cli --prompt "체크포인트 기준으로 다음 작업 진행"
```

`init -> session -> event -> checkpoint -> pack` 5단계를 한 번에 실행합니다.
