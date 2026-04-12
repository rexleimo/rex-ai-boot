# Hermes-Inspired Capability Mapping (AIOS)

Date: 2026-04-12

This page tracks which Hermes-inspired capabilities are implemented in AIOS, what remains, and what is intentionally out of scope.

`Hermes-inspired, not affiliated with Nous Research.`

## Capability Matrix

| Hermes Capability | Hermes Reference | AIOS Mapping | Status |
| --- | --- | --- | --- |
| Session recall with explainability | `tools/session_search_tool.py` | `contextdb recall:sessions` + explainable scoring output | Done |
| Memory injection safety scan | `tools/memory_tool.py` | Workspace memo safety checks before prompt injection | Done |
| Subagent progress visibility | `tools/delegate_tool.py` | `team status --watch` / `hud --watch` job+tool progress + stalled signal | Done |
| Executor capability declaration | `tools/registry.py`, `toolsets.py` | Dispatch-time `executorCapabilityManifest` in report/artifacts | Done |
| Pre-mutation rollback checkpoint | `tools/checkpoint_manager.py` | Live subagent opt-in pre-mutation snapshot (`AIOS_SUBAGENT_PRE_MUTATION_SNAPSHOT=1`) | Done |
| Multi-platform gateway + cron | `gateway/platforms/*` | Plugin-style integration only (not core) | Deferred by design |

## Current AIOS Controls

- Live execution still requires explicit opt-in (`AIOS_EXECUTE_LIVE=1` + `AIOS_SUBAGENT_CLIENT`).
- Capability-unknown guard blocks risky live runs unless explicitly overridden.
- Pre-mutation snapshots are opt-in and currently scoped to editable phase owned paths in live subagent runtime.

## Next Optional Improvements

1. Add a dedicated rollback command for pre-mutation snapshots (manifest-driven restore).
2. Add CI assertions for snapshot manifest shape in live-runtime regression tests.
3. Add docs/examples showing incident recovery workflow from snapshot artifacts.
