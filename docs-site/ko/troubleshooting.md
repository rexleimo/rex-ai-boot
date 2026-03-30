---
title: 문제 해결
description: 일반적인 설치/런타임 문제 및 직접 수정 방법.
---

# 문제 해결

## 빠른 답변 (AI 검색)

대부분의 실패는 설정 문제입니다 (MCP 런타임 누락, 래퍼 미로드, 또는 잘못된 랩 모드). 먼저 doctor 스크립트를 실행하고 래퍼 스코프를 확인하세요.

## Browser MCP 도구 이용 불가

**대부분의 경우**: Playwright MCP가 설치되지 않았거나, `~/.config/codex/` (또는 `~/.config/claude/` 등)의 MCP 설정에 `puppeteer-stealth` 앨리어스가 없습니다.

Doctor 스크립트로 확인하세요:

=== "macOS / Linux"

    ```bash
    scripts/doctor-browser-mcp.sh
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-browser-mcp.ps1
    ```

또는 `~/.config/codex/mcp.json` (또는 `~/.config/claude/settings.json` for Claude Code, `~/.gemini/mcp.json` for Gemini CLI)를 열고 다음이 포함되어 있는지 확인하세요:

```json
{
  "mcpServers": {
    "puppeteer-stealth": {
      "command": "node",
      "args": ["/path/to/rex-cli/mcp-server/dist/puppeteer-stealth-server.js"]
    }
  }
}
```

## 명령어가 랩되지 않음

`codex` / `claude` / `gemini`를 입력해도 랩되지 않는 경우:

1. `source ~/.zshrc` (또는 `~/.bashrc`)를 실행하여 래퍼를 다시 로드
2. `echo $CTXDB_WRAP_MODE`로 래퍼 스코프 확인 (`opt-in`인 경우 `.contextdb-enable` 마커 필요)
3. 랩 대상 디렉터리로 `cd` (`.contextdb-enable` 파일 존재 확인)
4. 새 터미널 세션 열기

## 래퍼가 로드되었지만 비활성화하고 싶음

래퍼를 영구적으로 비활성화하려면:

```zsh
export CTXDB_WRAP_MODE=off
```

특정 명령만 패스스루하려면 `CTXDB_WRAP_MODE=passthrough`를 사용:

```zsh
export CTXDB_WRAP_MODE=passthrough
# 이렇게 하면 codex/claude/gemini가 직접 실행됨
```

## better-sqlite3 / ContextDB가 Node 전환 후 실패

RexCLI는 **Node 22 LTS**를 지원합니다. shell이 Node 25 또는 이전 ABI 비호환 설치에서 실행 중인 경우 ContextDB 관련 명령이 실패할 수 있습니다.

빠른 수정:

```bash
node -v
source ~/.nvm/nvm.sh && nvm use 22
cd mcp-server && npm rebuild better-sqlite3
```

재시도:

```bash
npm run test:scripts
```

## `search`가 사이드카 손실 후 빈 결과 반환

`memory/context-db/index/context.db`가 없거나 오래된 경우:

1. `cd mcp-server && npm run contextdb -- index:rebuild` 실행
2. `search` / `timeline` / `event:get` 재실행

## `contextdb context:pack failed`

`contextdb context:pack`이 실패하면 `ctx-agent`는 **경고 후 계속 진행** 합니다 (컨텍스트 미주입 상태로 CLI 실행).

팩킹 실패를 치명적으로 만들려면:

```bash
export CTXDB_PACK_STRICT=1
```

셸 래퍼(`codex`/`claude`/`gemini`)는 인터랙티브 세션이 깨지는 것을 피하기 위해 `CTXDB_PACK_STRICT=1`을 설정해도 기본은 fail-open입니다. 인터랙티브 래핑도 엄격 모드로 강제하려면:

```bash
export CTXDB_PACK_STRICT_INTERACTIVE=1
```

자주 발생하면 퀄리티 게이트(ContextDB 회귀 체크 포함)를 실행하세요:

```bash
aios quality-gate pre-pr --profile strict
```

## `/new` (Codex) 또는 `/clear` (Claude/Gemini) 후 컨텍스트 사라짐

이러한 명령은 **CLI 내부 대화 상태**를 리셋합니다. ContextDB 데이터는 디스크에 남아 있지만 래퍼가 컨텍스트 패킷을 주입하는 것은 **CLI 프로세스 시작 시**뿐입니다.

복구 방법:

- 권장: CLI를 종료한 뒤 셸에서 `codex` / `claude` / `gemini`를 다시 실행
- 같은 프로세스에서 계속해야 한다면: 새 대화 첫 메시지에서 최신 스냅샷을 읽도록 요청:
  - `@memory/context-db/exports/latest-codex-cli-context.md`
  - `@memory/context-db/exports/latest-claude-code-context.md`
  - `@memory/context-db/exports/latest-gemini-cli-context.md`

클라이언트가 `@file` 참조를 지원하지 않으면 파일 내용을 첫 프롬프트로 붙여넣으세요.

## `aios orchestrate --execute live`가 블록/실패함

`AIOS_EXECUTE_LIVE`와 `AIOS_SUBAGENT_CLIENT`가 설정되어 있는지 확인하세요:

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli  # 필수 (live는 현재 codex-cli만 지원)
```

`codex` v0.114+를 사용하면 `codex exec` 구조화 출력을 활용합니다. 구버전은 stdout 파싱으로 폴백합니다.

## `ctx-agent` 실행 오류: `claude: command not found`

이전 `ctx-agent.sh`를 사용 중입니다. `main`을 최신화하세요.

최신 버전은 `ctx-agent-core.mjs`에 실행 로직을 통합하여 sh/mjs 구현 차분을 해소했습니다.

## RexCLI 소스 레포 내에서 `--scope project`가 실패함

canonical skill source tree 마이그레이션 후 발생합니다. 이는 의도적인 동작입니다:

- `skill-sources/`가 작성 트리입니다
- repo-local의 `.codex/skills` / `.claude/skills` / `.agents/skills`는 sync 관리 생성 디렉터리입니다
- 소스 레포 자신에 대한 `--scope project` 인스톨은 의도적으로 차단되어 있습니다

대신 다음을 실행하세요:

```bash
node scripts/sync-skills.mjs
node scripts/check-skills-sync.mjs
```

다른 프로젝트에 skills를 설치하고 싶다면 해당 워크스페이스로 전환한 뒤 `aios ... --scope project`를 실행하세요.

## 이 저장소 skills가 다른 프로젝트에서 보이지 않음

래퍼와 skills는 분리되어 있습니다. 전역 skills를 별도로 설치하세요. `--client all`은 `codex` / `claude` / `gemini` / `opencode`를 함께 대상으로 합니다.

=== "macOS / Linux"

    ```bash
    scripts/install-contextdb-skills.sh --client all
    scripts/doctor-contextdb-skills.sh --client all
    ```

=== "Windows (PowerShell)"

    ```powershell
    powershell -ExecutionPolicy Bypass -File .\\scripts\\install-contextdb-skills.ps1 -Client all
    powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-contextdb-skills.ps1 -Client all
    ```

## GitHub Pages `configure-pages` 찾을 수 없음

이通常是 Pages 소스가 완전히 활성화되지 않았음을 의미합니다.

GitHub 설정에서 수정:

1. `Settings -> Pages -> Source: GitHub Actions`
2. `docs-pages` 워크플로를 다시 실행

## FAQ

### 브라우저 도구를 사용할 수 없을 때 처음 무엇을 실행해야 하나요?

재설치 전에 `scripts/doctor-browser-mcp.sh`（또는 PowerShell 버전）를 실행하세요.

### `codex`를 입력해도 컨텍스트가 주입되지 않는 이유는 무엇인가요?

일반적으로 래퍼가 로드되지 않았거나, `CTXDB_WRAP_MODE`가 현재 워크스페이스를 커버하지 않거나, 명령어가 패스스루 관리 서브커맨드인 경우입니다.

## Skills가 잘못된 디렉터리에 저장됨

canonical skill source tree는 이제 다음 위치에 있습니다:

- `<repo>/skill-sources`

생성된 repo-local 검색 가능 출력은 다음 위치에 있습니다:

- `<repo>/.codex/skills`
- `<repo>/.claude/skills`

`SKILL.md`를 `.baoyu-skills/`와 같은 병렬 디렉터리에 저장하면 Codex / Claude는 이를 스킬로 검색하지 못합니다.

- `.baoyu-skills/`는 `EXTEND.md`와 같은 확장 설정에만 사용하세요
- 실제 canonical skill 소스 파일은 `skill-sources/<name>/SKILL.md`로 이동하세요
- `node scripts/sync-skills.mjs`로 각 클라이언트의 호환 디렉터리를 다시 생성하세요
- `scripts/doctor-contextdb-skills.sh --client all`로 미지원 스킬 루트 디렉터리를 감지하세요
