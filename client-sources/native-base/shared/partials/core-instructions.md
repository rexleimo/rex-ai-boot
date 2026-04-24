AIOS native enhancements are active in this repository.

Use repo-local skills, agents, and bootstrap docs before falling back to ad-hoc behavior.

## Privacy & Relay Safety

- Before sending context to any model or relay service, assume prompts, code snippets, diffs, logs, screenshots, MCP output, and browser-extracted text may leave this machine.
- Never paste or expose API keys, tokens, cookies, sessions, private keys, `.env` files, credential configs, customer data, browser profiles, or unredacted authorization logs.
- For sensitive files, use `aios privacy read --file <path>` and share only the redacted output.
- If a custom model endpoint or relay is detected, warn the user before continuing and avoid sending secrets or proprietary data.
- LLM privacy instructions are advisory; do not claim strict privacy compliance unless deterministic AIOS gates verified the relevant checks.
