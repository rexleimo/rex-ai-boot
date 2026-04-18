# Awesome DESIGN.md Skill Integration (AIOS)

Date: 2026-04-18

## Goal

Enable future AIOS users to add VoltAgent `awesome-design-md` design guidance to their coding agent through the standard AIOS skills installation flow.

## Scope

- Add a canonical skill source: `skill-sources/awesome-design-md/`.
- Register the skill in `config/skills-catalog.json`.
- Register generation targets in `config/skills-sync-manifest.json`.
- Regenerate repo-local client skill outputs via `node scripts/sync-skills.mjs`.
- Verify the new skill can be installed by name via AIOS skills setup.

## Notes

- The skill uses `npx --yes getdesign@latest` commands because upstream `getdesign.md/<slug>/design-md` is a webpage route, while the CLI provides deterministic file generation (`DESIGN.md`).
- Upstream repository and license:
  - `https://github.com/VoltAgent/awesome-design-md`
  - MIT License
