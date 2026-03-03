---
title: 快速开始
description: 安装、启用包装器并在项目内运行。
---

# 快速开始

## 前置条件

- macOS/Linux + `zsh`
- `node` 与 `npm`
- 已安装至少一个 CLI：`codex` / `claude` / `gemini`

## 1) 一键安装 Browser MCP

macOS / Linux：

```bash
scripts/install-browser-mcp.sh
scripts/doctor-browser-mcp.sh
```

Windows（PowerShell）：

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\install-browser-mcp.ps1
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-browser-mcp.ps1
```

## 2) 构建 ContextDB CLI

```bash
cd mcp-server
npm install
npm run build
```

## 3) 配置 shell 包装

向 `~/.zshrc` 添加：

```zsh
# >>> contextdb-shell >>>
export ROOTPATH="${ROOTPATH:-$HOME/cool.cnb/rex-ai-boot}"
export CTXDB_WRAP_MODE=opt-in
if [[ -f "$ROOTPATH/scripts/contextdb-shell.zsh" ]]; then
  source "$ROOTPATH/scripts/contextdb-shell.zsh"
fi
# <<< contextdb-shell <<<
```

```bash
source ~/.zshrc
```

## 4) 在目标项目启用

```bash
touch .contextdb-enable
```

## 5) 直接使用

```bash
codex
claude
gemini
```
