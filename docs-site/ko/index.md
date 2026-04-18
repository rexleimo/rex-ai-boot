---
title: 개요
description: Codex/Claude/Gemini/OpenCode용 AI 기억 시스템 문서. Hermes 워크플로, Agent Team, 자동 subagent 계획을 다룹니다.
---

# RexCLI

> 지금 쓰고 있는 CLI 그대로. `codex` / `claude` / `gemini` / `opencode` 위에 하나 더 얹어줌.

[GitHub에서 Star](https://github.com/rexleimo/rex-cli?utm_source=cli_rexai_top&utm_medium=docs&utm_campaign=english_growth&utm_content=home_hero_star){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="github_star" }
[빠른 시작](getting-started.md){ .md-button .md-button--primary data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="quick_start" }
[워크플로 비교](cli-comparison.md){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="compare_workflows" }
[Superpowers](superpowers.md){ .md-button data-rex-track="cta_click" data-rex-location="home_hero" data-rex-target="superpowers" }

프로젝트 URL: <https://github.com/rexleimo/rex-cli>

## 빠른 답변

RexCLI는 coding agent를 위한 **AI 기억 시스템 + 오케스트레이션 레이어**입니다.  
다음 요구를 바로 처리할 수 있습니다:

- **기억 시스템** 기반의 세션 간 컨텍스트 유지 (`ContextDB`)
- **Hermes 엔진 스타일 워크플로** 자동화와 실행 제어
- **Agent Team** 멀티 에이전트 협업
- **자동 subagent 계획** + preflight/merge gate

## 키워드 -> 기능 매핑

- `기억 시스템` -> [ContextDB](contextdb.md)
- `Hermes 엔진` -> [CLI 워크플로](use-cases.md)
- `Agent Team` -> [Agent Team & HUD](team-ops.md)
- `자동 subagent 계획` -> [아키텍처](architecture.md)

## 고급 디자인 스킬: 페이지 제작

모호한 요청에서도 일관된 고품질 UI를 만들려면:

- [고급 디자인 스킬](advanced-design-skills.md)에서 `DESIGN.md`를 먼저 고정하고 `frontend-design`으로 구현
- `Patch/Restyle/Flow` 3모드로 요구를 수렴
- 제품 기본값으로 가이드의 시스템 프롬프트를 적용

## 최신 기능

- [고급 디자인 스킬 페이지 제작: 모호한 프롬프트를 실전 UI로](/blog/ko/advanced-design-skills-page-building/)
- [AIOS RL Training System](/blog/rl-training-system/)
- [ContextDB Search Upgrade: FTS5/BM25 by Default](/blog/contextdb-fts-bm25-search/)
- [Windows CLI Startup Stability Update](/blog/windows-cli-startup-stability/)
- [Orchestrate Live: Subagent Runtime](/blog/orchestrate-live/)

## 뭐하는 건데?

RexCLI는 지금 쓰고 있는 CLI 에이전트 위에 얇은能力 레이어를 덮는 거야. `codex`, `claude`, `gemini`, `opencode`를 대체하는 게 아니라, 더 쓰기 좋게 만들어주는 거지.

4가지 기능:

1. **기억이 세션跨걸림** - 터미널 껐다 켜도 이전 프로젝트 맥락이 그대로 있어. 동일 프로젝트는 여러 디바이스에서 기억 공유.
2. **브라우저 자동화** - MCP로 Chrome控制的 수 있어.
3. **Superpowers 智能 계획** - 요구사항 자동 분해, 병렬 태스크分发, 자동 검증.
4. **프라이버시 가드** - 설정 파일 읽을 때 자동으로 시크릿 마스킹.

## 누가 쓰면 좋을까?

- 이미 `codex`, `claude`, `gemini`, `opencode` 중 하나라도 쓰고 있음
- 터미널 재시작해도 워크플로 이어갔으면 좋겠음
- 브라우저 자동화 필요한데 도구 바꾸고 싶지 않음
- 베스트 프랙티스를 강제하는 자동화 스킬이 필요함

## 빠르게 시작

```bash
curl -fsSL https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.sh | bash
source ~/.zshrc
aios
```

위 명령은 stable release 설치 경로입니다. 미출시 `main` 동작을 쓰고 싶다면 [빠른 시작](getting-started.md)의 개발용 `git clone` 경로를 사용하세요.

먼저 `aios`를 실행해 전체 화면 TUI를 열고 **Setup**을 선택한 뒤, 마지막에 **Doctor**를 실행하세요.
Windows PowerShell 절차는 [빠른 시작](getting-started.md)에 있습니다.

## 들어있는 거

| 기능 | 하는 일 |
|---|---|
| ContextDB | 세션 간 영구 기억 |
| Playwright MCP | 브라우저 자동화 |
| Superpowers | 자동 계획(자동 분해, 병렬 분배, 자동 검증) |
| Privacy Guard | 민감정보 자동 마스킹 |

## FAQ

### RexCLI는 coding agent용 기억 시스템인가요?
네. `ContextDB`가 같은 저장소에서 세션 간 문맥을 보존하고 CLI 간 핸드오프를 지원합니다.

### Hermes 스타일 오케스트레이션을 할 수 있나요?
네. `team`과 `orchestrate`로 단계 실행, 라우팅, 검증 게이트를 구성할 수 있습니다.

### subagent 자동 계획을 지원하나요?
네. `single/subagent/team` 라우팅 판단과 실행 가드레일을 제공합니다.

## 더 보기

- [Superpowers](superpowers.md) - CLI를 더 똑똑하게 만드는 자동화 스킬
- [빠른 시작](getting-started.md)
- [Raw CLI vs RexCLI](cli-comparison.md)
- [사례 집합](case-library.md)
- [아키텍처](architecture.md)
- [ContextDB](contextdb.md)
- [변경 로그](changelog.md)
