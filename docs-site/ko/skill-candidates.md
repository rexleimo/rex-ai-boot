---
title: Skill Candidates 가이드
description: 실패한 세션에서 스킬 개선 패치를 발견, 검토, 적용하는 방법 배우기.
---

# Skill Candidates 가이드

**Skill Candidates** 는 실패한 에이전트 세션에서 추출된 자동화된 개선 제안입니다.

## 개요

에이전트 세션이 quality-gate 에 실패하면, AIOS 는 자동으로:
1. 실패 패턴 분석
2. 근본 원인 식별
3. Skill patch draft 생성
4. 리뷰를 위해 **skill candidate** 로 제시

## Skill Candidates 보기

```bash
# HUD 에서 보기
aios hud --show-skill-candidates

# Team Status 에서 보기
aios team status --show-skill-candidates

# 리스트 명령어
aios team skill-candidates list --session-id <session-id>

# JSON 출력
aios team skill-candidates list --json
```

## 패치 내보내기

```bash
# 기본 위치에 내보내기
aios team skill-candidates export

# 사용자 지정 출력 경로
aios team skill-candidates export --output-path ./patches/my-fix.md

# draft ID 로 필터
aios team skill-candidates export --draft-id <draft-id>
```

## 패치 적용

### 리뷰 프로세스

**패치 적용 전:**
1. failure class 읽기 - 무엇 이 잘못되었는지 이해
2. lesson 리뷰 - 무엇을 배웠는지
3. patch hint 확인 - 제안된 변경 사항
4. 패치가 현재 스킬에 적용 가능한지 확인

### 적용 명령어

```bash
# 특정 candidate 적용
aios skill-candidate apply <candidate-id>

# 리뷰 모드 로 적용
aios skill-candidate apply <candidate-id> --review

# 드라이런 (변경 사항 미리 보기)
aios skill-candidate apply <candidate-id> --dry-run
```

## 모범 사례

### 우선 순위

1. 고빈도 실패 (같은 실패 클래스가 여러 번)
2. 중요한 경로의 스킬 (인증, 보안, 데이터 무결성)
3. 쉬운 수정 (한 줄 수정, 명확한 개선)

### 리뷰 가이드

- **자동 적용 금지** - 모든 패치는 인간 검증 필요
- **개별 테스트** - 패치가 기존 기능을 깨뜨리지 않는지 확인
- **경쟁 확인** - 여러 패치가 같은 코드를 수정할 수 있음
- **결정 문서화** - 승인/거부 이유 기록

## 문제 해결

### 실패 세션 후 candidates 가 없음

```bash
# 수동으로 learn-eval 실행
aios learn-eval --session <session-id>
```

### 패치가 적용되지 않음

이유:
- 타겟 스킬이 변경됨
- 패치 형식이 호환되지 않음
- 충돌하는 변경

```bash
# candidate 소스 버전 확인
aios team skill-candidates list --json | jq '.[0].sourceArtifactPath'
```

## 관련 문서

- [Team Ops](team-ops.md) - Team Operations 개요
- [HUD 가이드](hud-guide.md) - HUD 를 사용한 세션 모니터링
- [ContextDB](contextdb.md) - 세션 스토리지
