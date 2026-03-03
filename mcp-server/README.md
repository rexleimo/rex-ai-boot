# Playwright Browser MCP Server

`mcp-server` currently exposes a Playwright-based `browser_*` toolset (not `stealth_*`).

## Quick Start

```bash
scripts/install-browser-mcp.sh
scripts/doctor-browser-mcp.sh
```

Configure your client MCP config (use the absolute path printed by installer):

```json
{
  "mcpServers": {
    "playwright-browser-mcp": {
      "command": "node",
      "args": ["/ABS/PATH/rex-ai-boot/mcp-server/dist/index.js"]
    }
  }
}
```

Then restart your client and smoke test:

1. `browser_launch` `{"profile":"default"}`
2. `browser_navigate` `{"url":"https://example.com"}`
3. `browser_snapshot` `{}`
4. `browser_close` `{}`

## Installer and Doctor Scripts

- `scripts/install-browser-mcp.sh`
  - installs npm deps
  - installs Playwright Chromium runtime
  - builds `mcp-server`
  - prints ready-to-copy MCP config snippet
- `scripts/doctor-browser-mcp.sh`
  - checks Node/npm/npx
  - checks `node_modules`, `dist/index.js`, Playwright runtime
  - validates `config/browser-profiles.json`
  - warns if default profile depends on CDP but port is not reachable

## Available Tools

- `browser_launch` `{ profile?, url?, headless? }`
- `browser_navigate` `{ url, profile?, newTab? }`
- `browser_click` `{ selector, profile?, double? }`
- `browser_type` `{ selector, text, profile? }`
- `browser_snapshot` `{ profile? }`
- `browser_auth_check` `{ profile? }`
- `browser_screenshot` `{ fullPage?, profile?, filePath? }`
- `browser_list_tabs` `{ profile? }`
- `browser_close` `{ profile? }`

## Profile Config

Use `config/browser-profiles.json` (project root):

```json
{
  "profiles": {
    "default": {
      "name": "default",
      "cdpPort": 9222
    },
    "local": {
      "name": "local",
      "userDataDir": ".browser-profiles/local"
    }
  }
}
```

Priority for launch mode:
1. `cdpUrl` / `cdpPort` (connect existing browser/fingerprint browser)
2. local launch with `executablePath` (profile or `BROWSER_EXECUTABLE_PATH`)
3. Playwright default browser executable

## Crash Troubleshooting (Google Chrome for Testing)

If you see `Google Chrome for Testing 意外退出`:

1. Start fingerprint browser with remote debugging on `9222` and keep it running.
2. Use `browser_launch` with `{ "profile": "default" }` (the server will auto-fallback to `local` if CDP is unavailable).
3. For explicit local Playwright launch, use `{ "profile": "local" }`.
4. Optionally set `BROWSER_HEADLESS=true` for non-GUI environments.

## Notes

- The server auto-detects workspace root by locating `config/browser-profiles.json`.
- `browser_screenshot` returns base64 and can also save to disk via `filePath`.
- `browser_navigate` / `browser_snapshot` / `browser_auth_check` include `requiresHumanAction` and `auth` fields.
- If `requiresHumanAction=true`, complete login manually and then continue automation.
- Recommended policy: keep third-party account sign-in (Google/Meta/Jimeng auth walls) as human-in-the-loop.

## Action Pacing (Reliability)

Use optional pacing to reduce flaky fast-action races:

- `BROWSER_ACTION_PACING=true|false` (default: `true`)
- `BROWSER_ACTION_MIN_MS` (default: `400`)
- `BROWSER_ACTION_MAX_MS` (default: `1200`)

## Filesystem Context DB (for Codex/Claude/Gemini)

This repo now includes a lightweight filesystem context DB under `memory/context-db` to share memory across CLI tools.

### Commands

```bash
cd mcp-server
npm run contextdb -- init
npm run contextdb -- session:new --agent claude-code --project rex-ai-boot --goal "stabilize browser automation"
npm run contextdb -- event:add --session <session_id> --role user --text "Need retry and checkpoint strategy"
npm run contextdb -- checkpoint --session <session_id> --summary "Auth wall found; waiting human login" --status blocked --next "wait-login|resume-run"
npm run contextdb -- context:pack --session <session_id> --out memory/context-db/exports/<session_id>-context.md
```

### Feed context to each CLI

- Claude Code:
  ```bash
  claude --append-system-prompt "$(cat memory/context-db/exports/<session_id>-context.md)"
  ```
- Gemini CLI:
  ```bash
  gemini -i "$(cat memory/context-db/exports/<session_id>-context.md)"
  ```
- Codex CLI (example pattern):
  use the generated context packet as the first prompt in the session.

### One-command launcher (shared context session)

From repository root:

```bash
# Claude interactive (loads latest session context)
scripts/ctx-agent.sh --agent claude-code --project rex-ai-boot

# Gemini one-shot (auto logs prompt/response into context-db)
scripts/ctx-agent.sh --agent gemini-cli --project rex-ai-boot --prompt "继续上一次任务，先给我下一步计划"

# Codex one-shot (auto logs prompt/response/checkpoint into context-db)
scripts/ctx-agent.sh --agent codex-cli --project rex-ai-boot --prompt "根据现有上下文继续实现"
```

For full automation, use one-shot mode (`--prompt`) so the script performs all five steps automatically:
`init -> session:new/latest -> event:add -> checkpoint -> context:pack`.
