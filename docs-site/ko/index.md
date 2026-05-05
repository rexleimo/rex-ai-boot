---
title: 개요
description: 먼저 하고 싶은 작업에서 명령을 고르고, 그다음 ContextDB, Agent Team, 브라우저 자동화, skills 로 들어갑니다.
---

# RexCLI

> 지금 쓰는 습관은 그대로 두고, 이미 사용하는 `codex` / `claude` / `gemini` 에 기억, 협업, 검증을 더합니다.

[3분 빠른 시작](getting-started.md){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="quick_start" }
[Agent Team 사용법](team-ops.md){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="team_ops" }
[시나리오별 명령 찾기](use-cases.md){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="use_cases" }
[GitHub](https://github.com/rexleimo/rex-cli?utm_source=cli_rexai_top&utm_medium=docs&utm_campaign=ko_onboarding&utm_content=home_hero_star){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="github_star" }

<figure class="rex-visual">
  <img src="../assets/visual-new-user-path.svg" alt="RexCLI 초보자 3단계: Doctor 실행, 프로젝트 기억 켜기, 필요할 때 Agent Team 사용">
  <figcaption>처음에는 가장 짧은 경로만 따라가세요. 설치 후 Doctor 를 실행하고, 프로젝트 기억을 켠 다음, 작업이 명확히 분리될 때만 Agent Team 을 사용합니다.</figcaption>
</figure>

## 먼저 하고 싶은 일을 고르세요

| 지금 하고 싶은 일 | 먼저 볼 문서 | 가장 짧은 명령 |
|---|---|---|
| 설치하고 TUI 열기 | [빠른 시작](getting-started.md) | `aios` |
| agent 가 프로젝트 맥락을 기억하게 하기 | [ContextDB](contextdb.md) | `touch .contextdb-enable && codex` |
| 한 agent 를 밤새 돌리기 | [솔로 Harness](solo-harness.md) | `aios harness run --objective "내일 아침 인계 메모 정리" --worktree` |
| 여러 agent 로 함께 작업하기 | [Agent Team](team-ops.md) | `aios team 3:codex "X 구현 후 테스트 실행"` |
| 진행 상황 보기 | [HUD 가이드](hud-guide.md) | `aios team status --provider codex --watch` |
| 브라우저 자동화 진단하기 | [문제 해결](troubleshooting.md) | `aios internal browser doctor --fix` |

## RexCLI 는 무엇인가요

RexCLI 는 새로운 coding agent 가 아닙니다. 로컬 우선의 기능 레이어입니다.

1. **기억 레이어 ContextDB**: 이벤트, checkpoint, context pack 을 현재 프로젝트에 저장해 터미널을 다시 열어도 이어서 작업할 수 있습니다.
2. **워크플로 레이어 Superpowers**: 요구를 계획으로 나누고, 증거 기반으로 디버깅하고, 완료 전에 검증합니다.
3. **협업 레이어 Agent Team**: 명확히 분리 가능한 작업을 여러 CLI worker 에게 맡기고 HUD 로 상태를 추적합니다.
4. **도구 레이어 Browser MCP + Privacy Guard**: agent 가 브라우저를 사용할 수 있게 하고, 민감한 설정은 공유 전에 마스킹합니다.

단일 agent 장시간 작업에는 [솔로 Harness](solo-harness.md) 가 ContextDB 위에 run journal, resume/stop 제어, 선택적 worktree 격리를 더합니다.

즉, 여전히 `codex`, `claude`, `gemini` 를 실행합니다. RexCLI 는 이 도구들이 더 잘 기억하고, 더 잘 협업하고, 덜 추측하게 만듭니다.

## 새 사용자를 위한 추천 경로

### 첫날: 먼저 실행하기

```bash
curl -fsSL https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.sh | bash
source ~/.zshrc
aios
```

TUI 에서 **Setup** 을 선택한 뒤 **Doctor** 를 실행하세요.

### Step 2: 프로젝트에서 기억 켜기

```bash
cd /path/to/your/project
touch .contextdb-enable
codex
```

이후 같은 프로젝트에서 `codex` / `claude` / `gemini` 를 시작하면 RexCLI 가 같은 프로젝트 컨텍스트에 연결합니다.

### Step 3: 분리 가능한 작업에만 Agent Team 사용

```bash
aios team 3:codex "로그인 모듈을 리팩터링하고 완료 전에 관련 테스트 실행"
aios team status --provider codex --watch
```

작업이 아직 불명확하다면 일반 인터랙티브 `codex` 로 먼저 분석하세요. 명확히 나눌 수 있을 때만 `team` 을 사용합니다.

## 흔한 오해

- **모든 작업에 Agent Team 이 필요한 것은 아닙니다**: 단일 파일 수정, 작은 bug, 불명확한 요구는 단일 agent 로 시작하세요.
- **첫날 모든 환경 변수를 외울 필요는 없습니다**: 먼저 `aios` TUI 를 사용하세요.
- **기능 목록부터 보지 마세요**: “지금 무엇을 하고 싶은가”에서 명령을 고르세요.
- **Doctor 를 건너뛰지 마세요**: install, browser, skills, native 설정을 직접 바꾸기 전에 진단하세요.

## 릴리스 노트와 상세 글

- [AIOS RL Training System](/blog/rl-training-system/): multi-environment training control plane 과 rollout model.
- [ContextDB Search Upgrade](/blog/contextdb-fts-bm25-search/): FTS5 + BM25 search path 와 semantic rerank behavior.
- [Windows CLI Startup Stability](/blog/windows-cli-startup-stability/): wrapper startup fix 와 Windows launch reliability.
- [Orchestrate Live](/blog/orchestrate-live/): live orchestration gates 와 execution workflow.

## 다음에 읽을 문서

- [빠른 시작](getting-started.md): install, Setup, Doctor, 첫 실행.
- [시나리오별 명령 찾기](use-cases.md): 작업별 진입점 선택.
- [Agent Team](team-ops.md): 언제 team 을 쓰고, 어떻게 모니터링하고, 어떻게 마무리할지.
- [솔로 Harness](solo-harness.md): 한 agent 를 밤새 실행하고 상태 확인, 중지, 재개하는 방법.
- [ContextDB](contextdb.md): 기억이 세션을 넘어 유지되는 방식.
- [문제 해결](troubleshooting.md): install, browser, live 실행 문제.
