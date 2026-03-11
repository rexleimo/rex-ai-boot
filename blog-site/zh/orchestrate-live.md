# Orchestrate Live 终于不是摆设了：Subagent Runtime 正式可用

如果你一直把 `aios orchestrate` 当作「蓝图预览 + 本地 dry-run」的安全门禁，那么这次迭代补齐了最关键的一块：`subagent-runtime` 现在可以真正执行编排阶段任务了。

## 这次到底更新了什么

过去：

- `--execute dry-run` 只会生成 DAG 并产出模拟 handoff（0 token）
- `--execute live` 虽然有门禁，但运行时基本是 stub

现在：

- `--execute live` 会通过你选择的 CLI（`codex` / `claude` / `gemini`）执行每个 phase job
- 并发 phase 会按 `AIOS_SUBAGENT_CONCURRENCY` 控制并发度
- 并发组结束后会进入 merge-gate：校验 JSON handoff，并在文件所有权冲突时直接阻塞

## 默认依旧安全

live 默认关闭，必须显式 opt-in：

```bash
export AIOS_EXECUTE_LIVE=1
export AIOS_SUBAGENT_CLIENT=codex-cli  # 或 claude-code, gemini-cli
aios orchestrate --session <session-id> --dispatch local --execute live --format json
```

提示（codex-cli）：推荐 Codex CLI >= v0.114。AIOS 会在可用时自动使用 `codex exec` 的结构化输出（`--output-schema`、`--output-last-message`、stdin），让 JSON handoff 更稳定。

关于 token 成本：

- `dry-run` 不会调用任何模型
- `live` 会调用所选 CLI，所以 token/费用取决于你用的客户端

## 常用环境变量

- `AIOS_SUBAGENT_CONCURRENCY`（默认：`2`）
- `AIOS_SUBAGENT_TIMEOUT_MS`（默认：`600000`）
- `AIOS_SUBAGENT_CONTEXT_LIMIT`（默认：`30`）
- `AIOS_SUBAGENT_CONTEXT_TOKEN_BUDGET`（可选）

## 失败语义（你会看到什么）

`subagent-runtime` 会返回结构化的 per-job 执行结果。常见 `blocked` 原因包括：

- 上游依赖 job 已阻塞
- 选定 CLI 不在 `PATH` 或未安装
- 子代理输出不是合法 JSON（handoff 解析/校验失败）
- merge-gate 因并发分支“文件所有权冲突”而阻塞

## 为什么这很重要

这意味着「并发编排」终于从“纸面流程”变成了“可执行流程”，而且不需要引入新的闭源 runtime：

- 蓝图还是那套蓝图
- 记忆还是 ContextDB
- 合并规则还是显式的 ownership/merge-gate
- 只是把 live 执行补齐，并且依旧默认安全
