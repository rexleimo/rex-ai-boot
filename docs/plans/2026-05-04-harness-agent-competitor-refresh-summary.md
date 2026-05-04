# Harness/Agent Competitor Refresh Summary

Date: 2026-05-04

## Goal

Persist the latest harness/agent competitor refresh after the 2026-05-04 AIOS watchlist update, so future AIOS planning can reference fresh upstream metadata without re-running the same triage.

## Scope

- Source of truth: `memory/knowledge/competitor-watchlist.json`
- Existing long-form references:
  - `memory/knowledge/competitor-analysis.md`
  - `docs/plans/2026-04-25-competitor-feature-roadmap.md`
- Focus set for this refresh:
  - `HKUDS/OpenHarness`
  - `lazynet/lazy-harness`
  - `mmTheBest/long-running-tasks`
  - `kunchenguid/gnhf`
  - `code-yeongyu/oh-my-openagent`
  - `revfactory/harness`
  - `UpGPT-ai/vision-test-harness`

## Refresh Method And Limits

- On 2026-05-04, AIOS refreshed GitHub API metadata for the focus set and persisted the new fields into `memory/knowledge/competitor-watchlist.json`.
- Refreshed fields included latest commit SHA, last pushed time, GitHub updated time, stars, and forks.
- Full tarball snapshot refreshes under `temp/competitor-repos/` stalled during this run, so this note should be read as a metadata refresh, not a full source re-audit.
- Practical implication: the watchlist now reflects the latest known upstream state for the focus set, but some local snapshot directories may still point at older checked-out content.

## Latest Known Upstream State

| Priority | Repo | Latest known commit | Last pushed at (UTC) | Notes |
|---|---|---|---|---|
| P0 | `HKUDS/OpenHarness` | `7873f0d10917` | `2026-05-03T09:03:42Z` | Still the clearest reference for readiness verdicts, hooks/permissions, background task lifecycle, and operator-facing dry-run status. |
| P0 | `lazynet/lazy-harness` | `04bb2119d16e` | `2026-05-03T15:42:34Z` | Strongest fit for profile isolation, selftest/doctor, compaction continuity, scheduler, and migration safety. |
| P0 | `mmTheBest/long-running-tasks` | `afa2bce00554` | `2026-03-06T02:42:57Z` | Older but still directly relevant for cold-start workers, `.pause`, multi-signal stall detection, and unattended queue patterns. |
| P0 | `kunchenguid/gnhf` | `011f3d38ed8e` | `2026-05-03T05:38:10Z` | Fast-moving overnight harness reference; strongest on iteration commits, rollback semantics, resume notes, and worktree-preserving isolation. |
| P0 | `code-yeongyu/oh-my-openagent` | `9ba3b574a7d1` | `2026-05-03T09:43:40Z` | Highest-signal execution-quality reference: model routing, edit validation, LSP/AST tools, and long-running continuation discipline. |
| P1 | `revfactory/harness` | `6400bf6d3ee7` | `2026-04-18T10:38:53Z` | Strategic template reference for generating team architecture, skills, and orchestrator patterns from a domain brief. |
| P1 | `UpGPT-ai/vision-test-harness` | `7297e044a55f` | `2026-04-20T16:53:31Z` | Still the most direct reference for Browser MCP evidence flows: YAML tests, screenshots, diffs, overlays, and HTML reports. |

## Stable Conclusions

The May 4 refresh does not change the core product judgment from the April 25 roadmap. The strongest external signal is still concentrated in four AIOS gaps:

1. Long-running harness reliability and recovery.
2. Plan/ownership discipline and edit safety.
3. Browser evidence and regression verification.
4. Operator visibility into readiness, blockers, and next actions.

The important update is confidence, not direction: the most active projects in the focus set are still investing in harness contracts rather than in simply adding more agents.

## Updated AIOS Implications

### P0: Keep reliability ahead of expansion

- Treat `OpenHarness`, `lazy-harness`, `long-running-tasks`, and `gnhf` as one combined signal for AIOS harness work.
- Keep prioritizing:
  - readiness verdicts for `aios orchestrate`, `aios team`, and browser flows,
  - watchdog decisions with `observe/retry/respawn/rollback/human_gate`,
  - compact continuity and resume reinjection,
  - overnight worktree-preserving execution.

### P0: Raise execution discipline before adding more generated roles

- `oh-my-openagent` remains the best proof that model routing, stable edit validation, and stronger execution tools matter more than raw agent count.
- AIOS should keep plan/checkpoint/ownership gates ahead of any large expansion of generated agents, roles, or workflow breadth.

### P0: Browser verification still needs productization

- `vision-test-harness` continues to support the existing AIOS direction: Browser MCP should produce repeatable smoke evidence, privacy-aware screenshots, and diffable reports rather than isolated screenshots and manual judgment.

### P1/P2: Team factory work can wait

- `revfactory/harness` is still strategically valuable, but AIOS should not prioritize domain-team factory generation until the reliability and evidence foundations above are solid.

## Recommended Next AIOS Slice

If AIOS wants one next implementation slice that best matches the refreshed signal, choose:

1. `team status --watch` -> real watchdog + recovery decision object
2. readiness verdicts for `team` / `orchestrate` / browser flows
3. plan + ownership blockers with executable next actions

That sequence captures the strongest overlap between `OpenHarness`, `lazy-harness`, `long-running-tasks`, `gnhf`, and `oh-my-openagent`.

## Evidence

- Watchlist metadata refresh: `memory/knowledge/competitor-watchlist.json`
- Long-form analysis baseline: `memory/knowledge/competitor-analysis.md`
- Existing roadmap baseline: `docs/plans/2026-04-25-competitor-feature-roadmap.md`
