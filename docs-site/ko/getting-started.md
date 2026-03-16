---
title: 빠른 시작
description: macOS, Linux, Windows를 하나의 절차로 통합하고 OS 탭으로 전환하는 가이드.
---

# 빠른 시작

이 페이지는 macOS, Linux, Windows 설정을 하나의 흐름으로 통합합니다. 명령이 다른 부분은 OS 탭으로 전환해 실행하세요.

## 사전 요구사항

- Node.js **20+** (권장: **22 LTS**) 및 `npm`
- `codex` / `claude` / `gemini` 중 하나
- 프로젝트 단위 ContextDB를 사용할 대상 워크스페이스/디렉터리

## 0) 설치 (권장)

이 저장소는 `~/.rexcil/rex-cli`에 설치됩니다. 통합 진입점은 `aios` 입니다:

- `aios` (인자 없음): 전체 화면 TUI 실행
- `aios doctor|update|privacy ...`: 기존 서브커맨드 유지

### 방법 C: 원라이너 (GitHub Releases)

=== "macOS / Linux"

    ```bash
    curl -fsSL https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.sh | bash
    source ~/.zshrc
    aios
    ```

=== "Windows (PowerShell)"

    ```powershell
    irm https://github.com/rexleimo/rex-cli/releases/latest/download/aios-install.ps1 | iex
    . $PROFILE
    aios
    ```

### 방법 A: git clone (개발용)

=== "macOS / Linux"

    ```bash
    git clone https://github.com/rexleimo/rex-cli.git ~/.rexcil/rex-cli
    cd ~/.rexcil/rex-cli
    scripts/aios.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    git clone https://github.com/rexleimo/rex-cli.git $HOME\.rexcil\rex-cli
    cd $HOME\.rexcil\rex-cli
    powershell -ExecutionPolicy Bypass -File .\scripts\aios.ps1
    ```

### 방법 B: GitHub Releases 다운로드 (오프라인용)

Releases에서 `rex-cli.tar.gz`(macOS/Linux) 또는 `rex-cli.zip`(Windows)을 내려받아 `~/.rexcil/`에 압축 해제한 뒤,
`scripts/aios.sh` / `scripts/aios.ps1`를 실행하세요.

### 권장: TUI에서 설치를 끝내기

설치 후에는 이번 릴리스의 핵심 경로인 TUI 흐름을 그대로 따라가세요:

1. `aios` 실행
2. **Setup** 선택
3. 목적에 맞는 구성요소 선택
   - `all`: 전체 설치
   - `shell,skills,superpowers`: 공유 메모리 + skills 우선
   - `browser`: Browser MCP만 설치
4. 설치가 끝나면 같은 TUI에서 **Doctor** 실행
5. shell wrapper를 설치했다면 다시 불러오기
   - macOS / Linux: `source ~/.zshrc`
   - Windows PowerShell: `. $PROFILE`

구성요소 선택 예시:

팁: 원라이너로 설치했다면 저장소는 `~/.rexcil/rex-cli`에 있습니다.
해당 디렉터리에서 스크립트를 실행하거나, `aios`를 실행해 TUI에서 **Setup**을 선택하세요.

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

## 5.1) 선택: 운영 도구 (quality-gate + learn-eval + orchestrate)

저장소 건강 체크 (ContextDB 회귀 체크 포함):

```bash
aios quality-gate pre-pr --profile strict
```

최근 세션 텔레메트리 분석:

```bash
aios learn-eval --limit 10
```

로컬 오케스트레이션 골격 생성 (모델 호출 없음):

```bash
aios orchestrate --session <session-id> --preflight auto --format json
```

CLI 서브에이전트로 live 실행 (토큰 비용, opt-in):

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli  # 필수 (live는 현재 codex-cli만 지원)
aios orchestrate --session <session-id> --dispatch local --execute live --format json
```

Tip (codex-cli): Codex CLI v0.114+는 `codex exec` 구조화 출력(`--output-schema`, `--output-last-message`, stdin)을 지원합니다. AIOS는 가능하면 자동 사용하고, 구버전에서는 stdout 파싱으로 폴백합니다.

선택 제어:

- `AIOS_SUBAGENT_CONCURRENCY` (default: `2`)
- `AIOS_SUBAGENT_TIMEOUT_MS` (default: `600000`)

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
