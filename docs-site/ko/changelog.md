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

- `0.8.0` (2026-03-05): 엄격 모드 Privacy Guard(`~/.rexcil`) 추가, 설정 파일 읽기 시 탈민 경로 필수화, Ollama(`qwen3.5:4b`) 지원 및 설치 흐름 통합
- `0.7.0` (2026-03-05): 브라우저 반자동화 챌린지 감지(`browser_challenge_check`)와 명시적 인간 인수인계 신호 추가
- `0.6.2` (2026-03-04): opt-in wrapper 모드에서 `.contextdb-enable` 자동 생성 누락 문제 수정
- `0.6.1` (2026-03-04): Windows browser doctor 안정화 및 Node 20+ 요구사항 명확화
- `0.6.0` (2026-03-04): 멀티 CLI doctor + security scan skills 패키지 추가
- `0.5.3` (2026-03-04): docs 사이트 네비게이션 업데이트 및 블로그 홈 푸터 단순화
- `0.5.2` (2026-03-03): docs 사이트 푸터를 RexAI 공통 링크로 통합
- `0.5.1` (2026-03-03): 문서와 superpowers 기본 워크플로 정렬
- `0.5.0` (2026-03-03): ContextDB SQLite 사이드카 인덱스, `index:rebuild`, 선택적 `--semantic` 검색 경로, `ctx-agent` 실행 코어 통합
- `0.4.2` (2026-03-03): Windows 절차를 탭형 Quick Start로 통합
- `0.4.1` (2026-03-03): Windows 가이드 페이지 및 교차 링크 추가
- `0.4.0` (2026-03-03): Windows PowerShell 설치 스크립트 추가

## 관련 문서

- [빠른 시작](getting-started.md)
- [ContextDB](contextdb.md)
- [문제 해결](troubleshooting.md)

## 업데이트 규칙

설치, 런타임 동작, 호환성에 영향을 주는 릴리스는 같은 PR에서 문서를 함께 업데이트하고 이 페이지에 반영합니다.
