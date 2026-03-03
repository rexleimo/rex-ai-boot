---
title: 빠른 시작
description: 설치, 래퍼 설정, 프로젝트 활성화.
---

# 빠른 시작

## 사전 요구사항

- macOS/Linux + `zsh`
- `node`, `npm`
- `codex` / `claude` / `gemini` 중 하나

## 1) Browser MCP 원클릭 설치

```bash
scripts/install-browser-mcp.sh
scripts/doctor-browser-mcp.sh
```

## 2) ContextDB CLI 빌드

```bash
cd mcp-server
npm install
npm run build
```

## 3) `~/.zshrc` 설정

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

## 4) 프로젝트에서 활성화

```bash
touch .contextdb-enable
```
