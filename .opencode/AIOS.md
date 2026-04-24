<!-- AIOS NATIVE BEGIN -->
AIOS native enhancements are active in this repository.

Use repo-local skills, agents, and bootstrap docs before falling back to ad-hoc behavior.

## Privacy & Relay Safety

- Before sending context to any model or relay service, assume prompts, code snippets, diffs, logs, screenshots, MCP output, and browser-extracted text may leave this machine.
- Never paste or expose API keys, tokens, cookies, sessions, private keys, `.env` files, credential configs, customer data, browser profiles, or unredacted authorization logs.
- For sensitive files, use `aios privacy read --file <path>` and share only the redacted output.
- If a custom model endpoint or relay is detected, warn the user before continuing and avoid sending secrets or proprietary data.
- LLM privacy instructions are advisory; do not claim strict privacy compliance unless deterministic AIOS gates verified the relevant checks.

ContextDB remains the shared runtime layer for memory, checkpoints, and execution evidence.

Browser MCP is available through the repo-local AIOS server and should be preferred for browser work.

For browser tasks, use this operating pattern unless the user explicitly asks otherwise:
- Connect to a visible CDP browser first: `chrome.launch_cdp` then `browser.connect_cdp`.
- On dense or dynamic pages, prefer `page.semantic_snapshot` first for compact headings/actions before choosing the next step.
- Before acting, read the page state with `page.extract_text`; use `page.get_html` only when text is insufficient.
- Work in short read -> act -> verify loops. Do not chain multiple blind browser actions.
- For clear button/link labels, prefer `page.click_text` before constructing low-level locators.
- Prefer visible text or role-based targets. If a locator is not unique, inspect again and narrow the target instead of guessing.
- After navigation or major actions, use `page.wait` when a state transition is expected, then re-read the page.
- Use `page.screenshot` only as a visual fallback when text/HTML evidence is not enough.
- For complex browser tasks, first summarize the current page, then state the next single action, then execute it.
- When `puppeteer-stealth` is available, use its browser-use toolchain (`chrome.*` / `browser.*` / `page.*`) for normal business flows instead of `chrome-devtools`.

# AIOS For OpenCode

This repository provides compatibility-tier native enhancements for OpenCode through repo-local skills and AIOS runtime conventions.
<!-- AIOS NATIVE END -->
