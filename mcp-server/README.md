# Playwright Browser MCP Server

`mcp-server` currently exposes a Playwright-based `browser_*` toolset (not `stealth_*`).

## Quick Start

macOS / Linux:

```bash
scripts/install-browser-mcp.sh
scripts/doctor-browser-mcp.sh
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File .\\scripts\\install-browser-mcp.ps1
powershell -ExecutionPolicy Bypass -File .\\scripts\\doctor-browser-mcp.ps1
```

Configure your client MCP config (use the absolute path printed by installer):

```json
{
  "mcpServers": {
    "playwright-browser-mcp": {
      "command": "node",
      "args": ["/ABS/PATH/rex-cli/mcp-server/dist/index.js"]
    }
  }
}
```

## Streamable HTTP (Bearer Token)

Optional: expose the MCP server over Streamable HTTP at `/mcp` with `Authorization: Bearer <token>`.

Environment:
- `MCP_HTTP=1` enable HTTP server
- `MCP_HTTP_HOST` (default: `127.0.0.1`)
- `MCP_HTTP_PORT` (default: `43110`)
- `MCP_HTTP_TOKEN` (required)
- `MCP_HTTP_SESSION_TTL_MS` (default: `1800000`)

Start (dev):

```bash
cd mcp-server
export MCP_HTTP=1
export MCP_HTTP_TOKEN="$(openssl rand -hex 16)"
npm run dev
```

Smoke test initialize:

```bash
curl -sS -X POST "http://127.0.0.1:43110/mcp" \
  -H "Authorization: Bearer $MCP_HTTP_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"curl","version":"0.0.0"}}}'
```

Then restart your client and smoke test:

1. `browser_launch` `{"profile":"default","visible":true}`
2. `browser_navigate` `{"url":"https://example.com"}`
3. `browser_snapshot` `{"profile":"default"}`
4. Read `pageSummary`, `regions`, `elements`, `textBlocks`, and `visualHints` first
5. Only if `visualHints.needsVisualFallback=true`, call `browser_screenshot` with `selector`
6. `browser_close` `{}`

## Installer and Doctor Scripts

- `scripts/install-browser-mcp.sh`
  - installs npm deps
  - installs Playwright Chromium runtime
  - builds `mcp-server`
  - prints ready-to-copy MCP config snippet
- `scripts/install-browser-mcp.ps1` (Windows PowerShell variant)
- `scripts/doctor-browser-mcp.sh`
  - checks Node/npm/npx
  - checks `node_modules`, `dist/index.js`, Playwright runtime
  - validates `config/browser-profiles.json`
  - warns if default profile depends on CDP but port is not reachable
- `scripts/doctor-browser-mcp.ps1` (Windows PowerShell variant)

## Available Tools

- `browser_launch` `{ profile?, url?, visible?, headless? }`
- `browser_navigate` `{ url, profile?, newTab? }`
- `browser_click` `{ selector, profile?, double? }`
- `browser_type` `{ selector, text, profile? }`
- `browser_set_input_files` `{ selector, files, profile? }`
- `browser_snapshot` `{ profile?, includeHtml?, htmlMaxChars? }`
- `browser_auth_check` `{ profile? }`
- `browser_challenge_check` `{ profile? }`
- `browser_screenshot` `{ fullPage?, profile?, filePath?, selector? }`
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
      "userDataDir": ".browser-profiles/local",
      "isolateOnLock": true
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
2. Use `browser_launch` with `{ "profile": "default", "visible": true }` (the server will auto-fallback to `local` if CDP is unavailable).
3. For explicit local Playwright launch, use `{ "profile": "local" }`.
4. Optionally set `BROWSER_HEADLESS=true` for non-GUI environments.

## Notes

- The server auto-detects workspace root by locating `config/browser-profiles.json`.
- For local persistent profiles, if `userDataDir` is locked by another browser process, server retries with an isolated runtime profile directory by default (`isolateOnLock=true`).
- `browser_snapshot` now returns a layout-first payload: `pageSummary`, `regions`, `elements`, `textBlocks`, and `visualHints`.
- Recommended reasoning order: `challenge/auth` -> `pageSummary` -> `regions` -> `elements` -> `textBlocks` -> optional `htmlPreview`.
- For interactive agent work, prefer `browser_launch` with `visible:true`; use `headless:true` only for non-GUI environments or background smoke tests.
- `browser_screenshot` returns base64 and can also save to disk via `filePath`; prefer `selector` for local visual fallback instead of full-page screenshots.
- `browser_navigate` / `browser_snapshot` / `browser_auth_check` include `requiresHumanAction`, `auth`, and `challenge` fields.
- Use `browser_challenge_check` for explicit anti-bot gate checks (Cloudflare / Google risk / captcha).
- If `requiresHumanAction=true`, complete login/challenge manually and then continue automation.
- Recommended policy: keep third-party account sign-in (Google/Meta/Jimeng auth walls) as human-in-the-loop.

## Action Pacing (Reliability)

Use optional pacing to reduce flaky fast-action races:

- `BROWSER_ACTION_PACING=true|false` (default: `true`)
- `BROWSER_ACTION_MIN_MS` (default: `400`)
- `BROWSER_ACTION_MAX_MS` (default: `1200`)
- `BROWSER_ISOLATE_ON_LOCK=true|false` (default: `true`, retries with isolated profile dir when the base `userDataDir` is in use)

## Filesystem Context DB (for Codex/Claude/Gemini)

This repo now includes a lightweight filesystem context DB under `memory/context-db` to share memory across CLI tools, with a SQLite sidecar index at `memory/context-db/index/context.db`.

### Commands

```bash
cd mcp-server
npm run contextdb -- init
npm run contextdb -- session:new --agent claude-code --project rex-cli --goal "stabilize browser automation"
npm run contextdb -- event:add --session <session_id> --role user --text "Need retry and checkpoint strategy"
npm run contextdb -- checkpoint --session <session_id> --summary "Auth wall found; waiting human login" --status blocked --next "wait-login|resume-run"
npm run contextdb -- context:pack --session <session_id> --out memory/context-db/exports/<session_id>-context.md
npm run contextdb -- search --query "auth race" --project rex-cli
npm run contextdb -- timeline --session <session_id> --limit 30
npm run contextdb -- event:get --id <session_id>#<seq>
npm run contextdb -- index:sync --force --stats --jsonl-out memory/context-db/exports/index-sync-stats.jsonl
npm run contextdb -- index:rebuild
```

`index:sync` is an incremental sidecar refresh command (fast path).  
Use `--stats` for detailed counters (`scanned/upserted` sessions/events/checkpoints), and `--jsonl-out` to append each run to a JSONL history file for trend analysis.

Optional semantic rerank:

```bash
export CONTEXTDB_SEMANTIC=1
export CONTEXTDB_SEMANTIC_PROVIDER=token
npm run contextdb -- search --query "issue auth" --project rex-cli --semantic
```

Unknown or unavailable providers fall back to lexical query automatically.

### Refs Query Benchmark

Run local refs query performance benchmark:

```bash
cd mcp-server
npm run bench:contextdb:refs -- --events 2000 --refs-pool 200 --queries 300 --warmup 30 --json-out test-results/contextdb-refs-bench.local.json
```

The benchmark emits JSON metrics for two scenarios:
- `refs-only`: exact ref filtering latency profile
- `refs+query`: ref filtering combined with lexical query

CI baseline gate commands:

```bash
cd mcp-server
npm run bench:contextdb:refs:ci
npm run bench:contextdb:refs:gate
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
scripts/ctx-agent.sh --agent claude-code --project rex-cli

# Gemini one-shot (auto logs prompt/response into context-db)
scripts/ctx-agent.sh --agent gemini-cli --project rex-cli --prompt "继续上一次任务，先给我下一步计划"

# Codex one-shot (auto logs prompt/response/checkpoint into context-db)
scripts/ctx-agent.sh --agent codex-cli --project rex-cli --prompt "根据现有上下文继续实现"
```

For full automation, use one-shot mode (`--prompt`) so the script performs all five steps automatically:
`init -> session:new/latest -> event:add -> checkpoint -> context:pack`.
