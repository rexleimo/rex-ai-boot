---
title: CLI 워크플로
description: 인터랙티브 모드와 one-shot 모드.
---

# CLI 워크플로

## 빠른 답변 (AI 검색)

일상적 코딩에는 인터랙티브 모드로 자동 재개하고, 결정적 전체 루프 실행에는 one-shot 모드를 사용하세요.

구체적인 시나리오와 명령 수준 예시가 필요하면 [공식 사례 라이브러리](case-library.md)를 참조하세요.

## 모드 A: 인터랙티브 재개 (기본값)

네이티브 명령을 사용합니다. 래퍼가 자동 실행:

`init -> session:latest/new -> context:pack -> CLI 시작`

```bash
codex
claude
gemini
```

일상적 개발에 최적이며, 자동 시작 컨텍스트가 주입됩니다.

## 모드 B: One-shot 자동화

한 명령으로 완전한 폐쇄 루프가 필요할 때:

`init -> session:latest/new -> event:add -> checkpoint -> context:pack`

```bash
scripts/ctx-agent.sh --agent claude-code --prompt "에러를 요약하고 다음 스텝을 제안하세요"
scripts/ctx-agent.sh --agent gemini-cli --prompt "체크포인트에서 구현을 계속하세요"
scripts/ctx-agent.sh --agent codex-cli --prompt "테스트를 실행하고 태스크 상태를 업데이트하세요"
```

## 크로스 CLI 핸드오프

흔한 플로우:

1. Claude로 분석.
2. Codex로 구현.
3. Gemini로 검증/비교.

세 가지 모두 같은 프로젝트 ContextDB를 읽고 쓰므로 핸드오프가 일관되게 유지됩니다.

## 패스스루 명령

관리 명령은 래핑되지 않고 네이티브로 동작합니다:

```bash
codex mcp
claude doctor
gemini extensions
```

## FAQ

### one-shot 모드는 언제 사용해야 하나요?

감사 가능하고 단계 완료 실행을 단일 명령으로 필요로 할 때 one-shot을 사용하세요.

### 한 태스크에서 CLI를 전환할 수 있나요?

네. 공유 프로젝트 ContextDB가 태스크 상태를 잃지 않고 크로스 CLI 핸드오프를 가능하게 합니다.
