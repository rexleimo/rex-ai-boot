---
title: Superpowers
description: CLI를 더 똑똑하게 만드는 재사용 가능한 자동화 스킬.
---

# Superpowers

Superpowers는 재사용 가능한 자동화 스킬입니다. Claude Code, Codex, Gemini CLI, OpenCode에 후킹해서 반복 작업을 자동 처리합니다.

## 핵심 특징

- **자동 계획** - 요구사항을 실행 가능한 스텝으로 자동 분해
- **병렬分发** - 독립 태스크 식별, 여러 서브태스크 병렬 실행
- **스마트 검증** - 완료 전에 결과 자동 검증, 추측に頼:X

## 있는 스킬들

### brainstorming

창작 작업 시작 전에 의도를 명확히.

- 프로젝트 컨텍스트 탐색
- 명확한 질문 하나씩
- 접근법 제안과 트레이드오프
- 코드 전에 디자인 제시하고 승인 구하기

**쓰는 때**: 새 기능 개발, 페이지 디자인, 기능 추가.

### writing-plans

요구사항을 실행 가능한 계획으로 변환.

- 요구사항 분석
- 순차적 스텝으로 분해
- 의존성 파악
- 상세 계획 문서 출력

**쓰는 때**: 명세나 다단계 태스크가 있고 로드맵 필요할 때.

### dispatching-parallel-agents

여러 독립 태스크를 병렬로 실행.

- 독립 워크플로 식별
- 병렬 agents 기동
- 결과 취합
- 실패 적절히 처리

**쓰는 때**: 2개 이상 공유 상태 없는 태스크를 동시에 돌리고 싶을 때.

### verification-before-completion

검증 없이 완료라고 말하지 마.

- 검증 명령 실행
- 출력이 기대대로인지 확인
- 구체적 증거가 있어야 성공

**쓰는 때**: 기능 완료, 버그 수정, PR 생성 전.

### systematic-debugging

추측 아니라 증거로 버그 고치기.

- 증상과 에러 메시지 수집
- 가설 형성
- 체계적으로 테스트
- 수정 검증

**쓰는 때**: 테스트 실패, 크래시, 예상치 못한 동작 마주했을 때.

### security-scan

자동화 전에 설정 보안 문제 체크.

- skills, hooks, MCP 설정 스캔
- 노출된 시크릿 식별
- 수정 제안

**쓰는 때**: 자동화 활성화나 설정 변경 시.

##使い方

1. Superpowers 필요하면 자연스럽게 말해
2. AI가 스킬 호출하고 네비게이트
3. 결과는 프로젝트 메모리에 저장

## 예

```
brainstorming으로 이 기능怎么做/
writing-plans으로 이 요구사항을 단계로 나누기
dispatching-parallel-agents로 这些任务并发执行
verification-before-completion으로 완료 전에 검증
```

## 더 보기

- [사례 집합](case-library.md) - 실사용례
- [ContextDB](contextdb.md) - 기억이 세션을跨는 방식
