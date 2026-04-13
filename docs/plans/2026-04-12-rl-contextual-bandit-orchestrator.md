# 2026-04-12 RL Contextual Bandit（Orchestrator 路由）实施计划

## 目标

- 在不破坏现有 `rl-core` / `rl-mixed-v1` 流程的前提下，新增一条真实在线学习链路：
  - `orchestrator` 执行器选择使用 contextual bandit 做动作选择；
  - episode 结果回流为 bandit trajectory；
  - `runOnlineUpdateBatch` 在同一批次中同时支持 PPO 与 bandit 更新。

## 变更范围

- `scripts/lib/rl-core/trainer.mjs`
  - 新增 bandit policy state、动作采样、bandit update。
  - 新增 trajectory 路由更新器，按 `updateType` 分流到 PPO 或 bandit。
- `scripts/lib/rl-orchestrator-v1/schema.mjs`
  - 新增 bandit trace 校验器。
- `scripts/lib/rl-orchestrator-v1/decision-runner.mjs`
  - 支持可选 `selectedExecutor` 输入，并将其反映到 evidence。
- `scripts/lib/rl-orchestrator-v1/adapter.mjs`
  - `runEpisode` 接受 policy，生成/返回 `bandit_trace`。
- `scripts/lib/rl-mixed-v1/run-orchestrator.mjs`
  - orchestrator episode 构建 bandit trajectory。
  - mixed batch 更新调用启用 trajectory 路由更新器。
  - summary 暴露 bandit policy 状态（用于验证/监控）。

## 验证计划

- `node --test scripts/tests/rl-core-trainer.test.mjs`
- `node --test scripts/tests/rl-orchestrator-v1-schema.test.mjs scripts/tests/rl-orchestrator-v1-adapter.test.mjs`
- `node --test scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs`

## 完成标准

- orchestrator 环境在 mixed campaign 中出现可观测 bandit update（`update_count > 0`）。
- adapter episode 包含结构化 `bandit_trace`（启用 policy 时）。
- 现有 RL 相关测试通过，且未改变非 orchestrator 轨迹的 PPO 默认行为。

## 执行结果（2026-04-12）

- 已完成：
  - `rl-core/trainer.mjs` 增加 `selectContextualBanditAction`、`applyContextualBanditUpdate`、`applyTrajectoryUpdate`。
  - `rl-orchestrator-v1/adapter.mjs` 在 episode 执行阶段注入 bandit 选路并输出 `bandit_trace`。
  - `rl-orchestrator-v1/decision-runner.mjs` 支持 `selectedExecutor`，并在 fixture 中将选路反馈到 outcome。
  - `rl-orchestrator-v1/schema.mjs` 增加 `validateOrchestratorBanditTrace`。
  - `rl-mixed-v1/run-orchestrator.mjs` 为 orchestrator episode 生成 bandit trajectory，并启用混合 updater 路由。
  - `rl-mixed-v1/run-orchestrator.mjs` 将 orchestrator bandit reward 升级为多信号融合（成功率/回滚率/人工接管率 + terminal/missed-handoff/blocked 惩奖）。
  - 测试新增断言：bandit update、生效 trace、mixed summary 中的 bandit policy state。
  - `rl-mixed-v1/run-orchestrator.mjs` 增加 policy checkpoint 持久化/恢复（`active_policy + reference_policy`），`resume=true` 自动恢复，损坏文件降级冷启动且不中断训练。
  - `rl-orchestrator-v1/decision-runner.mjs` 增加 real harness（调用 `runOrchestrate` dry-run）并将 dispatch evidence 映射到 RL evidence，支持 infra error 自动回退 fixture。
  - `rl-orchestrator-v1/decision-runner.mjs` 增加 live->dry-run 闭环：real harness 可先尝试 `executionMode=live`，当 live 无 dispatch evidence 或失败时自动回退 `dry-run`，并把 requested/effective/attempted execution mode 与 fallback reason 写入轨迹 evidence。
  - `rl-orchestrator-v1/adapter.mjs` 增加 `harnessMode/harnessOptions`，默认 fixture，不破坏原路径；mixed campaign 可切换 `orchestratorHarnessMode=real` 采样真实轨迹。
  - `rl-orchestrator-v1/eval-harness.mjs` 支持 `harnessMode/harnessOptions`，可直接用 real harness 做 holdout 评估；`rl-mixed-v1/run-orchestrator.mjs` 增加 `orchestratorHoldoutHarnessMode` 配置，支持 mixed campaign 评估链路与采样链路一致化。
  - `rl-mixed-v1/run-orchestrator.mjs` 将 policy checkpoint 升级为版本化存储（`latest + index + version files`），支持 `policyResumeTarget=latest|last-good|<version-id>` 回滚恢复策略，并在 summary 暴露 `loaded_version_id/latest_version_id/last_good_version_id` 等元信息。
  - `rl-mixed-v1` summary 新增 `policy_checkpoint` 元信息（路径、加载状态、保存状态、update/batch 计数）。
  - `rl-mixed-v1` summary 新增 `orchestrator_holdout_harness_mode`，用于标记当前评估轨迹来源。
  - 测试新增断言：policy checkpoint 落盘与 resume 续训、损坏版本回退、`last-good` 版本回滚恢复、real harness 采样与 fallback 行为。
  - 测试新增断言：live->dry-run execution fallback 元数据、real holdout 评估路径与 mixed campaign real holdout 模式联动。

- 验证证据（全部通过）：
  - `node --test scripts/tests/rl-core-trainer.test.mjs`（`11/11` pass）
  - `node --test scripts/tests/rl-orchestrator-v1-schema.test.mjs scripts/tests/rl-orchestrator-v1-adapter.test.mjs`（`4/4` pass）
  - `node --test scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs`（`3/3` pass）
  - `node --test scripts/tests/rl-shell-v1-trainer.test.mjs`（`9/9` pass）
  - `node --test scripts/tests/rl-orchestrator-v1-eval-harness.test.mjs`（`1/1` pass）
  - `node --test scripts/tests/rl-orchestrator-v1-adapter.test.mjs scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs`（`11/11` pass）
  - `node --test scripts/tests/rl-orchestrator-v1-adapter.test.mjs scripts/tests/rl-orchestrator-v1-eval-harness.test.mjs scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs`（`14/14` pass）
  - `node --test scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs scripts/tests/rl-orchestrator-v1-adapter.test.mjs scripts/tests/rl-orchestrator-v1-eval-harness.test.mjs`（`15/15` pass）
  - `node --test scripts/tests/rl-core-trainer.test.mjs scripts/tests/rl-orchestrator-v1-schema.test.mjs scripts/tests/rl-orchestrator-v1-eval-harness.test.mjs scripts/tests/rl-shell-v1-trainer.test.mjs`（`22/22` pass）
  - `node --test scripts/tests/rl-core-trainer.test.mjs scripts/tests/rl-orchestrator-v1-schema.test.mjs scripts/tests/rl-shell-v1-trainer.test.mjs`（`21/21` pass）
  - `npm run test:scripts`（`290/290` pass）
  - `cd mcp-server && npm run typecheck && npm run test && npm run build`（`typecheck/test/build` pass）

## 执行结果（2026-04-13，补齐 1 + 2 + 3）

- 1) OPE（IPS/DR）按策略版本落盘：
  - 新增 `scripts/lib/rl-core/ope-eval.mjs`，实现 `evaluateContextualBanditOpe`（IPS / SNIPS / DR + ESS + CI）与 `computeContextualBanditPolicyDistribution`。
  - `rl-mixed-v1/run-orchestrator.mjs` 在每个 batch 生成 bandit OPE 日志（`orchestrator-bandit-ope-log.ndjson`），并在每次 checkpoint 保存时把 OPE 结果写入：
    - `summary.ope`
    - `checkpoint payload.ope`
    - `checkpoint index versions[].ope`（按版本可追踪）。
- 2) reward config + 自动调参：
  - `runMixedCampaign` 新增 `rewardWeights` 与 `rewardAutoTune` 参数。
  - reward 计算改为可注入权重并带边界约束；batch 结束后按退化/改善信号做小步调参（bounded step），并持久化到：
    - `summary.reward_config`
    - `checkpoint payload.reward_config`。
- 3) 稳定性护栏（anneal / drift alerts / auto rollback）：
  - 新增 drift 检测与告警聚合（`summary.stability_guardrails.alerts`）。
  - 新增探索率 annealing（稳定时降探索，漂移/回滚时升探索），记录在 `summary.stability_guardrails.annealing`。
  - 新增 critical 场景下策略自动回滚到 `last-good`（若可用），并在 summary 中暴露 `auto_policy_rollbacks` 与 `policy_checkpoint.rollback_applied`。
- 同步更新：
  - `scripts/lib/rl-mixed-v1/contextdb-summary.mjs` 与对应测试，确保 OPE/reward/stability 进入 run-summary。
  - 新增测试 `scripts/tests/rl-core-ope-eval.test.mjs`。
  - 扩展 `scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs`，覆盖 OPE 落盘、reward 自动调参持久化、guardrails 自动回滚。

- 验证证据（本轮）：
  - `node --test scripts/tests/rl-core-ope-eval.test.mjs`（`3/3` pass）
  - `node --test scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs`（`10/10` pass）
  - `node --test scripts/tests/rl-core-trainer.test.mjs scripts/tests/rl-core-ope-eval.test.mjs scripts/tests/rl-mixed-v1-contextdb-summary.test.mjs scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs`（`25/25` pass）
  - `npm run test:scripts`（`290/290` pass）
  - `cd mcp-server && npm run typecheck && npm run test && npm run build`（`typecheck/test/build` pass）

## 执行结果（2026-04-13，补齐“真实流量接入 + 发布侧门控”）

- 真实流量接入（灰度采样）：
  - `rl-orchestrator-v1/adapter.mjs` 增加 `liveTaskCollector`，支持实时任务流采样（异步）。
  - `rl-mixed-v1/run-orchestrator.mjs` 支持异步 `sampleTask`，并新增 `orchestratorLiveTaskCollector` 参数；summary 新增 `orchestrator_task_source`。
- 发布侧策略门控（自动降级）：
  - 新增 `rl-orchestrator-v1/policy-release-gate.mjs`：
    - `off/observe/canary/full` 发布模式；
    - `rolloutRate` 灰度；
    - kill switch（env/file）；
    - 失败率/连续失败触发自动降级；
    - 状态持久化（release state file）。
  - `rl-orchestrator-v1/decision-runner.mjs` real harness 接入门控：
    - 每次执行前做 release route 决策；
    - evidence 回写 `policy_release_*` 字段；
    - 触发降级时写入 `policy_release_downgraded` 与 next mode/rate。

- 本轮验证证据（全部通过）：
  - `node --test scripts/tests/rl-orchestrator-v1-adapter.test.mjs`（`9/9` pass）
  - `node --test scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs scripts/tests/rl-mixed-v1-contextdb-summary.test.mjs`（`13/13` pass）
  - `npm run test:scripts`（`290/290` pass）
  - `cd mcp-server && npm run typecheck && npm run test && npm run build`（`typecheck/test/build` pass）

## 执行结果（2026-04-13，补齐“1：策略执行器强绑定实际调度”）

- 已完成：
  - `memory/specs/orchestrator-executors.json` 增加 `local-control` 执行器定义（phase job 可调度）。
  - `scripts/lib/harness/orchestrator-executors.mjs`
    - 导出 `LOCAL_CONTROL_EXECUTOR`；
    - `LOCAL_DISPATCH_EXECUTORS` 纳入 `local-control`；
    - 本地执行器 registry 增加 `local-control -> executePhaseJob` 路由。
  - `scripts/lib/harness/orchestrator.mjs`
    - `buildLocalDispatchPlan(input, options)` 新增 `options.phaseExecutor`；
    - phase job 的 `launchSpec.executor` 可按策略覆写；
    - merge-gate 仍固定 `local-merge-gate`；
    - 对不支持的覆写做确定性 fallback（回退 `local-phase`）并记录 reason；
    - dispatch plan 新增 `phaseExecutor` 元信息（requested/applied/reason/fallback_applied）。
  - `scripts/lib/lifecycle/orchestrate.mjs`
    - 内部选项增加 `phaseExecutor`；
    - 本地 dispatch 构建时把该选项传入 `buildLocalDispatchPlan`。
  - `scripts/lib/rl-orchestrator-v1/decision-runner.mjs`
    - real harness 调用 `runOrchestrate` 时透传 `phaseExecutor`（来自 release gate 路由后的 `applied_executor`）；
    - evidence 增加 `dispatch_phase_executor_*` 字段；
    - `executor_selected` 优先使用 dispatch plan 实际 applied executor，避免只写策略候选不影响执行的“假绑定”。

- 新增/扩展测试：
  - `scripts/tests/aios-orchestrator-agents.test.mjs`
    - 覆盖 `buildLocalDispatchPlan` phase executor override 与 unsupported fallback。
  - `scripts/tests/aios-orchestrator.test.mjs`
    - 覆盖 `runOrchestrate` 对 `phaseExecutor` 的全链路绑定与 fallback。
  - `scripts/tests/rl-orchestrator-v1-adapter.test.mjs`
    - 覆盖 real harness 在 release gate 路由后把 executor 绑定到 orchestrate options，并反映到 evidence。

- 本轮验证证据（全部通过）：
  - `node --test scripts/tests/aios-orchestrator-agents.test.mjs scripts/tests/rl-orchestrator-v1-adapter.test.mjs scripts/tests/aios-orchestrator.test.mjs`（`105/105` pass）
  - `npm run test:scripts`（`294/294` pass）
  - `cd mcp-server && npm run typecheck && npm run test && npm run build`（`typecheck/test/build` pass）

## 执行结果（2026-04-13，补齐“2：executor 兼容性与发布统计一致性”）

- 已完成：
  - `scripts/lib/rl-orchestrator-v1/decision-runner.mjs`
    - 新增 `policy_release_effective_applied` 与 `policy_release_executor_fallback` 证据字段；
    - 当 release gate 选中的 executor 与 dispatch 实际 applied executor 不一致时，显式标记为 fallback；
    - real harness call record 同步记录 effective/fallback 状态。
  - `scripts/lib/rl-orchestrator-v1/policy-release-gate.mjs`
    - 发布状态计数引入 `policy_fallback`；
    - `updatePolicyReleaseState` 改为按“策略 executor 是否被实际应用”计入 `policy_applied`；
    - 若发生 executor fallback，则计入 `baseline_routed + policy_fallback`，避免把“未真正应用策略”的失败误记为策略失败并触发误降级。
  - `scripts/tests/rl-orchestrator-v1-adapter.test.mjs`
    - 新增用例验证 executor fallback 场景下：
      - evidence 的 effective/fallback 字段正确；
      - release state 计数正确（`policy_applied=0`、`baseline_routed=1`、`policy_fallback=1`）；
      - 不会被误触发自动降级。

- 本轮验证证据（全部通过）：
  - `node --test scripts/tests/rl-orchestrator-v1-adapter.test.mjs`（`11/11` pass）
  - `node --test scripts/tests/rl-mixed-v1-run-orchestrator.test.mjs scripts/tests/rl-mixed-v1-contextdb-summary.test.mjs scripts/tests/aios-orchestrator.test.mjs`（`97/97` pass）
  - `npm run test:scripts`（`294/294` pass）
  - `cd mcp-server && npm run typecheck && npm run test && npm run build`（`typecheck/test/build` pass）
