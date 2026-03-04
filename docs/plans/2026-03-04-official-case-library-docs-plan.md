# Official Case Library Documentation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an official, discoverable case library that shows what rex-ai-boot can do with reproducible commands and evidence criteria.

**Architecture:** Introduce a dedicated `case-library` doc as the canonical capability map, then cross-link it from Overview and CLI Workflows so users can find concrete scenarios in under one click. Keep localized entry pages aligned so non-English users can still discover and run the same flows.

**Tech Stack:** MkDocs Material + i18n docs in `docs-site/*`.

---

### Task 1: Define canonical case-library page (English)

**Files:**
- Create: `docs-site/case-library.md`

**Steps:**
1. Add an "Official Case Library" page with 6-8 practical scenarios.
2. For each scenario, include: "When to use", "Run", and "Evidence".
3. Reuse only real scripts and commands that exist in this repository.

### Task 2: Add localized discovery pages

**Files:**
- Create: `docs-site/zh/case-library.md`
- Create: `docs-site/ja/case-library.md`
- Create: `docs-site/ko/case-library.md`

**Steps:**
1. Add localized titles and quick summaries.
2. Keep command blocks consistent with English.
3. Include pointer to English page for latest full details.

### Task 3: Wire navigation and discovery links

**Files:**
- Modify: `mkdocs.yml`
- Modify: `docs-site/index.md`
- Modify: `docs-site/zh/index.md`
- Modify: `docs-site/ja/index.md`
- Modify: `docs-site/ko/index.md`
- Modify: `docs-site/use-cases.md`
- Modify: `docs-site/zh/use-cases.md`
- Modify: `docs-site/ja/use-cases.md`
- Modify: `docs-site/ko/use-cases.md`
- Modify: `docs-site/llms.txt`
- Modify: `docs-site/llms-full.txt`

**Steps:**
1. Add `Case Library` to top-level nav.
2. Add language translations for nav label.
3. Add links from overview and workflow pages to improve discoverability.
4. Add URL to LLM index files to improve retrieval coverage.

### Task 4: Verify docs build and consistency

**Files:**
- No source changes expected.

**Steps:**
1. Run `mkdocs build -f mkdocs.yml`.
2. Confirm no broken build after adding new pages/nav item.
3. Run `git status --short` and confirm only intended docs changed.

### Expected Outcome

Users can answer "what can this repo actually do" using an official, reproducible case library with clear command paths and evidence checks.
