---
title: 개요
description: 기존 Codex/Claude/Gemini/OpenCode CLI를 OpenClaw 스타일로 업그레이드.
---

# RexCLI

> 지금 쓰고 있는 CLI 그대로. `codex` / `claude` / `gemini` / `opencode` 위에 하나 더 얹어줌.

[빠른 시작](getting-started.md){ .md-button .md-button--primary }
[사례 보기](case-library.md){ .md-button }

프로젝트 URL: <https://github.com/rexleimo/rex-cli>

## 뭐하는 건데?

RexCLI는 지금 쓰고 있는 CLI 에이전트 위에 얇은能力 레이어를 덮는 거야. `codex`, `claude`, `gemini`, `opencode`를 대체하는 게 아니라, 더 쓰기 좋게 만들어주는 거지.

4가지 기능:

1. **기억이 세션跨걸림** - 터미널 껐다 켜도 이전 프로젝트 맥락이 그대로 있어.
2. **브라우저 자동화** - MCP로 Chrome控制的 수 있어.
3. **스킬 재사용 가능** - 한 번뿐였던 대화가 반복再用 가능한 워크플로가 돼.
4. **프라이버시 가드** - 설정 파일 읽을 때 자동으로 시크릿 마스킹.

## 누가 쓰면 좋을까?

- 이미 `codex`, `claude`, `gemini`, `opencode` 중 하나라도 쓰고 있음
- 터미널 재시작해도 워크플로 이어갔으면 좋겠음
- 브라우저 자동화 필요한데 도구 바꾸고 싶지 않음
- API 키가 채팅履歴에 남는 거 싫어

## 빠르게 시작

```bash
git clone https://github.com/rexleimo/rex-cli.git
cd rex-cli
scripts/setup-all.sh --components all --mode opt-in
source ~/.zshrc
codex
```

## 들어있는 거

| 기능 | 하는 일 |
|---|---|
| ContextDB | 세션跨는 영구 기억 |
| Playwright MCP | 브라우저 자동화 |
| Skills | 재사용 워크플로 조각 |
| Privacy Guard |敏感정보 자동 마스킹 |

## 더 보기

- [빠른 시작](getting-started.md)
- [사례 집합](case-library.md)
- [아키텍처](architecture.md)
- [ContextDB](contextdb.md)
- [변경 로그](changelog.md)
