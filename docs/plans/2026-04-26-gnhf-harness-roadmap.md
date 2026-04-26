# Gnhf 对 AIOS 的 Harness 路线图

日期：2026-04-26

## 1. 范围

这份文档只回答一个问题：

`kunchenguid/gnhf` 在“长时间无人值守执行”这条线上，有哪些值得 AIOS 借鉴的地方？

它不是完整竞品路线图，不重新讨论 ContextDB 全量能力、Browser MCP、Browser smoke evidence、team template 生成等更宽的话题。这里的焦点很窄：**怎么让 AIOS 的 overnight / unattended harness 变得更顺手、更稳定、更容易恢复。**

## 2. 一句话结论

AIOS 不应该“变成 gnhf”，但应该补上一条更锋利的单任务长跑模式。

更准确地说：

- `gnhf` 的优势不在能力面更宽，而在默认执行循环更干净；
- AIOS 的优势不在单轮循环更简单，而在整体控制面更强：有 `ContextDB`、`Privacy Guard`、`orchestrate/team`、preflight gate、snapshot rollback、Browser MCP；
- 所以正确方向不是替换，而是**在 AIOS 现有体系上，增加一个 gnhf 风格的 solo overnight harness 模式**。

## 3. 现状对比

| 维度 | gnhf | AIOS 现在 | 对 AIOS 的启发 |
|---|---|---|---|
| 主任务形态 | 一个目标，一个循环，一个活跃 agent | 多 worker、多会话、blueprint、wrapper + ContextDB 恢复 | 增加一个“单任务夜跑”入口，降低无人值守使用门槛 |
| 运行记忆 | `.gnhf/runs/<runId>/prompt.md`、`notes.md`、schema、debug log | ContextDB session / checkpoint / continuity summary / dispatch artifact | 保留 ContextDB 为主记忆，但增加更直观的 run journal |
| 失败语义 | 成功就 commit，失败就 reset，硬错误指数退避 | snapshot rollback、retry-blocked、watchdog、preflight、ownership gate | 把失败分类和 backoff 策略做得更显式 |
| 隔离方式 | 可选 worktree 独立运行 | 有 `team`/`orchestrate`，也有部分场景的 worktree 隔离 | 给长跑 harness 增加 first-class worktree 模式 |
| provider 适配 | 很薄、很硬、很克制 | 能力更广，但 runtime surface 更重 | 借鉴它的 adapter discipline 和 operator UX |
| 操作体验 | “睡前开跑，醒来看结果”非常直接 | 更强大，但心智负担更高 | 补一个更适合 unattended run 的默认路径 |

## 4. AIOS 最值得借鉴的点

### P0-1：Run Journal（运行日志包）契约

AIOS 现在证据很多，但分散：

- ContextDB session
- checkpoint
- dispatch artifact
- 各类 runtime log
- HUD / team status 输出

这对系统能力是好的，但对“早上起来快速看昨晚跑了什么”并不友好。

建议在 AIOS 的 session artifact 下新增一层**人类可快速阅读的 run journal**，例如：

- `objective.md`
- `iteration-<n>.json`
- `iteration-<n>.log.jsonl`
- `operator-notes.md`
- `run-summary.json`

这里要强调：

- 这不是替代 `ContextDB`
- 这是附加在 `ContextDB` 上的一层 operator 视图

作用类似 gnhf 的：

- `prompt.md`
- `notes.md`
- `gnhf.log`

这样用户不需要先理解整套 AIOS artifact 结构，也能知道：

- 目标是什么
- 跑到第几轮了
- 最近一次成功/失败是什么
- 下一步该怎么接手

### P0-2：Iteration Outcome（迭代输出）契约

gnhf 有一个非常值得借鉴的思想：

**每一轮不是“随便跑一下”，而是必须产出结构化结果。**

AIOS 的 solo harness 也应该引入统一迭代输出结构，例如：

- `success`
- `summary`
- `keyChanges`
- `keyLearnings`
- `nextAction`
- `shouldStop`
- `failureClass`

这样做的好处：

- watchdog 不再只是“看到日志变了没”
- learn-eval 不再只能吃碎片化 artifact
- HUD 不必猜“这一轮到底算成功还是失败”
- resume 时可以更稳定地把“上一轮结论”交给下一轮

这会把 unattended run 从“日志堆积”变成“有协议的状态机”。

### P0-3：Failure Policy + Backoff（失败分类与退避）

AIOS 已经有 rollback、retry、snapshot 恢复等能力，但目前更像“已有工具箱”，还不是一个对用户特别清晰的失败策略系统。

建议把 solo harness 的失败分成几类：

- agent 自己报告“没推进”或“被阻塞”
- tool / runtime 故障
- workspace mutation 故障
- ownership / preflight / safety gate 触发
- stop condition 达成

建议策略：

- **业务性失败但工作区干净**：立即进入下一轮，prompt 缩窄
- **基础设施失败**：指数退避 + 重试预算
- **ownership / safety 违规**：直接停下，进入 human gate
- **工作区损坏但可恢复**：优先 snapshot rollback，而不是粗暴全局 reset

这里要明确一点：

gnhf 的 `git reset --hard` 能成立，是因为它的模型假设更窄：

- clean repo
- 单 lane
- 单目标
- 简单 workspace contract

AIOS 不应该直接照搬这一点，因为 AIOS 已经有更安全的：

- pre-mutation snapshot
- owned-path
- session-aware recovery

所以我们借鉴的是**失败语义清晰**，不是**恢复方式一模一样**。

### P0-4：Worktree-Preserving Overnight Mode

gnhf 的一个高价值点是：它把“并发隔离”变成默认可理解行为。

AIOS 已经在部分路径里使用 worktree 思维，但对长跑 harness 还不够第一类。

建议新增一个更清晰的 overnight 模式：

- 从稳定 base branch 启动
- 创建 run-specific worktree
- 在 worktree 中执行单目标循环
- 有有效输出时保留 worktree
- 空跑或无提交时自动清理

这样有两个直接好处：

1. 不污染主工作区
2. 用户更容易 review / cherry-pick / merge 夜跑结果

相比直接让用户上来就用：

- `aios team 3:codex "Ship X"`

这种模式更适合单目标、低监督、过夜任务。

## 5. AIOS 不应该照搬的点

### 5.1 不要用 `notes.md` 取代 `ContextDB`

`notes.md` 很适合作为 run journal 的人类视图，但不适合作为 AIOS 的主记忆系统。

AIOS 现有优势之一就是：

- ContextDB session
- checkpoint
- continuity summary
- cross-session memory

这些都比单个 markdown 文件更强。

所以正确做法是：

- `ContextDB` 继续当 canonical memory
- `run journal` 只做人类友好的“夜跑摘要层”

### 5.2 不要直接照搬 blanket `git reset --hard`

这对 gnhf 合理，对 AIOS 不一定合理。

AIOS 未来如果引入 solo harness，也应该优先使用：

- snapshot rollback
- owned-path-aware restore
- artifact-aware recovery

而不是遇到问题就全局清空工作区。

### 5.3 不要把 `team` / `orchestrate` 简化没了

这份路线图的目的不是“让 AIOS 变简单”，而是：

**在强控制面之上，再增加一个更轻的 unattended lane。**

也就是说：

- `team` 继续适合多 worker 协作
- `orchestrate` 继续适合 DAG / preflight / blueprint
- `harness` 适合单任务、夜跑、可恢复循环

三者应该并存，而不是互相吞掉。

## 6. 推荐落地顺序

### Milestone 1：打基础

目标：先把“夜跑结果可读、可解释、可恢复”做出来。

建议顺序：

1. 增加 run journal artifact 契约
2. 增加 iteration outcome 统一结构
3. 增加 failureClass + backoff state

成功信号：

- 一次 unattended run 结束后，用户不看原始 logs 也知道发生了什么
- 能区分“没推进”“基础设施炸了”“需要人工接管”

### Milestone 2：做隔离和恢复

目标：让它真的适合过夜跑。

建议顺序：

1. 增加 worktree-backed overnight mode
2. 有成果时保留 worktree，无成果时自动清理
3. 增加 resume 命令，把 run journal、worktree、ContextDB session 绑在一起

成功信号：

- 用户可以“一条命令启动，一条命令恢复”
- 昨晚跑出的结果留在隔离工作区，方便 review

### Milestone 3：补 provider 与 UX

目标：把它从“能跑”补到“稳定好用”。

建议顺序：

1. 增加 provider profile 校验和 reserved-flag 保护
2. 增加简洁的 overnight status / HUD 视图
3. 把 iteration outcome 接进 watchdog 和 learn-eval

成功信号：

- `codex` / `claude` / `gemini` / `opencode` 的行为更一致
- 卡住、重试、退避原因都能变成明确状态，而不是藏在日志里

## 7. 我建议的 PR 拆分

| PR | 内容 | 主要落点 | 为什么这样排 |
|---|---|---|---|
| PR-1 | Run journal contract | `scripts/lib/harness/*` + ContextDB artifact linkage | 先把 operator 能看懂的 substrate 建起来 |
| PR-2 | Iteration outcome + failure classes | harness runner + watchdog integration | 先把行为解释清楚，再做更多自动化 |
| PR-3 | Overnight worktree mode | 新的 solo harness command | 这是最直接的 gnhf 风格用户价值 |
| PR-4 | Resume + status UX | HUD / lifecycle commands | 让它真正可运营、可接手 |
| PR-5 | Provider profile hardening | runtime adapter layer | 最后统一跨 provider 行为 |

## 8. 推荐命令形态

我不建议把这套逻辑继续塞进 `team`。

更清晰的方式是新开一个命名空间：

```bash
aios harness run --objective "Reduce API complexity without behavior changes" --worktree
aios harness resume --session <session-id>
aios harness status --session <session-id> --json
aios harness stop --session <session-id>
```

理由：

- `team` 语义应该继续代表多 worker
- `orchestrate` 语义应该继续代表 DAG / preflight / plan-driven dispatch
- `harness` 最适合承载“单 lane、长循环、可恢复、无人值守”这条路线

## 9. 证据来源

### gnhf 侧证据

- `temp/competitor-repos/kunchenguid__gnhf/README.md:44`
- `temp/competitor-repos/kunchenguid__gnhf/README.md:47`
- `temp/competitor-repos/kunchenguid__gnhf/README.md:138`
- `temp/competitor-repos/kunchenguid__gnhf/README.md:146`
- `temp/competitor-repos/kunchenguid__gnhf/README.md:186`
- `temp/competitor-repos/kunchenguid__gnhf/README.md:239`
- `temp/competitor-repos/kunchenguid__gnhf/src/core/orchestrator.ts:63`
- `temp/competitor-repos/kunchenguid__gnhf/src/core/run.ts:63`
- `temp/competitor-repos/kunchenguid__gnhf/src/core/git.ts:59`
- `temp/competitor-repos/kunchenguid__gnhf/src/core/git.ts:125`
- `temp/competitor-repos/kunchenguid__gnhf/src/core/git.ts:134`
- `temp/competitor-repos/kunchenguid__gnhf/src/core/config.ts:10`
- `temp/competitor-repos/kunchenguid__gnhf/src/core/agents/codex.ts:87`
- `temp/competitor-repos/kunchenguid__gnhf/src/core/debug-log.ts:40`

### AIOS 现有能力证据

- `README.md:142`
- `README.md:164`
- `README.md:178`
- `README.md:198`
- `README.md:743`
- `README.md:873`
- `scripts/aios.mjs:236`
- `scripts/aios.mjs:262`
- `docs/reports/2026-04-23-harness-intelligence-upgrade-report.md:104`
- `docs/plans/2026-04-25-competitor-feature-roadmap.md:64`

## 10. 最终判断

gnhf 对 AIOS 最有价值的，不是新的 memory 架构，也不是新的 orchestrator DAG。

真正值得抄的是它对“无人值守进度”的默认约束：

- 一个目标
- 一个隔离工作区
- 一份容易读的 run journal
- 每轮都有明确成功/失败结果
- 恢复路径足够明显

所以 AIOS 的正确方向是：

**保留现有 ContextDB / snapshot rollback / watchdog / orchestrate / team 的强能力，再新增一条更轻、更直接、更适合夜跑的 `aios harness` 单任务模式。**
