---
title: "Solo Harness: 한 Agent 를 밤새 돌려도 통제를 잃지 않는 방법"
description: "AIOS 1.7 에 `aios harness` 를 추가했습니다. run journal, status/stop/resume 제어, HUD 표시, 선택적 worktree 분리를 갖춘 재개 가능한 단일 Agent 실행입니다."
date: 2026-04-26
tags: ["AIOS", "Solo Harness", "단일 Agent", "ContextDB", "자동화"]
---

# Solo Harness: 한 Agent 를 밤새 돌려도 통제를 잃지 않는 방법

대부분의 coding CLI 는 짧은 prompt 처리에는 강하지만, "하나의 목표를 몇 시간 동안, 심지어 내가 자는 동안에도 계속 밀어붙이게 한다"는 운영 시나리오에서는 금방 한계가 드러납니다. 터미널을 떠나는 순간, 가시성도 떨어지고, 멈춤 제어도 거칠어지며, 다시 이어서 돌리기도 번거로워집니다.

AIOS 1.7 에서 추가한 `aios harness` 는 바로 이런 단일 Agent 장시간 실행을 위한 레인입니다.

## 원샷 CLI 루프의 한계

- 짧은 요청에는 잘 맞지만, 무인 단일 목표 실행에는 약합니다.
- 몇 시간 뒤에는 Agent 가 실제로 무엇을 했는지 추적하기 어렵습니다.
- 멈추고 싶을 때 안전한 경계를 기다리기보다 강제 중단이 되기 쉽습니다.
- 다시 시작하려면 컨텍스트와 operator 의도를 손으로 복구해야 하는 경우가 많습니다.
- 메인 checkout 에서 바로 돌리면 정리하기 어려운 diff 가 남기 쉽습니다.

## `aios harness` 로 추가된 것

`aios harness` 는 "한 Agent 가 하나의 목표를 계속 밀어붙이는" 상황을 위한 재개 가능한 operator loop 를 제공합니다.

- `run` - session 을 시작하고 목표를 기록합니다.
- `status` - 최신 구조화 상태와 artifact 를 확인합니다.
- `stop` - 다음 안전한 경계에서 멈추도록 요청합니다.
- `resume` - 새 run 을 만들지 않고 같은 session 을 이어서 실행합니다.
- `hud` - solo harness session 을 자동 감지해 최신 요약을 보여줍니다.
- `--worktree` - 야간 실행 변경을 폐기 가능한 git worktree 에 격리합니다.

## 빠른 시작

```bash
# 분리된 worktree 에서 야간 실행 시작
aios harness run --objective "내일 아침 인계 메모 정리" --session nightly-demo --worktree

# 구조화 상태 확인
aios harness status --session nightly-demo --json

# HUD 에서 같은 session 모니터링
aios hud --session nightly-demo --json

# 안전한 경계에서 멈추도록 요청
aios harness stop --session nightly-demo --reason "아침에 사람이 인계"

# 나중에 같은 session 재개
aios harness resume --session nightly-demo
```

token 을 쓰기 전에 artifact 계약을 먼저 확인하고 싶다면 dry-run 부터 시작하면 됩니다.

```bash
aios harness run --objective "내일 아침 인계 메모 정리" --session nightly-demo --worktree --dry-run --json
```

## 실행 중 어떤 파일이 남는가

각 session 의 run journal 은 다음 경로에 기록됩니다.

```text
memory/context-db/sessions/<session-id>/artifacts/solo-harness/
```

주요 파일:

- `objective.md` - 정규화된 목표 설명.
- `run-summary.json` - 현재 상태, 반복 카운터, backoff 상태, worktree 메타데이터.
- `control.json` - operator 의 중지 요청과 메모.
- `iteration-0001.json` - 각 반복의 정규화된 결과.
- `iteration-0001.log.jsonl` - 디버깅용 원시 반복 로그 스트림.

그래서 다음 날 인계할 때, 막연한 "밤새 좀 돌았다"가 아니라 읽을 수 있는 run journal 이 남습니다.

## 왜 `--worktree` 가 중요한가

야간 실행 정리를 거친 `git reset --hard` 같은 방식에 의존해서는 안 됩니다.

`--worktree` 를 쓰면 AIOS 는 harness session 전용 분리 git worktree 를 만들어 Agent 가 메인 checkout 을 직접 건드리지 않게 합니다. 의미 있는 결과가 없으면 임시 worktree 를 정리하면 되고, 가치 있는 변경이 있으면 worktree 메타데이터가 run summary 에 남아 리뷰와 병합 인계가 쉬워집니다.

## Solo Harness vs Agent Team vs Orchestrate

| 필요 | 더 잘 맞는 선택 |
|---|---|
| 하나의 목표, 하나의 provider, 재개 가능한 야간 실행 | `aios harness ...` |
| 명확히 쪼갤 수 있는 작업의 병렬 worker | `aios team ...` |
| preflight gate 가 있는 단계형 오케스트레이션 | `aios orchestrate ...` |

요약하면, 이 일을 한 Agent 가 계속 밀어야 한다면 Solo Harness, 처음부터 여러 worker 를 묶어야 한다면 다른 경로가 맞습니다.

## 관련 문서

- [Solo Harness 문서](https://cli.rexai.top/ko/solo-harness/)
- [HUD 가이드](https://cli.rexai.top/ko/hud-guide/)
- [Agent Team 가이드](https://cli.rexai.top/ko/team-ops/)
- [유스케이스 모음](https://cli.rexai.top/ko/use-cases/)
