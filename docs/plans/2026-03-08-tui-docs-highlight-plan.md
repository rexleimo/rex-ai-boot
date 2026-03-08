# 2026-03-08 TUI Docs Highlight Plan

## Goal
Make the new `aios` full-screen TUI the clearest onboarding path in user-facing docs, and keep the messaging synchronized across English, Chinese, Japanese, and Korean docs.

## Scope
- `README.md`
- `README-zh.md`
- `docs-site/index.md`
- `docs-site/zh/index.md`
- `docs-site/ja/index.md`
- `docs-site/ko/index.md`
- `docs-site/getting-started.md`
- `docs-site/zh/getting-started.md`
- `docs-site/ja/getting-started.md`
- `docs-site/ko/getting-started.md`

## Changes
1. Promote `aios` no-arg launch as the recommended first run.
2. Add a short TUI setup tutorial: launch, choose `Setup`, pick components, run `Doctor`.
3. Replace older script-first homepage snippets with TUI-first snippets.
4. Keep wording aligned across EN / ZH / JA / KO.

## Verification
- Read diffs for all language variants side by side.
- Confirm each language has both:
  - a TUI-first onboarding sentence on homepage/index
  - a TUI setup subsection in Quick Start / Getting Started
