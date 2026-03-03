---
title: 故障排查
description: 常见报错与修复步骤。
---

# 故障排查

## Browser MCP 工具不可用

先执行（macOS / Linux）：

```bash
scripts/doctor-browser-mcp.sh
```

Windows（PowerShell）执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-browser-mcp.ps1
```

如果诊断提示缺依赖，再执行安装脚本：

```bash
scripts/install-browser-mcp.sh
```

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\install-browser-mcp.ps1
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
