---
title: 변경 로그
description: 릴리스 이력, 업그레이드 안내, 관련 문서 링크.
---

# 변경 로그

이 페이지에서 `RexCLI` 변경 이력을 확인하고 관련 문서로 이동할 수 있습니다.

## 공식 릴리스 이력

- GitHub 변경 파일: [CHANGELOG.md](https://github.com/rexleimo/rex-cli/blob/main/CHANGELOG.md)
- GitHub Releases: [releases](https://github.com/rexleimo/rex-cli/releases)

## 최근 버전

- `main` (미릴리스): `aios orchestrate`에 `subagent-runtime` live 실행 추가 (`AIOS_EXECUTE_LIVE=1` 필요); Codex CLI v0.114+ 구조화 출력으로 JSON handoff 안정화
- `0.16.0` (2026-03-10): orchestrator agent catalog 및 생성기 추가
- `0.15.0` (2026-03-10): `orchestrate live` 기본 게이트 (`AIOS_EXECUTE_LIVE`)
- `0.14.0` (2026-03-10): `subagent-runtime` 런타임 어댑터(stub) 추가
- `0.13.0` (2026-03-10): 런타임 manifest 외부화
- `0.11.0` (2026-03-10): 로컬 orchestrate preflight 범위 확장
- `0.10.4` (2026-03-08): 비 git 워크스페이스 wrapper fallback 및 문서 동기화
- `0.10.3` (2026-03-08): Windows cmd-backed CLI 실행 수정
- `0.10.0` (2026-03-08): 설치/업데이트/제거 라이프사이클을 Node로 통합
- `0.8.0` (2026-03-05): 엄격 모드 Privacy Guard(Ollama 지원) 및 설치 흐름 통합
- `0.5.0` (2026-03-03): ContextDB SQLite 사이드카 인덱스(`index:rebuild`), 선택적 `--semantic` 검색, `ctx-agent` 실행 코어 통합

## 관련 문서

- [빠른 시작](getting-started.md)
- [ContextDB](contextdb.md)
- [문제 해결](troubleshooting.md)

## 업데이트 규칙

설치, 런타임 동작, 호환성에 영향을 주는 릴리스는 같은 PR에서 문서를 함께 업데이트하고 이 페이지에 반영합니다.
