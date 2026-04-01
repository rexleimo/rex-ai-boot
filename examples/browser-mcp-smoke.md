# Browser MCP Smoke (Minimal)

Use this after MCP setup to confirm browser automation works end-to-end.

Recommended flow in client chat:

1. `browser_launch {"profile":"default","visible":true}`
2. `browser_navigate {"url":"https://example.com"}`
3. `browser_snapshot {}`
4. `browser_auth_check {}`
5. `browser_close {}`

If launch fails:

- Run `node scripts/aios.mjs doctor --profile strict`
- Reinstall browser component: `node scripts/aios.mjs setup --components browser`
