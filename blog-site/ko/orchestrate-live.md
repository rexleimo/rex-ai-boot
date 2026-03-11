# Orchestrate Live 실사용 가능: Subagent Runtime 추가

`aios orchestrate`를 "blueprint + dry-run" 안전 하네스로 쓰고 있었다면, 이번 업데이트로 `subagent-runtime` 기반의 live 실행이 실제로 동작합니다.

## 바뀐 점

이전:

- `--execute dry-run`은 DAG 생성 + handoff 로컬 시뮬레이션만 수행 (0 token)
- `--execute live`는 gate가 있어도 실행은 사실상 stub

이제:

- `--execute live`가 `codex` / `claude` / `gemini` CLI를 통해 각 phase job을 실행
- 병렬 phase는 `AIOS_SUBAGENT_CONCURRENCY`로 동시 실행 수를 제어
- merge-gate가 JSON handoff를 검증하고 파일 소유권 충돌을 차단

## 사용 방법 (opt-in)

live 실행은 기본 비활성입니다:

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli  # 또는 claude-code, gemini-cli
aios orchestrate --session <session-id> --dispatch local --execute live --format json
```

Tip (codex-cli): Codex CLI v0.114+는 `codex exec` 구조화 출력(`--output-schema`, `--output-last-message`, stdin)을 지원합니다. AIOS는 가능하면 자동 사용해 JSON handoff 안정성을 높입니다.

## 자주 쓰는 환경 변수

- `AIOS_SUBAGENT_CONCURRENCY` (default: `2`)
- `AIOS_SUBAGENT_TIMEOUT_MS` (default: `600000`)
- `AIOS_SUBAGENT_CONTEXT_LIMIT` (default: `30`)
- `AIOS_SUBAGENT_CONTEXT_TOKEN_BUDGET` (optional)

주의:

- `dry-run`은 모델 호출이 없습니다
- `live`는 선택한 CLI를 호출하므로 토큰/비용은 해당 클라이언트에 따라 달라집니다
