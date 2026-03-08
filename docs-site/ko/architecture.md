---
title: 아키텍처
description: wrapper, runner, ContextDB 구성.
---

# 아키텍처

- `scripts/contextdb-shell.zsh`: CLI 래퍼
- `scripts/contextdb-shell-bridge.mjs`: wrap/passthrough 판단 브리지
- `scripts/ctx-agent.mjs`: 통합 러너
- `mcp-server/src/contextdb/*`: ContextDB 구현

```text
사용자 명령 -> zsh wrapper -> contextdb-shell-bridge.mjs -> ctx-agent.mjs -> contextdb CLI -> 네이티브 CLI
```
