---
title: Agent Team & HUD
description: HUD 대시보드와 Team Ops 상태 추적으로 멀티 에이전트 협업을 모니터링하고 관리하세요.
---

# Agent Team 과 HUD

AIOS 는 **Team Operations (Team Ops)** 를 제공합니다 — Codex CLI, Claude Code, Gemini CLI 세션 전체의 멀티 에이전트 협업을 모니터링하고 관리하기 위한 도구 세트.

## 개요

Team Ops 를 통해 다음을 확인할 수 있습니다:
- **실시간 세션 상태** HUD (Heads-Up Display) 를 통해
- **히스토리 세션 분석** quality-gate 추적과 함께
- **스킬 개선 기회** skill candidates 를 통해
- **Dispatch hindsight** 실패한 실행 디버깅용

## 빠른 시작

### 현재 세션 상태 보기

```bash
# 현재 세션의 최소 HUD
aios hud

# 워치 모드와 전체 상세 정보
aios hud --watch --preset full

# 프로바이더와 세션 지정
aios hud --provider codex --session <session-id>
```

### Team Status 와 History

```bash
# 팀 상태를 실시간으로 모니터링
aios team status --provider codex --watch

# 세션 히스토리 보기 (최근 20 회 실행)
aios team history --provider codex --limit 20
```

## 주요 구성 요소

### HUD (Heads-Up Display)

HUD 는 단일 세션의 실시간 대시보드를 제공합니다:
- 현재 작업 목표
- Dispatch 상태 (ジョブ 실행됨, 블록됨, 보류 중)
- Quality-gate 결과
- Skill candidate 가용성
- Hindsight 분석 (실패 패턴, 회귀)

**HUD Presets:**
| Preset | 사용 사례 |
|--------|----------|
| `minimal` | 장기간 워치 세션 |
| `compact` | 터미널 친화적인 요약 |
| `focused` (기본값) | 균형 잡힌 상세 정보 |
| `full` | 전체 진단 |

### Team Status

프로바이더의 모든 최근 세션의 집계 상태를 표시:
- 활성화 vs 완료 세션
- 성공/실패율
- Quality-gate 요약
- 주요 skill candidates

### Team History

과거 세션의 히스토리 분석:
- Dispatch 결과
- 카테고리별 quality-gate 실패
- Hindsight 패턴 (반복 실패, 회귀)
- Fix hints 와 권장 사항

## Skill Candidates

**Skill Candidates** 는 실패한 세션에서 추출된 자동화된 개선 제안:

1. 세션이 quality-gate 에 실패
2. Learn-eval 이 실패 패턴 분석
3. Skill patch draft 생성
4. 당신이 검토하고 패치 적용

### Skill Candidates 보기

```bash
# 현재 세션의 candidates 보기
aios team status --show-skill-candidates

# skill candidate 상세 뷰와 함께 HUD
aios hud --show-skill-candidates --skill-candidate-view detail

# 특정 세션의 candidates 리스트
aios team skill-candidates list --session-id <session-id>
```

### 패치 내보내기 및 적용

```bash
# 패치 템플릿을 artifact 파일로 내보내기
aios team status --export-skill-candidate-patch-template

#カスタム 출력 경로로 내보내기
aios team skill-candidates export --output-path ./my-patch.md

# skill candidate 패치 적용
aios skill-candidate apply <candidate-id>
```

### Draft ID 로 필터

```bash
# draft ID 로 skill candidates 필터
aios team status --show-skill-candidates --draft-id <draft-id>

# draft 필터와 함께 HUD
aios hud --show-skill-candidates --draft-id <draft-id>
```

## Quality-Gate 필터

quality-gate 결과로 히스토리 필터:

```bash
# 실패한 세션만 표시
aios team history --quality-failed-only

# 특정 카테고리로 필터
aios team history --quality-category clarity
aios team history --quality-category sample.latency-watch

# 카테고리 접두사로 필터 ( cualquiera 일치)
aios team history --quality-category-prefix clarity,sample

# 접두사로 필터 (모두 일치)
aios team history --quality-category-prefixes clarity,dispatch --prefix-mode all
```

## 명령어 참조

### `aios hud`

| 옵션 | 기본값 | 설명 |
|--------|---------|-------------|
| `--session-id` | current | 타겟 세션 ID |
| `--provider` | codex | 프로바이더 (codex/claude/gemini) |
| `--preset` | focused | HUD preset (minimal/compact/focused/full) |
| `--watch` | false | 지속적 모니터링 |
| `--fast` | false | 빠른 모드 (데이터 감소) |
| `--show-skill-candidates` | false | skill candidate 상세 정보 표시 |
| `--skill-candidate-limit` | 6 | 표시할 최대 candidates (1-20) |
| `--skill-candidate-view` | inline | 뷰 모드 (inline/detail) |
| `--export-skill-candidate-patch-template` | false | 패치 artifact 내보내기 |
| `--draft-id` | - | draft ID 로 필터 |
| `--json` | false | JSON 으로 출력 |
| `--interval-ms` | 1000 | 워치 새로고침 간격 |

### `aios team status`

| 옵션 | 기본값 | 설명 |
|--------|---------|-------------|
| `--session-id` | current | 타겟 세션 ID |
| `--provider` | codex | 프로바이더 (codex/claude/gemini) |
| `--preset` | focused | HUD preset |
| `--watch` | false | 지속적 모니터링 |
| `--fast` | false | 빠른 모드 |
| `--show-skill-candidates` | false | skill candidates 표시 |
| `--skill-candidate-limit` | 6 | 최대 candidates (1-20) |
| `--export-skill-candidate-patch-template` | false | 패치 artifact 내보내기 |
| `--draft-id` | - | draft ID 로 필터 |
| `--json` | false | JSON 으로 출력 |

### `aios team history`

| 옵션 | 기본값 | 설명 |
|--------|---------|-------------|
| `--provider` | codex | 프로바이더 (codex/claude/gemini) |
| `--limit` | 10 | 표시할 최대 세션 수 |
| `--concurrency` | 4 | 병렬 세션 읽기 |
| `--fast` | false | hindsight 상세 정보 스킵 |
| `--quality-failed-only` | false | 실패한 세션만 표시 |
| `--quality-category` | - | 카테고리로 필터 |
| `--quality-category-prefix` | - | 접두사로 필터 |
| `--quality-category-prefixes` | - | 여러 접두사 |
| `--quality-category-prefix-mode` | any | 일치 모드 (any/all) |
| `--draft-id` | - | draft ID 로 필터 |
| `--since` | - | 날짜로 필터 (ISO) |
| `--status` | - | 상태로 필터 |
| `--json` | false | JSON 으로 출력 |

### `aios team skill-candidates`

| 서브명령 | 설명 |
|------------|-------------|
| `list` | 세션의 skill candidates 리스트 |
| `export` | 패치 템플릿 artifact 내보내기 |

## 관련 문서

- [HUD 가이드](hud-guide.md) - 자세한 HUD 사용법 및 커스터마이즈
- [Skill Candidates](skill-candidates.md) - 스킬 패치 이해 및 적용
- [ContextDB](contextdb.md) - 세션 스토리지 및 메모리 시스템
