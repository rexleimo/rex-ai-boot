---
title: Windows 가이드
description: Windows PowerShell에서 Browser MCP와 ContextDB 래퍼를 설정하는 전체 절차.
---

# Windows 가이드

이 가이드는 Windows + PowerShell 기준입니다 (bash/zsh 불필요).

## 사전 요구사항

- Windows 10/11
- PowerShell 7+ (또는 Windows PowerShell 5.1)
- Node.js 18+
- `codex` / `claude` / `gemini` 중 하나

## 1) Browser MCP 설치

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-browser-mcp.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\doctor-browser-mcp.ps1
```

설치 스크립트가 절대 경로 `dist/index.js`를 포함한 MCP JSON 설정을 출력합니다. 클라이언트 설정에 붙여넣고 재시작하세요.

## 2) ContextDB PowerShell 래퍼 활성화

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-shell.ps1
. $PROFILE
```

`scripts/contextdb-shell.ps1` 래퍼가 로드됩니다.

## 3) 프로젝트 단위 opt-in 설정

대상 프로젝트 루트에서 실행:

```powershell
New-Item -ItemType File -Path .contextdb-enable -Force
```

권장 스코프:

```powershell
$env:CTXDB_WRAP_MODE = "opt-in"
```

## 4) 기존 명령 그대로 사용

```powershell
codex
claude
gemini
```

## 5) 브라우저 도구 스모크 테스트

클라이언트 채팅에서 실행:

1. `browser_launch` `{"profile":"default"}`
2. `browser_navigate` `{"url":"https://example.com"}`
3. `browser_snapshot` `{}`
4. `browser_close` `{}`

## 참고

- 기본 CDP 포트 `9222`가 없으면 `profile=default`는 로컬 실행으로 자동 폴백됩니다.
- 도구가 안 되면 먼저 `scripts/doctor-browser-mcp.ps1`를 실행하세요.
