# Docs Funnel Visibility Improvement Plan

Date: 2026-03-04

## Goal

Improve conversion and retention for first-time visitors by making high-intent entry points visible at first glance:

- "Use now" path (fast start) without reading long docs first.
- Project address (GitHub) visibility.
- Blog and friend-site traffic flow visibility.

## Scope

- `mkdocs.yml` navigation/theme visibility changes.
- `docs-site/index.md`, `docs-site/zh/index.md`, `docs-site/ja/index.md`, `docs-site/ko/index.md` content refresh.
- Add a visible Friends page in docs nav and keep footer links.

## Changes

1. Navigation visibility:
   - Enable top tabs in Material (`navigation.tabs`).
   - Add `Project` and `Friends` into top-level nav.
   - Add i18n nav translations for new labels.

2. Homepage conversion:
   - Add "30-second start" section with copy-paste commands.
   - Add explicit project URL and one-click links to Blog / Case Library / Quick Start.

3. Friend links:
   - Create `docs-site/friends.md` (+ localized files) and expose in top nav.
   - Keep existing footer links for persistent secondary exposure.

## Verification

- `mkdocs build --clean`
- Confirm no broken nav keys in i18n.
- Confirm each locale shows: Project / Blog / Friends in visible navigation.
