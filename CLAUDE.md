# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **Xiaohongshu (小红书) Operations Assistant** - an AI agent framework that uses Claude Code with the repo-local browser MCP (`puppeteer-stealth` alias routed to browser-use MCP) to automate operations on Xiaohongshu (xiaohongshu.com), a Chinese social media platform.

## Core Architecture

```
User Task → Claude Code → repo-local browser MCP (`chrome.launch_cdp` / `browser.connect_cdp` / `page.*`) → Xiaohongshu Web
                     ↓
              Memory System (JSON files)
              - skills/      # Learned skills
              - specs/       # Safety specifications
              - history/     # Operation records
              - knowledge/   # Knowledge base
```

## Directory Structure

```
aios/
├── docs/plans/           # Design and implementation documents
├── memory/               # Memory system (JSON-based)
│   ├── skills/           # Operational skills (publish笔记, 互动操作, 数据分析)
│   ├── specs/            # Safety specifications (行为规范, 风险检测)
│   ├── history/         # Operation history records
│   └── knowledge/       # Knowledge base (敏感词库, 热门话题)
├── tasks/                # Task tracking (pending/done/failed)
└── config/              # Settings (settings.json)
```

## Key Files

- `config/settings.json` - Assistant configuration (limits, behavior, Chrome options)
- `memory/skills/*.json` - Skill definitions for operations
- `memory/specs/*.json` - Safety and risk detection rules
- `docs/plans/*.md` - Design and implementation documentation

## Commands & Operations

This is not a traditional code project with build/test commands. Instead:

1. **Task Execution**: User gives natural language tasks (e.g., "帮我发布一篇笔记", "关注10个博主")
2. **Skill Retrieval**: Claude Code looks up relevant skills in `memory/skills/`
3. **Browser Control**: Uses the repo-local browser-use MCP tools (`chrome.launch_cdp`, `browser.connect_cdp`, `page.*`) to execute operations
4. **Learning**: Results are recorded to `memory/history/` for future improvement

## Images Directory

```
aios/
├── images/              # Generated cover images and illustrations
│   └── (per post)       # Each post should have unique images
...
```

## Image Generation Guidelines

**IMPORTANT**: Each post MUST have unique, matching cover images!

### 配图方式选择

根据内容类型选择合适的配图方式：

| 内容类型 | 推荐方式 | 说明 |
|---------|---------|------|
| 恋爱日常/宿舍故事/情绪变化 | **剧本式多图生成** | 生成4-9张独立画面，像漫画/条漫连贯故事 |
| 干货教程/知识分享 | 单张配图 | 1张封面 + 配图，信息密集 |

### 剧本式多图生成（新）

- 使用 `memory/skills/剧本式多图生成.json`
- 先写分镜剧本，再逐张生成图片
- 每张图是独立完整画面，不是拼接
- 最多支持18张，按剧情顺序上传

### 传统配图生成

- Use `memory/skills/生成小红书配图.json` for image prompts
- Follow the style system: 9 styles × 6 layouts
- Generate 1 cover + 1-2 illustrations per post
- Save images to `aios/images/` folder
- Match image style to content theme:
  - 情感恋爱 → 粉色浪漫系
  - 情绪管理 → 暖黄治愈系
  - 人际关系 → 活泼明亮系
  - 大学成长 → 清新自然系

## Reference Skills

- Auto-Redbook-Skills: https://github.com/comeonzhj/Auto-Redbook-Skills
- baoyu-skills: https://github.com/jimliu/baoyu-skills

## Safety Limits (from specs)

- Daily posts: max 3
- Daily interactions: max 50
- Operation interval: random 5-30 seconds
- Auto-pause on error detection

## Anti-Detection

- Always use anti-detection scripts before any browser operation
- Enable random delays between actions (5-30 seconds)
- Use human behavior simulation skills
- Key files:
  - `config/settings.json` - anti_detection config
  - `memory/skills/反检测脚本.json` - stealth scripts
  - `memory/skills/人类行为模拟.json` - human behavior
  - `config/stealth-chrome-args.json` - Chrome args

## Browser MCP (browser-use CDP)

The project now defaults to **browser-use MCP over CDP**:

### MCP Server

- **Launcher**: `scripts/run-browser-use-mcp.sh`
- **Migration command**: `node scripts/aios.mjs internal browser mcp-migrate`
- **Doctor**: `node scripts/aios.mjs internal browser doctor --fix --dry-run`

### Available Tools

| Tool | Description |
|------|-------------|
| `chrome.launch_cdp` | Launch local Chrome/Chromium with CDP and profile dir |
| `browser.connect_cdp` | Connect to CDP browser and create session |
| `page.goto` | Navigate to URL |
| `page.click` / `page.type` / `page.press` | Interaction primitives |
| `page.extract_text` / `page.get_html` | Text/HTML extraction |
| `page.screenshot` | Take screenshot |
| `browser.close` | Close browser session |
| `diagnostics.sannysoft` | Fingerprint diagnostics snapshot |

### Profile Support

Multi-profile support for isolated browser instances:
- Each profile has independent user data directory
- Config: `config/browser-profiles.json`
- Recommended convention: `default` = CDP fingerprint browser
- Login pages (Google/Meta/Jimeng auth walls) require human completion; automation should resume after login

### Tech Stack

- browser-use + MCP (Python runtime)
- CDP real Chrome profile reuse
- TypeScript
- MCP SDK

## Important Notes

- All normal browser automation should use the repo-local `puppeteer-stealth` MCP alias and browser-use tools (`chrome.launch_cdp` + `browser.connect_cdp` + `page.*`)
- If multiple browser MCPs are installed, reserve `chrome-devtools` for low-level debugging only
- For interactive work, prefer `chrome.launch_cdp {"port":9222}` then `browser.connect_cdp`
- The system maintains a file-based memory system in JSON format
- Before executing any plan, use `superpowers:brainstorming` skill
- When implementing features, use `superpowers:test-driven-development`
- Before claiming completion, use `superpowers:verification-before-completion`

## Default Task Route (Superpowers + Harness)

For substantial tasks, route execution in this order:

1. Process selection
   - `superpowers:brainstorming` for design/new behavior
   - `superpowers:writing-plans` for multi-step implementation
   - `superpowers:systematic-debugging` for failures
2. Write a plan artifact in `docs/plans/YYYY-MM-DD-<topic>.md`.
3. Use `aios-long-running-harness` controls (preflight budgets, evidence checkpoints, retry classes).
4. Persist session state with ContextDB (`init -> session -> event -> checkpoint -> context:pack`).
5. Dispatch strategy
   - Independent domains: use `superpowers:dispatching-parallel-agents`.
   - Coupled/shared-state changes: stay sequential.
   - If no true subagent tool is available, emulate parallelism with explicit domain queues and only safe parallel reads/checks.
6. Close only after `superpowers:verification-before-completion` and concrete artifact evidence.

<!-- AIOS NATIVE BEGIN -->
AIOS native enhancements are active in this repository.

Use repo-local skills, agents, and bootstrap docs before falling back to ad-hoc behavior.

ContextDB remains the shared runtime layer for memory, checkpoints, and execution evidence.

Browser MCP is available through the repo-local AIOS server and should be preferred for browser work.

## AIOS Native Claude Layer

- Prefer repo-local `.claude/skills` and `.claude/agents`.
- Keep work grounded in the AIOS runtime and verification flow.
<!-- AIOS NATIVE END -->
