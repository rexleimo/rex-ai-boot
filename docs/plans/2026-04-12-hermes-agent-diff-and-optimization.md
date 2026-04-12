# Hermes Agent 对比 AIOS：差异化与学习优化清单（2026-04-12）

## 1. 目标与取证范围

- 目标：拉取 `nousresearch/hermes-agent`，对比 AIOS 当前实现，识别可复用能力与差异化定位。
- Hermes 取证基线：
  - 仓库：`https://github.com/nousresearch/hermes-agent`
  - 本地快照路径：`/tmp/hermes-agent`
  - 提交：`1cec910b`（2026-04-11）
- AIOS 取证范围：
  - `scripts/`
  - `scripts/lib/harness/`
  - `mcp-server/src/contextdb/`
  - `mcp-server/src/browser/`
  - `memory/specs/`

## 2. 一句话定位差异

- Hermes：**单体“会话型 Agent 产品”**（自带 TUI、工具系统、记忆、网关、多平台消息入口）。
- AIOS：**多 CLI 的“编排与记忆中间层”**（ContextDB + orchestrate/team + browser MCP 桥接）。

结论：两者不是完全同类产品，AIOS 的机会点是“把 Hermes 的强闭环能力，嵌入我们已领先的多客户端编排框架”。

## 3. 核心架构对比（机制层）

### 3.1 Agent 主循环与工具体系

- Hermes：
  - 主循环集中在 `run_agent.py`（大一体化执行器）。
  - 工具注册中心：`tools/registry.py`，由 `model_tools.py` 聚合发现与分发。
  - 工具集（toolsets）可配置：`toolsets.py`。
  - 观察到工具注册调用约 51 处（不含动态 MCP 注入）。
- AIOS：
  - 无单体 agent loop；以 `ctx-agent-core.mjs` + `orchestrate.mjs` 作为路由/执行核心。
  - 多角色蓝图驱动编排：`memory/specs/orchestrator-blueprints.json` + `scripts/lib/harness/orchestrator.mjs`。
  - 子代理执行器独立：`scripts/lib/harness/subagent-runtime.mjs`。
  - Browser MCP 工具面更窄（9 个 `browser_*` 兼容工具）。

判断：Hermes 工具层“厚”，AIOS 编排层“深”。

### 3.2 长期记忆、检索与上下文压缩

- Hermes：
  - 记忆工具：`tools/memory_tool.py`（`MEMORY.md` + `USER.md`，有注入/泄露模式扫描）。
  - 会话搜索：`tools/session_search_tool.py`（FTS5 检索 + 辅助模型总结）。
  - 上下文压缩：`agent/context_compressor.py`（在 `run_agent.py` 接入）。
- AIOS：
  - ContextDB：`mcp-server/src/contextdb/`（会话、事件、checkpoint、FTS/BM25、语义重排入口）。
  - 重点在“状态可恢复+证据化”而不是对话式总结注入。

判断：AIOS 在结构化事件/checkpoint 领先；Hermes 在“可读召回（session summary）”体验更强。

### 3.3 多代理并行与执行治理

- Hermes：
  - `tools/delegate_tool.py` 有子代理委派、并发、工具封禁、进度回传。
  - 通过单一 runtime 内部协作。
- AIOS：
  - `orchestrate/team` 明确区分 dry-run/live，支持 merge-gate、ownedPath 约束与证据落盘：
    - `scripts/lib/harness/orchestrator.mjs`
    - `scripts/lib/harness/subagent-runtime.mjs`
    - `scripts/lib/harness/orchestrator-evidence.mjs`
  - Learn-Eval + clarity gate 闭环更工程化（失败分类、重试建议、风险信号）。

判断：AIOS 在“治理与审计”侧更强；Hermes 在“单回合委派体验”更顺滑。

### 3.4 平台接入与运行形态

- Hermes：
  - `gateway/platforms/*.py` 支持多渠道消息入口（Telegram/Discord/Slack/WhatsApp/Signal 等）。
  - 内建 cron、多运行环境（local/docker/ssh/modal/daytona 等）。
- AIOS：
  - 以 codex/claude/gemini/opencode CLI 为主，强调本地/工作区流程一致性。
  - 浏览器能力通过 browser-use MCP 桥接（`scripts/run-browser-use-mcp.sh` + `scripts/lib/components/browser.mjs`）。

判断：Hermes 是“产品入口广”，AIOS 是“开发工作流深”。

## 4. 我们值得学习的“好东西”（按优先级）

## P0（建议先做）

1. 把“会话检索 + LLM 总结”补到 ContextDB 体验层
- 参考 Hermes：`tools/session_search_tool.py`
- AIOS 现状：有 FTS/BM25/semantic，但缺“直接可读回忆摘要”命令
- 落地方向：新增 `contextdb recall:sessions`（先做 top-N 摘要，不改底层 schema）

2. 引入“记忆注入安全扫描”最小集
- 参考 Hermes：`tools/memory_tool.py` 的内容威胁扫描
- AIOS 适配：对将注入 prompt 的持久化记忆条目做规则拦截（invisible char / prompt override / secret exfil pattern）

3. 子代理进度流可视化统一到 HUD
- 参考 Hermes：`delegate_tool.py` 的子任务进度回传
- AIOS 适配：`team status --watch` 补充 job 级 tool-progress 汇总（减少“卡住感”）

## P1（第二批）

4. 工具能力清单做“可用性声明层”
- 参考 Hermes：`toolsets.py` + `tools/registry.py`
- AIOS 适配：在 orchestrator dispatch 前输出 executor 能力表（读写/网络/browser/side-effect）

5. 文件修改前的透明 checkpoint（可回滚）
- 参考 Hermes：`tools/checkpoint_manager.py`（shadow git repo）
- AIOS 适配：先在 live subagent 路径做 opt-in `pre-mutation snapshot`

## P2（按业务取舍）

6. 消息网关/cron 不建议直接照抄
- 这块工程面和运维面非常重，且与 AIOS 的“多 CLI 编排中间层”定位不完全一致。
- 更建议做插件式集成而非主干内建。

## 5. AIOS 的差异化卖点（建议对外强调）

1. 多客户端统一编排（Codex/Claude/Gemini/OpenCode）而非单 Agent runtime。
2. 以 ContextDB checkpoint 为中心的可恢复执行链路。
3. merge-gate + ownedPath 的工程治理能力（适合团队协作与审计）。
4. browser-use MCP 桥接与本地工作区实践（更贴近开发场景）。
5. learn-eval/clarity gate 的结构化反馈闭环（不是只做“会话体验”）。

## 6. “项目名字怎么蹭 Hermes”建议（不踩品牌风险）

不建议直接把主项目命名成 `Hermes` 或 `Hermes Agent` 近似体。建议采用“兼容/风格层”命名，而不是“冒充同名产品”。

可选方案：

1. `AIOS Hermes-Compatible Workflow`（文档/功能标签）
2. `AIOS H-Loop`（副品牌，解释为 Hermes-inspired learning loop）
3. `AIOS AgentOS (Hermes-style memory + orchestration)`（市场文案）

命名规则建议：

- 主仓库名保持 `aios`/`rex-cli` 体系。
- “Hermes”只用于能力标签或兼容层说明，不用于主二进制名。
- 对外文案加一行：`Hermes-inspired, not affiliated with Nous Research.`

## 7. 建议执行顺序（两周内）

Week 1:
- `contextdb recall:sessions`（摘要模式）
- 记忆注入安全扫描（最小规则）

Week 2:
- HUD 子代理进度增强
- dispatch 前能力声明层（executor capability manifest）

完成标志：
- 新命令有测试覆盖；
- `team status --watch` 可见 job/tool 级进度；
- 注入安全规则可拦截至少 3 类高风险内容；
- 文档新增 “Hermes-inspired capability mapping” 页面（已完成：`docs/hermes-inspired-capability-mapping.md`）。

## 8. 当前执行状态（本次已落地）

已完成（Week 1 + Week 2 范围）：

1. `contextdb recall:sessions` 已实现（core API + CLI 命令）
- 代码：
  - `mcp-server/src/contextdb/core.ts`
  - `mcp-server/src/contextdb/cli.ts`
- 测试：
  - `mcp-server/tests/contextdb.test.ts` 新增 recall 核心与 CLI 用例

2. workspace memory 注入安全扫描已实现
- 代码：
  - `scripts/lib/memo/safety.mjs`（安全规则）
  - `scripts/lib/memo/memo.mjs`（`memo add` / `memo pin set|add` 写入前拦截）
  - `scripts/ctx-agent-core.mjs`（workspace memory overlay 注入前过滤 unsafe 项）
- 测试：
  - `scripts/tests/aios-cli.test.mjs` 新增 unsafe memo 拦截测试
  - `scripts/tests/ctx-agent-core.test.mjs` 新增 overlay 安全过滤测试

3. HUD 子代理进度增强已实现（`team status --watch` 可见 job/tool 级进度）
- 代码：
  - `scripts/lib/hud/state.mjs`（新增 `latestDispatch.jobProgress` / `latestDispatch.toolProgress` 聚合）
  - `scripts/lib/hud/render.mjs`（minimal/focused/full 视图新增 dispatch progress 渲染）
- 测试：
  - `scripts/tests/hud-state.test.mjs` 新增/更新 job/tool 进度聚合与渲染断言

4. dispatch 前 executor capability manifest 已实现（读写/网络/browser/side-effect 声明层）
- 代码：
  - `scripts/lib/harness/orchestrator.mjs`（新增 capability manifest 构建/规范化/渲染）
  - `scripts/lib/lifecycle/orchestrate.mjs`（dispatch 执行前生成 manifest 并写入报告）
  - `scripts/lib/harness/orchestrator-evidence.mjs`（artifact 持久化 `executorCapabilityManifest`）
- 测试：
  - `scripts/tests/aios-orchestrator.test.mjs` 新增 capability manifest 构建、渲染、runOrchestrate 与 artifact 断言

5. live subagent `pre-mutation snapshot` 已实现（opt-in 可回滚 checkpoint）
- 代码：
  - `scripts/lib/harness/subagent-runtime.mjs`（新增 `AIOS_SUBAGENT_PRE_MUTATION_SNAPSHOT` 开关；editable phase 执行前生成快照）
  - `scripts/lib/cli/help.mjs`（新增 env 帮助说明）
- 测试：
  - `scripts/tests/aios-orchestrator.test.mjs` 新增 pre-mutation snapshot 覆盖用例

6. Hermes-inspired capability mapping 页面已新增
- 文档：
  - `docs/hermes-inspired-capability-mapping.md`

验证结果：

- `cd mcp-server && npm run typecheck` 通过
- `cd mcp-server && npm run test:contextdb` 通过
- `cd mcp-server && npm run test` 通过
- `cd mcp-server && npm run build` 通过
- `node --test scripts/tests/hud-state.test.mjs` 通过
- `node --test scripts/tests/aios-orchestrator.test.mjs` 通过
- `npm run test:scripts` 通过
- `node --test scripts/tests/aios-cli.test.mjs scripts/tests/ctx-agent-core.test.mjs` 通过
