# Privacy Safety Gate For Wrapped Coding Agents

Date: 2026-04-24

## Objective

Make AIOS privacy posture visible when users start wrapped coding-agent CLIs (`codex`, `claude`, `gemini`, `opencode`) and make the limitation clear: model instructions help, but deterministic AIOS checks must enforce sensitive-data handling before context leaves the machine.

## Scope

- Add a compact, TUI-like privacy banner in `scripts/contextdb-shell-bridge.mjs` for interactive wrapped sessions.
- Detect local Privacy Guard status from the standard privacy config path without printing secret values.
- Detect likely custom relay/model endpoints from environment variables and display a redacted host-level warning.
- Inject privacy operating rules into the ContextDB interactive auto prompt so the launched agent is reminded to use Privacy Guard and avoid claiming strict compliance without evidence.
- Update user-facing documentation for the new privacy banner and the enforcement boundary.
- Add targeted tests before implementation.

## Non-goals

- Do not call remote model providers or relay services during verification.
- Do not inspect raw credentials, cookies, browser profiles, or user secrets.
- Do not implement full prompt-content blocking in this pass; keep this focused on startup visibility and agent instruction hardening.
- Do not add a heavyweight TUI dependency; print a lightweight ANSI/ASCII panel from the existing bridge.

## Privacy Boundary

LLMs cannot be proven to strictly follow privacy instructions during generation. AIOS should phrase this honestly:

- Instruction compliance is advisory and model-dependent.
- Deterministic enforcement must happen in wrappers, Privacy Guard, ContextDB packing, MCP tools, and log/checkpoint writers.
- The banner should say what is enforced now and what remains user/agent discipline.

## Implementation Steps

1. Add bridge tests in `scripts/tests/contextdb-shell-bridge-codex-home.test.mjs`:
   - interactive wrapped runs print a privacy banner to stderr;
   - banner reports custom relay host without credentials/path;
   - `CTXDB_PRIVACY_BANNER=0` disables the banner;
   - auto prompt includes privacy rules and the model-compliance limitation.
2. Implement in `scripts/contextdb-shell-bridge.mjs`:
   - parse privacy config path from `REXCIL_PRIVACY_CONFIG` or `REXCIL_HOME`;
   - summarize Privacy Guard as enabled/disabled, mode, and strict enforcement;
   - scan selected endpoint env vars for non-local, non-official custom endpoints;
   - render an ASCII panel with ANSI colors only when appropriate;
   - print only for interactive launches unless explicitly overridden.
3. Update docs:
   - `README-zh.md` privacy section;
   - `docs-site/zh/getting-started.md` privacy section;
   - shared native instructions if applicable.
4. Verify:
   - targeted bridge tests;
   - `npm run test:scripts`;
   - `node scripts/privacy-guard.mjs status` or equivalent non-sensitive config check.

## Stop Conditions

- Stop if tests require reading raw sensitive user config.
- Stop if implementing the banner would change stdout for wrapped commands that may be parsed by scripts.
- Stop if the change requires a new runtime dependency.

## Evidence Required

- Failing tests observed before implementation.
- Passing targeted tests after implementation.
- Repo-level script tests pass or any failures are documented with exact cause.
