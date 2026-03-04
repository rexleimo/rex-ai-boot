---
title: 빠른 시작
description: macOS, Linux, Windows를 하나의 절차로 통합하고 OS 탭으로 전환하는 가이드.
---

# 빠른 시작

이 페이지는 macOS, Linux, Windows 설정을 하나의 흐름으로 통합합니다. 명령이 다른 부분은 OS 탭으로 전환해 실행하세요.

## 사전 요구사항

- Node.js 18+ 및 `npm`
- `codex` / `claude` / `gemini` 중 하나
- 프로젝트 단위 ContextDB를 사용할 대상 git 저장소

## 0) 원커맨드 설치 (권장)

=== "macOS / Linux"

    ```bash
    scripts/setup-all.sh --components all --mode opt-in
    source ~/.zshrc
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components all -Mode opt-in
    . $PROFILE
    ```

구성요소 선택 예시:

=== "macOS / Linux"

    ```bash
    # shell 래퍼 + skills만 설치
    scripts/setup-all.sh --components shell,skills --mode opt-in

    # browser MCP만 설치
    scripts/setup-all.sh --components browser
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components shell,skills -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components browser
    ```

원커맨드 업데이트 / 제거:

=== "macOS / Linux"

    ```bash
    scripts/update-all.sh --components all --mode opt-in
    scripts/uninstall-all.sh --components shell,skills
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-all.ps1 -Components all -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-all.ps1 -Components shell,skills
    ```

구성요소별 설치를 원하면 아래 1-8 단계를 계속 따라가세요.

## 1) Browser MCP 설치

=== "macOS / Linux"

    ```bash
    scripts/install-browser-mcp.sh
    scripts/doctor-browser-mcp.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-browser-mcp.ps1
    powershell -ExecutionPolicy Bypass -File .\scripts\doctor-browser-mcp.ps1
    ```

## 2) ContextDB CLI 빌드

```bash
cd mcp-server
npm install
npm run build
```

## 3) 명령 래퍼 설치 (권장)

=== "macOS / Linux (zsh)"

    ```bash
    scripts/install-contextdb-shell.sh --mode opt-in
    scripts/doctor-contextdb-shell.sh
    source ~/.zshrc
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-shell.ps1 -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\doctor-contextdb-shell.ps1
    . $PROFILE
    ```

## 4) 현재 프로젝트 활성화

=== "macOS / Linux"

    ```bash
    touch .contextdb-enable
    ```

=== "Windows (PowerShell)"

    ```powershell
    New-Item -ItemType File -Path .contextdb-enable -Force
    ```

## 5) 사용 시작

```bash
cd /path/to/your/project
codex
# 또는
claude
# 또는
gemini
```

## 6) 생성 데이터 확인

=== "macOS / Linux"

    ```bash
    ls memory/context-db
    ```

=== "Windows (PowerShell)"

    ```powershell
    Get-ChildItem memory/context-db
    ```

`sessions/`, `index/`, `exports/`가 보이면 정상입니다.

## 7) 업데이트 / 제거

=== "macOS / Linux (zsh)"

    ```bash
    scripts/update-contextdb-shell.sh --mode opt-in
    scripts/uninstall-contextdb-shell.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-contextdb-shell.ps1 -Mode opt-in
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-contextdb-shell.ps1
    ```

## 8) 선택: 이 저장소 Skills를 전역 설치

다른 프로젝트에서도 이 저장소의 skills를 바로 쓰고 싶을 때만 실행하세요.
`--client all`은 `codex` / `claude` / `gemini` / `opencode`를 함께 대상으로 합니다.

=== "macOS / Linux"

    ```bash
    scripts/install-contextdb-skills.sh --client all
    scripts/doctor-contextdb-skills.sh --client all
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-skills.ps1 -Client all
    powershell -ExecutionPolicy Bypass -File .\scripts\doctor-contextdb-skills.ps1 -Client all
    ```

Skills 라이프사이클:

=== "macOS / Linux"

    ```bash
    scripts/update-contextdb-skills.sh --client all
    scripts/uninstall-contextdb-skills.sh --client all
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\update-contextdb-skills.ps1 -Client all
    powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-contextdb-skills.ps1 -Client all
    ```

## FAQ

### `CODEX_HOME points to ".codex"` 오류

`CODEX_HOME`가 상대 경로로 설정된 상태입니다. 절대 경로로 변경하세요:

```bash
export CODEX_HOME="$HOME/.codex"
mkdir -p "$CODEX_HOME"
```

### 래퍼 설치 시 skills도 자동 설치되나요?

아니요. 래퍼와 skills는 분리되어 있습니다. 전역 skills가 필요하면 8단계를 실행하세요.
