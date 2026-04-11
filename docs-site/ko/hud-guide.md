---
title: HUD 사용자 가이드
description: HUD(Heads-Up Display) 를 사용하여 에이전트 세션을 모니터링하는 완전한 가이드.
---

# HUD 사용자 가이드

HUD(Heads-Up Display) 는 에이전트 세션 상태, dispatch 결과, 개선 기회를 실시간으로 가시화합니다.

## HUD 사용 시기

- **장기 실행 작업**: 에이전트를 방해하지 않고 진행 상황 모니터링
- **실패 디버깅**: quality-gate 결과와 hindsight 분석 확인
- **스킬 개선**: skill candidate 패치 발견 및 적용
- **팀 조정**: 여러 동시 세션 추적

## HUD 모드

### Minimal 모드

장기 실행 세션의 워치에 최적:
- 기본 상태만 표시
- 빠른 새로고침 (1 초 데이터 폴링)
- 리소스 사용 줄이는 적응형 간격

```bash
aios hud --watch --preset minimal --fast
```

### Compact 모드

터미널 친화적인 요약:
- 세션 목표
- Dispatch 요약
- Quality-gate 상태

```bash
aios hud --preset compact
```

### Focused 모드 (기본값)

대부분의 사용 사례에 적합한 균형:
- 모든 compact 정보
- 최근 dispatch artifacts
- Skill candidate hints

```bash
aios hud --preset focused
```

### Full 모드

완전한 진단:
- 모든 focused 정보
- 완전한 hindsight 분석
- Quality-gate 세부 정보
- Fix hints 와 권장 사항

```bash
aios hud --preset full
```

## 기본 사용법

### 현재 세션 보기

```bash
# 기본 focused 뷰
aios hud

# 프로바이더 지정
aios hud --provider claude
aios hud --provider gemini
```

### 워치 모드

```bash
# 지속적 모니터링 (1 초 새로고침)
aios hud --watch

# 사용자 지정 간격 (밀리초)
aios hud --watch --interval-ms 2000

# 적응형 간격과 빠른 모드
aios hud --watch --fast
```

### 세션 지정

```bash
# 세션 ID 로
aios hud --session <session-id>
```

### JSON 출력

```bash
# 기계 판독 출력
aios hud --json

# jq 로 필터링
aios hud --json | jq '.selection.qualityGate'
```

## Skill Candidate 기능

### Skill Candidates 보기

```bash
# HUD 에 candidates 인라인 표시
aios hud --show-skill-candidates

# 상세 뷰 (candidates 만, HUD 없음)
aios hud --show-skill-candidates --skill-candidate-view detail

# 후보 수 제한 (1-20)
aios hud --show-skill-candidates --skill-candidate-limit 10
```

### 패치 템플릿 내보내기

```bash
# 기본 위치에 내보내기
aios hud --export-skill-candidate-patch-template

# 특정 draft ID 필터와 함께 내보내기
aios hud --export-skill-candidate-patch-template --draft-id <draft-id>
```

**출력 위치**: `memory/context-db/sessions/<session-id>/artifacts/skill-candidate-patch-template-<timestamp>.md`

## 문제 해결

### HUD 에 오래된 데이터 표시

```bash
# 워치 재시작하여 강제 새로고침
aios hud --watch --interval-ms 500
```

### Skill Candidates 가 표시되지 않음

가능한 이유:
- 세션이 선택되지 않음 (`--session` 사용)
- 세션에 quality-gate 실패 없음
- Learn-eval 이 아직 실행되지 않음

```bash
# quality-gate 실패 확인
aios hud --json | jq '.selection.qualityGate'
```

## 관련 문서

- [Team Ops](team-ops.md) - Team Operations 개요
- [Skill Candidates](skill-candidates.md) - 패치 이해 및 적용
- [ContextDB](contextdb.md) - 세션 스토리지
