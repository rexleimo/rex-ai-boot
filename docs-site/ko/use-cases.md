---
title: 시나리오별 명령 찾기
description: 개념을 먼저 외우지 말고, “지금 무엇을 하고 싶은가”에서 RexCLI 명령을 고르세요.
---

# 시나리오별 명령 찾기

이 페이지는 한 가지 질문에 답합니다: **지금 어떤 명령을 실행해야 하나요?**

<figure class="rex-visual">
  <img src="../assets/visual-contextdb-memory-loop.svg" alt="ContextDB 프로젝트 기억 루프: .contextdb-enable 후 codex, claude, gemini 가 로컬 프로젝트 기억을 공유">
  <figcaption>대부분의 시나리오는 하나의 핵심을 중심으로 합니다. 프로젝트 루트에서 ContextDB 를 켜면 서로 다른 CLI 가 같은 로컬 컨텍스트에 연결됩니다.</figcaption>
</figure>

## 설치하고 환경을 확인하고 싶어요

```bash
aios
```

TUI 에서 순서대로 실행하세요:

1. **Setup**: shell wrapper, skills, browser 등 구성요소 설치.
2. **Doctor**: Node, MCP, skills, native 설정 확인.
3. **Update**: 이후 업그레이드도 여기서 진행.

명령줄 경로:

```bash
aios setup --components all --mode opt-in --client all
aios doctor --native --verbose
```

## agent 가 현재 프로젝트를 기억하게 하고 싶어요

```bash
cd /path/to/project
touch .contextdb-enable
codex
```

이후 같은 프로젝트에서 `codex`, `claude`, `gemini` 를 실행하면 모두 같은 ContextDB 에 연결됩니다.

## CLI 를 바꿔가며 이어받고 싶어요

```bash
claude   # 먼저 분석
codex    # 다음 구현
gemini   # 마지막 검토 또는 비교
```

모두 같은 프로젝트 디렉터리에서 실행하면 ContextDB 가 이벤트와 checkpoint 를 저장해, 도구를 바꿔도 컨텍스트를 잃을 가능성을 줄입니다.

## 한 agent 를 밤새 계속 돌리고 싶어요

적합: 목표가 명확하고, provider 하나면 충분하고, 야간에 계속 진행시키고 싶으며, 병렬 worker 가 필요하지 않을 때.

```bash
aios harness run --objective "내일 아침 인계 메모 정리" --session nightly-demo --worktree
aios harness status --session nightly-demo --json
aios hud --session nightly-demo --json
```

안전한 경계에서 멈추게 하거나 나중에 이어서 실행하려면:

```bash
aios harness stop --session nightly-demo --reason "아침에 사람이 인계"
aios harness resume --session nightly-demo
```

“한 agent 가 한 목표를 계속 밀어붙이게” 하고 싶다면 [솔로 Harness](solo-harness.md) 를 사용하세요. 작업이 정말 병렬 친화적일 때만 [Agent Team](team-ops.md) 을 쓰면 됩니다.

## Agent Team 을 켜고 싶어요

적합: 모듈이 독립적이고, 작업을 나눌 수 있으며, token 비용을 감수할 수 있을 때.

```bash
aios team 3:codex "X 구현, 완료 전 테스트 실행, 변경 요약"
aios team status --provider codex --watch
```

부적합: 요구가 모호함, 단일 bug, 여러 worker 가 같은 파일을 수정할 가능성이 높음. 이때는 일반 `codex` 부터 시작하세요.

## 진행 상황과 기록을 보고 싶어요

```bash
aios hud --provider codex
aios team status --provider codex --watch
aios team history --provider codex --limit 20
```

최근 실패만 빠르게 보려면:

```bash
aios team history --provider codex --quality-failed-only
```

## quality gate 를 실행하고 싶어요

```bash
aios quality-gate pre-pr --profile strict
```

PR 전 또는 큰 변경 후 실행하세요. ContextDB, native/sync, release health 확인을 포함합니다.

## RexCLI 에 단계별 orchestration 을 맡기고 싶어요

먼저 model call 없이 preview:

```bash
aios orchestrate feature --task "Ship X" --dispatch local --execute dry-run
```

live 실행이 필요할 때만 명시적으로 활성화:

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli
aios orchestrate --session <session-id> --dispatch local --execute live
```

새 사용자는 `aios team ...` 을 우선 사용하세요. `orchestrate live` 는 session, plan, preflight gate 를 이미 이해한 메인테이너에게 더 적합합니다.

## 브라우저 자동화를 진단하고 싶어요

```bash
aios internal browser doctor --fix
aios internal browser cdp-status
```

페이지 작업이 실패하면 전체를 다시 설치하기 전에 [문제 해결](troubleshooting.md)을 확인하세요.

## secrets 와 config 를 보호하고 싶어요

```bash
aios privacy read --file .env
```

`.env`, cookies, tokens, browser profiles 를 model 에 그대로 붙여 넣지 마세요. RexCLI Privacy Guard 는 read output 을 공유하기 전에 마스킹하려고 합니다.

## 선택 기준

- **일상 개발**: `codex` / `claude` / `gemini`
- **설치/업데이트**: `aios`
- **솔로 야간 실행**: `aios harness run --objective "내일 아침 인계 메모 정리" --worktree`
- **Agent Team**: `aios team 3:codex "task"`
- **진행 상황**: `aios team status --watch`
- **전달 전**: `aios quality-gate pre-pr --profile strict`
- **브라우저 문제**: `aios internal browser doctor --fix`
