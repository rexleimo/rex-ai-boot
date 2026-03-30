---
title: 변경 로그
description: 릴리스 이력, 업그레이드 안내, 관련 문서 링크.
---

# 변경 로그

이 페이지에서 `RexCLI` 변경 이력을 추적하고 관련 문서로 이동할 수 있습니다.

## 공식 릴리스 이력

- GitHub 변경 파일: [CHANGELOG.md](https://github.com/rexleimo/rex-cli/blob/main/CHANGELOG.md)
- GitHub Releases: [releases](https://github.com/rexleimo/rex-cli/releases)

## 최근 버전

- `main` (미릴리스):
  - **멀티 환경 RL 트레이닝 시스템**: shell, browser, orchestrator 어댑터를 가진 공유 `rl-core` 제어 플레인; 3포인터 checkpoint 계통; 4레인 replay pool; PPO + teacher distillation 트레이닝
  - **혼합 환경 캠페인** (`rl-mixed-v1`): 하나의 라이브 배치가 shell + browser + orchestrator episode에 걸치고 통합 롤백 판단으로 실행
  - ContextDB `search`가 기본으로 SQLite FTS5 + `bm25(...)` 랭킹, FTS 사용 불가 시 자동 레キシ컬 폴백
  - ContextDB 시맨틱 리랭킹이 쿼리 스코프 레ksi칼 후보에서 동작하여 오래된 완전 일치 드롭 감소
  - `aios orchestrate`의 `subagent-runtime` 라이브 실행（`AIOS_EXECUTE_LIVE=1`로 opt-in）
  - 소유권 힌트와 함께 바운드 work-item 큐 스케줄링
  - no-op 패스트 패스: 상류 handoff가 파일을 터치하지 않았을 때 `reviewer` / `security-reviewer` 자동 완료
  - `main`への各push時に Windows PowerShell shell-smoke 워크플로（`.github/workflows/windows-shell-smoke.yml`）
  - `global` / `project` 타겟 선택을 가진 스코프 인식 `skills` 설치 플로우
  - canonical skill authoring이 이제 `skill-sources/`에 있으며, repo-local 클라이언트 루트는 `node scripts/sync-skills.mjs`로 생성
  - 기본 skills 설치 모드가 이제 이식 가능한 `copy`; 명시적 `--install-mode link`는 로컬 개발을 위해 사용 가능
  - 릴리스 packaging/preflight이 이제 `check-skills-sync`로 생성 skill roots 검증
  - 코어 기본값, 선택적 business skills, 제거 시 설치된 항목만 표시하는 카탈로그 중심 skill 피커
  - TUI skill 피커가 항목을 `Core`와 `Optional`으로 그룹화하고 터미널 가독성을 위해 설명을 잘라냄
  - `doctor`가 이제同名 글로벌 설치의プロジェクト skill 오버라이드를 경고
  - Node 런타임 안내가 이제 Node 22 LTS에 명시적으로 정렬
- `0.17.0` (2026-03-17):
  - TUI 제거 피커가 이제 작은 터미널에서 스크롤하고 `Select all` / `Clear all` / `Done`을 하단에 고정
  - 제거 커서 선택이 렌더링된 그룹 목록과 정렬 유지
  - 설정/업데이트 skill 피커가 이미 설치된 스킬을 `(installed)`로 표시
- `0.16.0` (2026-03-10): orchestrator agent catalog 및 생성기 추가
- `0.15.0` (2026-03-10): `orchestrate live`를 기본으로 gate（`AIOS_EXECUTE_LIVE`）
- `0.14.0` (2026-03-10): `subagent-runtime` 런타임 어댑터(stub) 추가
- `0.13.0` (2026-03-10): 런타임 manifest 외부화
- `0.11.0` (2026-03-10): 로컬 orchestrate preflight 범위 확장
- `0.10.4` (2026-03-08): 非git 워크스페이스 wrapper fallback 및 문서 동기화
- `0.10.3` (2026-03-08): Windows cmd-backed CLI 실행 수정
- `0.10.0` (2026-03-08): 설치/업데이트/제거 라이프사이클을 Node로 통합
- `0.8.0` (2026-03-05): 엄격 모드 Privacy Guard(Ollama 지원) 및 설치 흐름 통합
- `0.5.0` (2026-03-03): ContextDB SQLite 사이드카 인덱스(`index:rebuild`), 선택적 `--semantic` 검색, `ctx-agent` 실행 코어 통합

## 2026-03-16 운영 상황

- Continuous live 샘플이 성공 중（`dispatchRun.ok=true`）, 최신 아티팩트:
  - `memory/context-db/sessions/codex-cli-20260303T080437-065e16c0/artifacts/dispatch-run-20260316T111419Z.json`
- `learn-eval`이 아직 권장:
  - `[fix] runbook.failure-triage`（`clarity-needs-input=5`）
  - `[observe] sample.latency-watch`（`avgElapsedMs=160678`）
- latency-watch 관찰이 계속되는 동안 Timeout 예산은 현상 유지.

## 관련 읽기

- [블로그: Skills 설치 경험 업데이트](/blog/ko/2026-03-rexcli-skills-install-experience/)
- [빠른 시작](getting-started.md)
- [ContextDB](contextdb.md)
- [문제 해결](troubleshooting.md)

## 업데이트 규칙

설치, 런타임 동작, 호환성에 영향을 주는 릴리스는 같은 PR에서 문서를 함께 업데이트하고 이 페이지에 반영합니다.
