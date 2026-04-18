# Design Skills No-Handoff Optimization

Date: 2026-04-18

## Goal

Improve AIOS design outcomes when users do not provide a design handoff/mockup (无设计稿), by optimizing the `awesome-design-md` route and adding a local `frontend-design` execution skill.

## Changes

- Enhanced `skill-sources/awesome-design-md/SKILL.md`:
  - Added no-design-draft fast path with recommended slugs by product intent.
  - Strengthened DESIGN.md consistency prompt.
- Added new canonical skill:
  - `skill-sources/frontend-design/SKILL.md`
  - `skill-sources/frontend-design/UPSTREAM.md`
- Registered `frontend-design` into:
  - `config/skills-catalog.json`
  - `config/skills-sync-manifest.json`
- Updated docs examples:
  - `README.md`
  - `README-zh.md`

## Expected Outcome

Users can choose:

1. `awesome-design-md` for fast style anchoring (`DESIGN.md` baseline).
2. `frontend-design` for production UI implementation and polish.
3. Both together for strongest results without design handoff.
