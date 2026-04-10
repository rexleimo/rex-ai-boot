# Repository Guidelines

## Project Structure & Module Organization
This repository is a local-first AI agent workspace centered on browser automation via MCP.

- `mcp-server/`: TypeScript Playwright MCP server (legacy/compat runtime code).
- `scripts/run-browser-use-mcp.sh`: default MCP launcher that bridges to `/Users/molei/codes/ai-browser-book/mcp-browser-use`.
- `scripts/browser-use-bootstrap.py`: browser-use bootstrap with optional module shims.
- `mcp-server/src/index.ts`: MCP server entry point and tool routing.
- `mcp-server/src/browser/`: browser launcher, profile manager, auth checks, and tool actions.
- `config/`: runtime configuration such as `browser-profiles.json` and safety-related settings.
- `memory/`: JSON knowledge/skills/specs used by agent workflows.
- `docs/plans/`: implementation and design plans.
- `tasks/`: task templates and execution tracking artifacts.

Do not manually edit `mcp-server/dist/`; it is generated output.

## Build, Test, and Development Commands
Run commands from `mcp-server/` unless noted:

- `npm install`: install dependencies.
- `npm run dev`: run MCP server from TypeScript with `tsx`.
- `npm run typecheck`: strict TS type validation (`tsc --noEmit`).
- `npm run build`: compile to `dist/`.
- `npm run start`: run built server (`node dist/index.js`).

Typical local flow:
```bash
cd mcp-server
npm install
npm run typecheck && npm run build
```

## Coding Style & Naming Conventions
- Language: TypeScript (ESM, strict mode).
- Indentation: 2 spaces; keep semicolons.
- File names: kebab-case for action modules (for example `auth-check.ts`), `index.ts` for module entry points.
- For `mcp-server` internals, tool names follow `browser_*`. For default runtime (browser-use), use `chrome.launch_cdp` / `browser.connect_cdp` / `page.*`.
- Keep configuration JSON keys stable; prefer additive changes over renaming.
- Repo-local discoverable skills must live under `.codex/skills/` or `.claude/skills/` (optionally `.agents/skills/` only when the target client actually supports it). Do not invent parallel skill roots such as `.baoyu-skills/*/SKILL.md`; those are non-discoverable and should be plain docs or extension config only.

## Testing Guidelines
Automated suites are available for both root AIOS workflows and `mcp-server`.
Minimum verification for behavior changes:

1. `npm run test:scripts` (repo root)
2. `cd mcp-server && npm run typecheck && npm run test && npm run build`
3. Manual MCP smoke test (`chrome.launch_cdp` -> `browser.connect_cdp` -> `page.goto` -> `page.screenshot` -> `browser.close`) when browser-flow behavior changes

Document manual test steps in PRs when behavior changes.

## Commit & Pull Request Guidelines
Git history follows Conventional Commit style:
- `feat: ...`, `fix: ...`, `docs: ...`, `chore: ...`
- Optional scope is common (for example `feat(skills): ...`).

PRs should include:
- concise problem/solution summary,
- affected paths,
- verification evidence (command output or checklist),
- screenshots/log snippets for browser-flow changes,
- linked task/issue when applicable.

## Security & Configuration Tips
- Never commit credentials, cookies, or personal browser profile data.
- Prefer CDP-based profile config in `config/browser-profiles.json` for stable login reuse.
- Preserve human-in-the-loop checks for auth walls and sensitive outbound actions.

## Browser MCP Selection
- In this repo, prefer the `puppeteer-stealth` MCP server alias that now routes to browser-use MCP (`scripts/run-browser-use-mcp.sh`).
- For interactive browser work, use `chrome.launch_cdp {"port":9222,"user_data_dir":"~/.chrome-cdp-profile"}` then `browser.connect_cdp`.
- If multiple browser MCPs are available, do **not** use `chrome-devtools` for normal business flows; reserve it for low-level inspection/debugging only.
- Default reasoning order for page understanding: `page.extract_text` / `page.get_html` first, `page.screenshot` as visual fallback.

## Default Superpowers Route
For substantial user requests, use this route by default:

1. Select process skill before coding:
   - Design/new behavior: `superpowers:brainstorming`
   - Multi-step delivery: `superpowers:writing-plans`
   - Debug/failure analysis: `superpowers:systematic-debugging`
2. Create a plan artifact in `docs/plans/YYYY-MM-DD-<topic>.md`.
3. Apply long-running controls with `aios-long-running-harness`:
   - Lock objective, budgets, stop conditions, and required evidence.
   - Persist progress through ContextDB lifecycle (`init -> session -> event -> checkpoint -> context:pack`).
4. Choose execution mode:
   - 2+ independent problem domains: use `superpowers:dispatching-parallel-agents`.
   - Shared-state or coupled changes: execute sequentially.
   - If real subagents are unavailable in the current runtime, emulate dispatch by splitting domain tasks explicitly and running only safe independent reads/checks in parallel.
   - For repeated multi-agent deliveries, prefer the reusable blueprints in `memory/specs/orchestrator-blueprints.json` and the shared handoff schema before merging parallel outputs.
5. Finish with `superpowers:verification-before-completion`; do not claim success without checkpoint + artifact evidence.

For long tasks, announce the chosen route in the first progress update.

## Agent Shortcut Conventions
- `cap` is a repository shortcut for `commit + push`.
- Trigger: when the user message is exactly `cap`, execute this flow in the current repo.
- Required flow:
  1. `git status --short` and confirm there are changes.
  2. If behavior/commands/workflow changed, sync impacted skill docs first (keep `.codex/skills/*` and `.claude/skills/*` aligned).
  3. `git add -A`.
  4. Commit with a Conventional Commit message from current task context.
  5. If no clear message is available, use fallback `chore: cap snapshot <YYYY-MM-DD>`.
  6. `git push` (or set upstream once when required).
- If there are no changes, report a no-op instead of creating an empty commit.

<!-- AIOS NATIVE BEGIN -->
AIOS native enhancements are active in this repository.

Use repo-local skills, agents, and bootstrap docs before falling back to ad-hoc behavior.

ContextDB remains the shared runtime layer for memory, checkpoints, and execution evidence.

Browser MCP is available through the repo-local AIOS server and should be preferred for browser work.

## AIOS Native Codex Layer

- Prefer repo-local `.codex/skills` and `.codex/agents`.
- Keep work grounded in the AIOS runtime and verification flow.
<!-- AIOS NATIVE END -->
