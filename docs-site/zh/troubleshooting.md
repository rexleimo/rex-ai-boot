---
title: 故障排查
description: 常见报错与修复步骤。
---

# 故障排查

## Browser MCP 工具不可用

先执行：

```bash
scripts/doctor-browser-mcp.sh
```

如果诊断提示缺依赖，再执行：

```bash
scripts/install-browser-mcp.sh
```

## `EXTRA_ARGS[@]: unbound variable`

原因：旧版 `ctx-agent.sh` 在 `bash set -u` 下展开空数组。

处理：更新到最新 `main` 并重新打开 shell。

## 命令没有被包装

检查：

- 当前目录是 git 项目
- `~/.zshrc` 已 source `contextdb-shell.zsh`
- `CTXDB_WRAP_MODE` 允许当前项目
- `opt-in` 模式下已创建 `.contextdb-enable`
