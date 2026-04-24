---
title: 빠른 시작
description: macOS, Linux, Windows를 하나의 절차로 통합하고 OS 탭으로 전환하는 가이드.
---

# 빠른 시작

이 페이지는 macOS, Linux, Windows 설정을 하나의 절차로 통합합니다. 명령이 다른 부분은 OS 탭으로 전환해 실행하세요.

## 빠른 답변 (AI 검색)

`RexCLI`는 `codex`, `claude`, `gemini`를 그대로 사용하면서 프로젝트 스코프 ContextDB 기억과 통합 Browser MCP 설정을 추가합니다.

## 사전 요구사항

- Node.js **22 LTS** 및 `npm`
- `codex` / `claude` / `gemini` 중 하나
- 프로젝트 단위 ContextDB를 사용할 대상 워크스페이스/디렉터리

## 0) 설치 (권장)

이 저장소는 `~/.rexcil/rex-cli`에 설치됩니다. 통합 진입점은 `aios` 입니다:

- `aios` (인자 없음): 전체 화면 TUI 실행
- `aios doctor|update|privacy ...`: 기존 서브커맨드 유지

### 방법 C: 원라이너 (GitHub Releases)

이 경로는 stable 설치 경로이며, 게시된 GitHub Release asset 이 있어야 합니다.

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

미출시 `main` 브랜치 동작을 명시적으로 쓰고 싶을 때만 이 경로를 사용하세요. 이것은 개발용 설치 경로이며 stable release 경로가 아닙니다.

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

### TUI 시작 웰컴 배너

`aios`로 TUI를 시작하면 먼저 시안(청록)색 ASCII 아트 배너가 표시됩니다:

```
  ╔══════════════════════════════════════════╗
  ║   ██████╗ ██╗  ██╗██╗██████╗  ██████╗    ║
  ║   ██╔══██╗██║ ██╔╝██║██╔══██╗██╔════╝    ║
  ║   ██████╔╝█████╔╝ ██║██████╔╝██║         ║
  ║   ██╔══██╗██╔═██╗ ██║██╔══██╗██║         ║
  ║   ██║  ██║██║  ██╗██║██║  ██║╚██████╗    ║
  ║   ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚═╝  ╚═╝ ╚═════╝    ║
  ║          Hello, Rex CLI!                 ║
  ╚══════════════════════════════════════════╝
```

배너 아래에 저장소 경로가 표시되어 TUI가 준비 완료되었음을 확인할 수 있습니다.

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

### 저장소 기여자: skills는 이제 `skill-sources/`를 출처로 합니다

이 저장소 자체를 편집하고 있는（火 설치가 아닌）경우:

- canonical skill source files은 `skill-sources/`에 있습니다
- repo-local의 `.codex/skills`, `.claude/skills`, `.agents/skills`, `.gemini/skills`, `.opencode/skills`는 생성된 호환 출력입니다
- 다음으로 재생성하세요:

```bash
node scripts/sync-skills.mjs
node scripts/check-skills-sync.mjs
```

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

### 0.1 Privacy Guard 엄격 읽기 (기본 활성화)

셸 설정은 이제 `~/.rexcil/privacy-guard.json`에서 Privacy Guard 설정을 초기화하고 엄격한 리덕션 정책을 기본으로 활성화합니다.
설정 또는 시크릿이 포함된 파일을 읽을 때는 엄격 읽기 경로를 사용하세요:

=== "macOS / Linux"

    ```bash
    aios privacy read --file <path>
    ```

=== "Windows (PowerShell)"

    ```powershell
    aios privacy read --file <path>
    ```

선택적 로컬 모델 경로（Ollama + `qwen3.5:4b`）：

=== "macOS / Linux"

    ```bash
    aios privacy ollama-on
    ```

=== "Windows (PowerShell)"

    ```powershell
    aios privacy ollama-on
    ```

ContextDB shell 이 래핑한 대화형 `codex` / `claude` / `gemini` / `opencode` 시작 시 Privacy Shield 패널을 출력하여 Privacy Guard 상태, 모델 엔드포인트/중계 서비스 감지, 민감 파일 처리 방식을 알려줍니다.

=== "macOS / Linux"

    ```bash
    CTXDB_PRIVACY_BANNER=0 codex      # 패널을 일시적으로 숨김
    CTXDB_PRIVACY_COLOR=0 codex       # 패널은 유지하고 ANSI 색상 비활성화
    ```

=== "Windows (PowerShell)"

    ```powershell
    $env:CTXDB_PRIVACY_BANNER = "0"; codex
    $env:CTXDB_PRIVACY_COLOR = "0"; codex
    ```

Privacy Shield 는 agent 에게 개인정보 규칙을 상기시키지만, LLM 지시는 권고적입니다. 검증 가능한 보호는 context, MCP 출력, 로그, checkpoint 가 기기 밖으로 나가기 전 deterministic AIOS gate 에서 수행됩니다.

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

- `AIOS_SUBAGENT_CONCURRENCY` (default: `3`)
- `AIOS_SUBAGENT_TIMEOUT_MS` (default: `600000`)

### 5.1.1) 라우팅 + 병렬 설정 프로필 (권장)

병렬 실행은 유지하고 설정은 최소로 가져가려면 아래를 그대로 사용하세요:

단독 빠른 참조 페이지: [라우팅/병렬 프로필](route-concurrency-profiles.md).

```bash
export CTXDB_INTERACTIVE_AUTO_ROUTE=1
export CTXDB_CODEX_DISABLE_MCP=1
export CTXDB_TEAM_WORKERS=3
export AIOS_SUBAGENT_CONCURRENCY=3
```

변수 의미:

- `CTXDB_INTERACTIVE_AUTO_ROUTE`: interactive wrapper의 자동 라우팅(`single/subagent/team`) 주입 여부
- `CTXDB_CODEX_DISABLE_MCP`: wrapper로 실행한 `codex`에서 MCP 시작을 건너뛸지 여부 (`1`이면 cold-start 대기 완화)
- `CTXDB_TEAM_WORKERS`: `aios team ...` 병렬 worker 수
- `AIOS_SUBAGENT_CONCURRENCY`: `aios orchestrate --execute live` 병렬 실행 수

권장 프리셋:

- 균형 기본값(권장): `3 + 3`
- 고처리량: `4 + 4`
- 디버그 안정 모드: `1 + 1`

## 5.2) 선택: HUD 와 Team Ops 가시성

HUD 로 세션 상태 확인:

```bash
aios hud --provider codex
aios hud --watch --preset full
aios hud --session <session-id> --json
```

Team Ops 상태 및 이력:

```bash
aios team status --provider codex --watch
aios team history --provider codex --limit 20
```

Skill-candidate 상세 뷰 (2026-04-09+):

```bash
# 기본 제한으로 skill candidates 표시 (일반 모드 6 개, fast-watch minimal 모드 3 개)
aios team status --show-skill-candidates

# candidate 제한 설정 (1-20)
aios team status --show-skill-candidates --skill-candidate-limit 10

# Fast-watch 모드는 자동 최소 제한 (3 개 candidates)
aios team status --watch --fast

# HUD 도 skill-candidate 뷰 지원
aios hud --show-skill-candidates --skill-candidate-limit 5
```

Quality-gate 카테고리 필터 (2026-04-08+):

```bash
# quality-gate 실패 세션만 표시
aios team history --quality-failed-only

# quality category prefix 로 필터
aios team history --quality-category clarity
aios team history --quality-category sample.latency-watch
```

Dispatch hindsight 와 draft 권장 (2026-04-07+):

```bash
# Learn-eval 이 draft skill-candidate patches 표시
aios learn-eval --limit 10

# HUD 는 사용 가능할 때 skill-candidate apply 명령 제안
aios hud --session <session-id>
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

### 이것이 네이티브 CLI 클라이언트를 대체하나요?

아니요. 네이티브 명령을 그대로 실행합니다. 래퍼는 컨텍스트 주입과 호환성 유지만 합니다.

###跨프로젝트 기억 오염을 피하는 방법은?

`CTXDB_WRAP_MODE=opt-in`을 사용하고 필요한 프로젝트에서만 `.contextdb-enable`을 생성하세요.

### 래퍼 설치 시 skills도 자동 설치되나요?

아니요. 래퍼와 skills는 의도적으로 분리되어 있습니다. 전역 skills가 필요하면 8단계를 실행하세요.

### `CODEX_HOME points to ".codex"` 오류

`CODEX_HOME`가 상대 경로로 설정된 상태입니다. 절대 경로로 변경하세요:

```bash
export CODEX_HOME="$HOME/.codex"
mkdir -p "$CODEX_HOME"
```

### 브라우저 도구가 실패할 경우 가장 먼저 어떤 명령을 실행해야 하나요?

재설치 전에 `scripts/doctor-browser-mcp.sh`（또는 PowerShell 버전）를 실행하세요.
