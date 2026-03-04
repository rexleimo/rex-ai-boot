---
title: 개요
description: rex-ai-boot 프로젝트 소개와 핵심 기능.
---

# rex-ai-boot 문서

프로젝트 URL: [https://github.com/rexleimo/rex-ai-boot](https://github.com/rexleimo/rex-ai-boot)

`rex-ai-boot`는 다음 CLI를 위한 로컬 워크플로 레이어입니다.

- Codex CLI
- Claude Code
- Gemini CLI
- OpenCode

핵심 추가 기능:

1. 파일시스템 ContextDB (세션 메모리)
2. 투명 래퍼 (`codex` / `claude` / `gemini` 그대로 사용)

## 30초 시작 (먼저 사용)

```bash
git clone https://github.com/rexleimo/rex-ai-boot.git
cd rex-ai-boot
scripts/setup-all.sh --components all --mode opt-in
source ~/.zshrc
codex
```

## 빠른 실행

```bash
codex
claude
gemini
```

## 다음 읽기

- [프로젝트(GitHub)](https://github.com/rexleimo/rex-ai-boot)
- [빠른 시작](getting-started.md)
- [블로그 사이트](https://cli.rexai.top/blog/ko/)
- [추천 링크](friends.md)
- [변경 로그](changelog.md)
- [CLI 워크플로](use-cases.md)
- [공식 사례 라이브러리](case-library.md)
- [아키텍처](architecture.md)
- [ContextDB](contextdb.md)
