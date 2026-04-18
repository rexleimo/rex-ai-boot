# Ambiguous UI Prompt Optimization

Date: 2026-04-18

## Goal

Improve output quality when end users only provide vague UI prompts (for example "change this element" or "follow some style"), while still delivering production-ready UI/UX and connected SaaS flows.

## Changes

1. Enhanced `skill-sources/frontend-design/SKILL.md`:
- Added `Fuzzy Prompt Autopilot` with three intent classes: `Patch`, `Restyle`, `Flow`.
- Added assumption block requirements to avoid blocked workflows.
- Added per-mode delivery contracts.
- Added full SaaS flow minimum coverage and state coverage requirements.

2. Enhanced `skill-sources/awesome-design-md/SKILL.md`:
- Added fuzzy style-intent-to-slug mapping.
- Added deterministic overwrite command guidance (`--force`).
- Added `linear` default fallback for generic SaaS intent.

3. Updated official docs/copy:
- `docs/zh-CN/design-skills-official-copy.md`
- `docs/design-skills-official-copy.md`
- `README-zh.md`
- `README.md`

Added operator-facing templates for fuzzy prompts and a recommended system prompt for product embedding.

## Expected Result

- Fewer low-signal back-and-forth turns from vague user requests.
- Better visual consistency and less template-like output.
- Stronger end-to-end UX coverage for SaaS scenarios, not isolated page fragments.
