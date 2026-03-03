---
title: Windows 指南
description: 在 Windows PowerShell 上完整安装 Browser MCP 与 ContextDB 包装。
---

# Windows 指南

本指南面向 Windows 用户，全部流程基于 PowerShell（不依赖 bash/zsh）。

## 前置条件

- Windows 10/11
- PowerShell 7+（或 Windows PowerShell 5.1）
- Node.js 18+
- 至少安装一个 CLI：`codex` / `claude` / `gemini`

## 1) 安装 Browser MCP

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-browser-mcp.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\doctor-browser-mcp.ps1
```

安装脚本会输出 MCP JSON 配置（带绝对路径 `dist/index.js`），复制到客户端配置并重启客户端。

## 2) 启用 ContextDB PowerShell 包装

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-contextdb-shell.ps1
. $PROFILE
```

这会加载 `scripts/contextdb-shell.ps1` 包装函数。

## 3) 开启项目级 opt-in

在目标项目根目录执行：

```powershell
New-Item -ItemType File -Path .contextdb-enable -Force
```

建议作用域：

```powershell
$env:CTXDB_WRAP_MODE = "opt-in"
```

## 4) 按原命令使用

```powershell
codex
claude
gemini
```

## 5) 浏览器工具冒烟测试

在客户端对话里调用：

1. `browser_launch` `{"profile":"default"}`
2. `browser_navigate` `{"url":"https://example.com"}`
3. `browser_snapshot` `{}`
4. `browser_close` `{}`

## 说明

- 如果默认 CDP 端口 `9222` 不可达，`profile=default` 会自动回退到本地启动。
- 浏览器工具不可用时，优先执行 `scripts/doctor-browser-mcp.ps1`。
