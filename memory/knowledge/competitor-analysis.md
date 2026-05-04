# AIOS Competitor Watchlist Analysis

Updated: 2026-05-04T10:34:50+08:00

## Operating Memory

- When the user says `更新竞品内容`, first run `npm run competitors:update` (or `node scripts/update-competitor-repos.mjs`) to refresh `temp/competitor-repos/`.
- When the user asks `竞品列表有哪些`, answer with a Markdown table using the fields in `memory/knowledge/competitor-watchlist.json`.
- Do not commit third-party source snapshots under `temp/competitor-repos/`; they are git-ignored and should remain local evidence.
- If a short repository name becomes ambiguous, keep the current resolved repo but mention the resolution note from the JSON.
- If unauthenticated GitHub API rate limits occur, retry later or update known public branches through codeload tarballs and record the limitation.

## 2026-05-04 Harness/Agent Refresh Note

- On 2026-05-04, AIOS refreshed GitHub metadata for the harness/agent-heavy references in `memory/knowledge/competitor-watchlist.json`: `HKUDS/OpenHarness`, `lazynet/lazy-harness`, `mmTheBest/long-running-tasks`, `kunchenguid/gnhf`, `code-yeongyu/oh-my-openagent`, `revfactory/harness`, and `UpGPT-ai/vision-test-harness`.
- This refresh updated latest-known commit, push time, star count, and fork count in the watchlist. The strongest movement was still concentrated around harness reliability and execution-quality projects: `code-yeongyu/oh-my-openagent`, `HKUDS/OpenHarness`, `lazynet/lazy-harness`, and `kunchenguid/gnhf`.
- Important caveat: during this run, full tarball snapshot refreshes under `temp/competitor-repos/` stalled on large downloads. The commit values below therefore represent the latest known upstream GitHub metadata for refreshed rows, while some local snapshots may still lag behind those commits.
- Product conclusion does not change: AIOS should keep prioritizing harness reliability, plan/ownership discipline, edit safety, and browser evidence before adding more surface area or more generated agents.

## Quick Ranking

| Priority | Project | Essence | AIOS relevance | Similarity | Impact | Local path | Latest known commit |
|---|---|---|---|---:|---:|---|---|
| P0 | [HKUDS/OpenHarness](https://github.com/HKUDS/OpenHarness) | Python open agent harness/Claude Code-style runtime with tool registry, permissions, hooks, MCP, background tasks, auto-compaction, team coordination, and dry-run preview. | Direct reference for making AIOS a complete harness rather than only wrappers: dry-run, permissions, hooks, task lifecycle, and TUI diagnostics. | 5/5 | 5/5 | `temp/competitor-repos/HKUDS__OpenHarness` | `7873f0d10917` |
| P0 | [lazynet/lazy-harness](https://github.com/lazynet/lazy-harness) | Cross-platform harness wrapper for AI coding agents with profiles, hooks, SQLite monitoring, knowledge directory, scheduler, migration, rollback, and strict TDD workflow. | Directly overlaps with AIOS wrappers, ContextDB, doctor/status, scheduler, and migration safety; high practical improvement value. | 5/5 | 5/5 | `temp/competitor-repos/lazynet__lazy-harness` | `04bb2119d16e` |
| P0 | [mmTheBest/long-running-tasks](https://github.com/mmTheBest/long-running-tasks) | OpenClaw skill for autonomous sequential task queues using TODO.md, cron orchestration, cold-start workers, intermediate commits, and multi-signal stall detection. | Directly improves AIOS long-running harness resilience and stop/retry rules. | 5/5 | 5/5 | `temp/competitor-repos/mmTheBest__long-running-tasks` | `afa2bce00554` |
| P0 | [kunchenguid/gnhf](https://github.com/kunchenguid/gnhf) | Agent-agnostic overnight orchestrator that runs iterative coding-agent loops with per-iteration commits, rollback-on-failure, resume metadata, and optional git worktree isolation. | Direct reference for AIOS long-running harness ergonomics: commit cadence, rollback semantics, resume UX, worktree isolation, and per-agent adapter simplicity. | 4/5 | 5/5 | `temp/competitor-repos/kunchenguid__gnhf` | `011f3d38ed8e` |
| P0 | [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) | Batteries-included OpenCode/OpenAgent harness with model-category routing, discipline agents, parallel background agents, LSP/AST tools, tmux, and hash-anchored edits. | High-value execution ideas for AIOS team runtime: model routing, stronger edit verification, LSP/AST tools, and long-running continuation loops. | 4/5 | 5/5 | `temp/competitor-repos/code-yeongyu__oh-my-openagent` | `9ba3b574a7d1` |
| P0 | [volcengine/OpenViking](https://github.com/volcengine/OpenViking) | Agent-native context database using a filesystem paradigm for memory, resources, and skills with hierarchical retrieval and session self-iteration. | Directly maps to AIOS ContextDB and can improve context hierarchy, retrieval observability, and self-evolving memory. | 4/5 | 5/5 | `temp/competitor-repos/volcengine__OpenViking` | `17d2c5603e13` |
| P1 | [golutra/golutra](https://github.com/golutra/golutra) | Tauri desktop multi-agent workspace/control plane that keeps existing CLIs and adds visual orchestration, parallel execution, workflow templates, and terminal prompt injection. | Very similar product direction at the UX/control-plane layer; AIOS is more local-first CLI/runtime/memory/browser, Golutra is more visual desktop workspace. | 5/5 | 4/5 | `temp/competitor-repos/golutra__golutra` | `446f6aef00be` |
| P1 | [Felix201209/openclaw-recall](https://github.com/Felix201209/openclaw-recall) | OpenClaw memory plugin with persistent memory types, layered compression, hybrid retrieval, RRF/MMR diversification, guardrails, and inspection CLI/dashboard. | Directly useful for ContextDB recall quality, prompt budgets, explainability, and memory hygiene. | 4/5 | 4/5 | `temp/competitor-repos/Felix201209__openclaw-recall` | `273d55c33f5f` |
| P1 | [jesse-black/execplan-skills](https://github.com/jesse-black/execplan-skills) | Persona-split ExecPlan workflow: planner creates/updates living plan, generator implements and maintains it, evaluator independently reviews against the plan. | Excellent lightweight upgrade for AIOS docs/plans and long-running handoff discipline. | 4/5 | 4/5 | `temp/competitor-repos/jesse-black__execplan-skills` | `c84e9445f8aa` |
| P1 | [obra/superpowers](https://github.com/obra/superpowers) | Composable agent skill methodology for brainstorming, planning, TDD, subagent-driven development, review, and verification-before-completion. | Already integrated; continue syncing upstream and adapt updates into AIOS-native skills and docs. | 4/5 | 4/5 | `temp/competitor-repos/obra__superpowers` | `6efe32c9e2dd` |
| P1 | [revfactory/harness](https://github.com/revfactory/harness) | Meta-skill that turns a domain description into a generated agent team, skills, and orchestrator using reusable team architecture patterns. | Strong reference for improving AIOS orchestrator blueprints and automatically generating project-specific agent/team specs. | 4/5 | 4/5 | `temp/competitor-repos/revfactory__harness` | `6400bf6d3ee7` |
| P1 | [UpGPT-ai/vision-test-harness](https://github.com/UpGPT-ai/vision-test-harness) | MCP + CLI visual test harness using YAML flows, Playwright screenshots, screenshot diffing, privacy overlays, and optional AI visual diagnosis. | Very useful for AIOS browser automation verification, especially UI smoke tests and screenshot-based evidence after browser-flow changes. | 3/5 | 4/5 | `temp/competitor-repos/UpGPT-ai__vision-test-harness` | `7297e044a55f` |
| P2 | [openclaw/openclaw](https://github.com/openclaw/openclaw) | Personal always-on AI assistant/gateway with channels, daemon onboarding, plugins, pairing, skills, and cross-platform user surfaces. | Useful as a reference for daemonized gateway, onboarding, plugin boundaries, and multi-channel future; less direct for current coding-agent core. | 3/5 | 3/5 | `temp/competitor-repos/openclaw__openclaw` | `2b5c719a6284` |
| P2 | [ravenpair/ravenpair](https://github.com/ravenpair/ravenpair) | Self-hosted Go server for paired long-running agents with REST/WebSocket APIs, pgvector memory, NATS/Redis, LiteLLM, and plugin-only capabilities. | Useful if AIOS grows into a self-hosted server/control plane; less immediate for current local-first script and CLI runtime. | 3/5 | 3/5 | `temp/competitor-repos/ravenpair__ravenpair` | `1bbbb7dc8926` |

## Highest-Impact References For AIOS

1. **OpenViking + openclaw-recall -> ContextDB 2.0.** Add hierarchical context URIs, L0/L1/L2 token budgets, retrieval trajectory evidence, memory type taxonomy, RRF/MMR retrieval, and memory explain/status commands.
2. **OpenHarness + lazy-harness + long-running-tasks + gnhf -> Harness reliability.** Add dry-run readiness verdicts, hook/event boundaries, scheduler-backed long-run workers, profile isolation, SQLite status views, multi-signal stall detection, commit-per-iteration resume artifacts, and worktree-preserving overnight execution.
3. **oh-my-openagent -> Execution quality.** Add model-category routing, hash-anchored edit validation, LSP/AST tools, tmux-like interactive process control, and skill-scoped MCP startup.
4. **revfactory/harness + execplan-skills -> Planning/team discipline.** Turn AIOS blueprints into team architecture patterns and split work into planner/generator/evaluator artifacts.
5. **vision-test-harness -> Browser/UI verification.** Reuse the YAML-flow + screenshot-diff + privacy-overlay pattern for AIOS Browser MCP smoke tests.

## Golutra Similarity Note

golutra is very similar to AIOS at the product direction layer: both keep existing CLIs and add multi-agent orchestration, long-running workflows, context/prompt reuse, and result tracking. The difference is the center of gravity: golutra is a Tauri desktop control plane with visual terminals and workflow templates, while AIOS is currently a local-first CLI/runtime layer around ContextDB, Browser MCP, skills, and orchestrator/team commands. For AIOS, golutra is most valuable as a UX/control-plane reference rather than a direct runtime replacement.

## Gnhf Similarity Note

gnhf overlaps with AIOS most strongly in the overnight execution loop, not in the full product surface. gnhf is intentionally narrow: start from a clean Git repo, run one agent in a disciplined iteration loop, commit successful steps, reset failures, preserve run memory in `.gnhf/runs/`, and optionally fan out separate worktrees for concurrent agents. AIOS is broader: it adds ContextDB, Browser MCP, Privacy Guard, orchestrate/team preflight gates, and a larger local-first control plane. For AIOS, gnhf is a strong reference for default long-running harness behavior and operator UX rather than for memory or browser architecture.

## Resolution Notes

| Input | Resolved repository | Note |
|---|---|---|
| volcengine/OpenViking | [volcengine/OpenViking](https://github.com/volcengine/OpenViking) | Exact owner/repo from user input. |
| openclaw/openclaw | [openclaw/openclaw](https://github.com/openclaw/openclaw) | Exact owner/repo from user input. |
| code-yeongyu/oh-my-openagent | [code-yeongyu/oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) | Exact owner/repo from user input. |
| HKUDS/OpenHarness | [HKUDS/OpenHarness](https://github.com/HKUDS/OpenHarness) | Exact owner/repo from user input. |
| vision-test-harness | [UpGPT-ai/vision-test-harness](https://github.com/UpGPT-ai/vision-test-harness) | Resolved by GitHub search: exact repository name with AI/browser visual testing description. |
| revfactory/harness | [revfactory/harness](https://github.com/revfactory/harness) | Exact owner/repo from user input. |
| Lazy-Harness | [lazynet/lazy-harness](https://github.com/lazynet/lazy-harness) | Resolved by GitHub search: exact repository name, cross-platform AI coding agent harness description. |
| kunchenguid/gnhf | [kunchenguid/gnhf](https://github.com/kunchenguid/gnhf) | Exact owner/repo from user input. |
| obra/superpowers | [obra/superpowers](https://github.com/obra/superpowers) | Exact owner/repo from user input; AIOS already uses this system. |
| golutra/golutra | [golutra/golutra](https://github.com/golutra/golutra) | Exact owner/repo from user input. |
| ravenpair/ravenpair | [ravenpair/ravenpair](https://github.com/ravenpair/ravenpair) | Exact owner/repo from user input. |
| openclaw-recall | [Felix201209/openclaw-recall](https://github.com/Felix201209/openclaw-recall) | Resolved by GitHub search: exact repository name. Related alternatives include code-yeongyu/openclaw-memory-auto-recall and speedyfoxai/openclaw-true-recall-base. |
| execplan-skills | [jesse-black/execplan-skills](https://github.com/jesse-black/execplan-skills) | Resolved by GitHub search: exact repository name with multi-agent PLANS.md workflow description. |
| long-running-tasks | [mmTheBest/long-running-tasks](https://github.com/mmTheBest/long-running-tasks) | Resolved by relevance search: OpenClaw skill for multi-phase Codex/Claude Code workflows; exact-name search also found unrelated app examples. |

## Suggested AIOS Roadmap From Competitor Review

- **P0 Context retrieval:** implement ContextDB retrieval explainability and hierarchical memory packs before adding more agent/team complexity.
- **P0 Long-run safety:** add multi-signal stall detection, pause/resume controls, commit-per-iteration artifacts, and worktree-preserving overnight runs to long-running harness execution.
- **P0 Dry-run gates:** add readiness verdicts for `aios orchestrate`, `aios team`, and browser MCP flows.
- **P1 Plan lifecycle:** introduce active/completed ExecPlan-style plans and a required evaluator checkpoint for larger changes.
- **P1 Visual evidence:** add YAML browser smoke tests plus privacy-preserving screenshot reports.
- **P2 Product expansion:** watch OpenClaw/RavenPair/Golutra for future channel, server, and desktop-dashboard expansion decisions.
