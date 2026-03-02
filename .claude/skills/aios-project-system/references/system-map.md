# AIOS System Map

## Purpose
AIOS is a browser-automation assistant for Xiaohongshu operations plus related content tooling (including Jimeng image generation).

## End-to-End Flow
User intent -> skill retrieval (`memory/skills`) -> MCP browser actions -> platform result -> evidence capture -> memory/docs updates.

## Main State Surfaces
- Process memory: `memory/skills`, `memory/specs`, `memory/history`, `memory/knowledge`
- Task lifecycle: `tasks/pending`, `tasks/done`, `tasks/failed`
- Artifact output: `images/`, `temp/`
- Automation engine: `mcp-server/` (Playwright-based browser tools)

## Automation Contract
- Launch browser/profile.
- Navigate to target URL.
- Select/act using robust selectors.
- Capture snapshot evidence.
- Detect errors and branch (retry/manual handoff).
- Record final status and artifact path.

## High-Risk Drift Zones
- Dynamic CSS class names on target websites.
- Tool naming mismatch (`puppeteer-stealth` server name vs Playwright internals).
- Skill JSON assumptions that are no longer valid for latest UI.
