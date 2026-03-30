---
title: 아키텍처
description: wrapper, runner, ContextDB 구성.
---

# 아키텍처

- `scripts/contextdb-shell.zsh`: CLI 래퍼
- `scripts/contextdb-shell-bridge.mjs`: wrap/passthrough 판단 브리지
- `scripts/ctx-agent.mjs`: 통합 러너
- `mcp-server/src/contextdb/*`: ContextDB 구현

```text
사용자 명령 -> zsh wrapper -> contextdb-shell-bridge.mjs -> ctx-agent.mjs -> contextdb CLI -> 네이티브 CLI
```

## 스토리지 모델

각 래핑된 워크스페이스는 독립적인 로컬 스토리지를 가집니다（git 루트가 있으면 사용, 없으면 현재 디렉터리）：

```text
memory/context-db/
  manifest.json
  index/sessions.jsonl
  sessions/<session_id>/
  exports/<session_id>-context.md
```

## 격리 제어

`CTXDB_WRAP_MODE`로 래퍼 스코프를 설정합니다：

- `all`：모든 워크스페이스 활성화（非 git 디렉터리 포함）
- `repo-only`：`ROOTPATH` 워크스페이스만
- `opt-in`：마커（`.contextdb-enable`）가 있는 워크스페이스만
- `off`：래핑 비활성화

`opt-in`은 프로젝트별 엄격한 제어가 필요할 때 권장됩니다.

## Harness 레이어 (AIOS)

AIOS는 ContextDB 위에 운영용 harness를 제공합니다:

- `aios orchestrate`는 blueprint 기반 로컬 dispatch DAG 생성
- `dry-run`은 `local-dry-run` 사용 (토큰 비용 없음)
- `live`는 `subagent-runtime` 사용, 외부 CLI (`codex`)로 페이즈 실행 (현재 codex-cli만 지원)
- `AIOS_SUBAGENT_CLIENT=codex-cli`일 때 AIOS는 `codex exec` 구조화 출력(`--output-schema`, `--output-last-message`, stdin)을 우선 사용해 JSON handoff를 안정화합니다 (구버전 폴백).

`live`는 기본 비활성입니다. 아래 설정이 필요합니다:

- `AIOS_EXECUTE_LIVE=1`
- `AIOS_SUBAGENT_CLIENT=codex-cli`

## RL 트레이닝 레이어（AIOS）

AIOS는 멀티 환경 강화학습 시스템을 포함하며, 셸, 브라우저, 오케스트레이터 태스크에서 공유 학생 정책을 지속적으로 개선합니다.

### 공유 제어 플레인（`scripts/lib/rl-core/`）

```
campaign-controller.mjs   # epoch 오케스트레이션（수집 + 모니터링）
checkpoint-registry.mjs  # active / pre_update_ref / last_stable 계통 추적
comparison-engine.mjs     # better / same / worse / comparison_failed
control-state-store.mjs  # 재시작 안전한 제어 스냅샷
epoch-ledger.mjs         # epoch 상태 + 저하 streak
replay-pool.mjs          # 4레인 라우팅（positive/neutral/negative/diagnostic）
reward-engine.mjs        # 환경 reward + teacher 성형 융합
teacher-gateway.mjs      # Codex/Claude/Gemini/opencode의 정규화된 출력
schema.mjs               # 공유 계약 검증
trainer.mjs              # PPO 엔트리포인트（online + offline）
```

### 환경 어댑터

| 어댑터 | 경로 | 트레이닝 초점 |
|---------|------|------------|
| Shell RL | `scripts/lib/rl-shell-v1/` | 합성 버그수정 태스크 → 실제 레포지토리 |
| Browser RL | `scripts/lib/rl-browser-v1/` | 관리된 실제 웹 플로우 |
| Orchestrator RL | `scripts/lib/rl-orchestrator-v1/` | 고가치 제어 의사결정 |
| Mixed RL | `scripts/lib/rl-mixed-v1/` | 크로스 환경 연합 트레이닝 |

### 주요 RL 개념

- **Episode contract**：전체 환경에서 통일된 구조화된 출력（taskId, trajectory, outcome, reward, comparison）
- **3포인터 checkpoint 계통**：`active` → `pre_update_ref` → `last_stable`、저하 시 자동 롤백
- **4레인 replay pool**：positive / neutral / negative / diagnostic_only — 비교 결과에 따른 결정적 라우팅
- **Teacher gateway**：Codex CLI、Claude Code、Gemini CLI、OpenCode의 정규화된 신호

### RL 실행

```bash
# Shell RL 파이프라인
node scripts/rl-shell-v1.mjs benchmark-generate --count 20
node scripts/rl-shell-v1.mjs train --epochs 5
node scripts/rl-shell-v1.mjs eval

#混合환경 campaign
node scripts/rl-mixed-v1.mjs mixed --mixed
node scripts/rl-mixed-v1.mjs mixed-eval
```

### RL 상태

- RL Core：안정（40+ 테스트）
- Shell RL V1：안정（Phase 1–3）
- Browser RL V1：beta
- Orchestrator RL V1：beta
- Mixed RL：실험적（엔드투엔드 검증 완료）

