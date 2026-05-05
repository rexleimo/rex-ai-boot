# Competitor Watchlist Analysis Plan

**Goal:** Build a repeatable AIOS competitor/reference watchlist that can update local source snapshots, summarize each project's essence, and rank the highest-impact ideas for AIOS.

**Route:** `aios-workflow-router` classified this as analysis/research plus a long-running evidence task.

**Artifacts:**
- Local clones: `temp/competitor-repos/` (ignored by git, safe for large third-party code)
- Manifest: `memory/knowledge/competitor-watchlist.json`
- Analysis report: `memory/knowledge/competitor-analysis.md`
- Update helper: removed (manual watchlist maintenance only)

**Stop conditions:**
- Do not commit third-party repositories into AIOS.
- Record unresolved/unqualified repository names instead of guessing silently.
- Prefer public GitHub source metadata and local README/package files over speculative claims.

**Execution Steps:**
- [ ] Resolve each user-provided project name to a canonical GitHub URL where possible.
- [ ] Clone or pull each resolvable repository into `temp/competitor-repos/`.
- [ ] Extract README, package metadata, docs, and top-level structure for analysis.
- [ ] Write the watchlist memory in JSON so future agents can update the same set first.
- [ ] Write a Chinese table report for future “竞品列表” answers.
- [ ] Run deterministic verification commands for artifact existence and JSON validity.
