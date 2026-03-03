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

## 3) 명령 래퍼 활성화

=== "macOS / Linux (zsh)"

    `~/.zshrc`에 아래 블록을 추가:

    ```zsh
    # >>> contextdb-shell >>>
    export ROOTPATH="${ROOTPATH:-$HOME/cool.cnb/rex-ai-boot}"
    export CTXDB_WRAP_MODE=opt-in
    if [[ -f "$ROOTPATH/scripts/contextdb-shell.zsh" ]]; then
      source "$ROOTPATH/scripts/contextdb-shell.zsh"
    fi
    # <<< contextdb-shell <<<
    ```

    반영:

    ```bash
    source ~/.zshrc
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-shell.ps1
    . $PROFILE
    $env:CTXDB_WRAP_MODE = "opt-in"
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
