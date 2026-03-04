---
title: 官方案例库
description: 用可复现命令说明 rex-ai-boot 在真实场景里能做什么。
---

# 官方案例库

这页是 `rex-ai-boot` 的能力样例总览。

每个案例都包含：

- `何时使用`
- `执行命令`
- `成功证据`

## 案例 1：新机器 5 分钟完成初始化

```bash
scripts/setup-all.sh --components all --mode opt-in
scripts/verify-aios.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-all.ps1 -Components all -Mode opt-in
powershell -ExecutionPolicy Bypass -File .\scripts\verify-aios.ps1
```

证据：`verify-aios` 返回码为 `0`。

## 案例 2：浏览器 MCP 可用性验证

```bash
scripts/install-browser-mcp.sh
scripts/doctor-browser-mcp.sh
```

聊天里执行：

```text
browser_launch {"profile":"default"}
browser_navigate {"url":"https://example.com"}
browser_snapshot {}
browser_close {}
```

证据：doctor 输出 `Result: OK`，smoke test 无异常。

## 案例 3：跨 CLI 接力（分析 -> 实现 -> 复核）

```bash
scripts/ctx-agent.sh --agent claude-code --prompt "总结阻塞和下一步"
scripts/ctx-agent.sh --agent codex-cli --prompt "根据 checkpoint 完成修复"
scripts/ctx-agent.sh --agent gemini-cli --prompt "复核风险和缺失测试"
```

证据：`memory/context-db/` 新增 session/checkpoint 产物。

## 案例 4：登录墙的人机协同处理

```text
browser_launch {"profile":"local"}
browser_navigate {"url":"https://target.site"}
browser_auth_check {}
```

若返回 `requiresHumanAction=true`，人工登录后继续自动化步骤。

## 案例 5：one-shot 审计闭环

```bash
scripts/ctx-agent.sh --agent codex-cli --project rex-ai-boot --prompt "继续最新 checkpoint 并执行下一步"
```

证据：`memory/context-db/index/checkpoints.jsonl` 与 `exports/` 有新记录。

## 案例 6：Skills 生命周期运维

```bash
scripts/install-contextdb-skills.sh
scripts/doctor-contextdb-skills.sh
scripts/update-contextdb-skills.sh
scripts/uninstall-contextdb-skills.sh
```

证据：doctor 通过，升级/卸载后无损坏链接。

## 案例 7：Shell 包装层修复与回滚

```bash
scripts/doctor-contextdb-shell.sh
scripts/update-contextdb-shell.sh
scripts/uninstall-contextdb-shell.sh
```

证据：包装诊断无阻塞；必要时回滚后原生命令可用。

## 案例 8：发布前安全体检

```bash
scripts/doctor-security-config.sh
```

证据：脚本返回 `0`，告警完成人工确认。

## 说明

英文完整版（持续更新）请见：[`/case-library/`](../case-library.md)。
