# Docs + Blog + i18n + Redirect Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) or superpowers:subagent-driven-development (recommended). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the official docs/blog publishing surfaces so the latest RL Training feature is visible, the blog index/nav includes recent posts, en/zh/ja/ko are consistent (including full translations for the core set), docs/blog links preserve locale, and historical URLs redirect cleanly.

**Architecture:** Keep MkDocs Material + mkdocs-static-i18n. Make blog canonical posts live at `blog-site/*.md` (EN) and `blog-site/{zh,ja,ko}/*.md` (localized). Remove `docs-site/blog/*` to avoid `/blog` output collisions. Implement redirects via stub markdown pages (no new redirect plugin).

**Tech Stack:** MkDocs (`mkdocs.yml`, `mkdocs.blog.yml`), Markdown content under `docs-site/` and `blog-site/`, optional sync-check script under `scripts/`.

---

### Task 1: Set up build commands (docs + blog)

**Files:**
- Read: `docs-requirements.txt`
- Run: external venv mkdocs at `/Users/rex/cool.cnb/rex-ai-boot/.venv-docs/bin/mkdocs`

- [ ] **Step 1: Verify mkdocs binaries**
  - Run: `/Users/rex/cool.cnb/rex-ai-boot/.venv-docs/bin/mkdocs --version`
  - Expected: prints MkDocs version.

- [ ] **Step 2: Baseline builds (before changes)**
  - Run: `/Users/rex/cool.cnb/rex-ai-boot/.venv-docs/bin/mkdocs build -f mkdocs.yml --strict`
  - Run: `/Users/rex/cool.cnb/rex-ai-boot/.venv-docs/bin/mkdocs build -f mkdocs.blog.yml --strict`
  - Expected: both exit 0 (or note known pre-existing failures).

### Task 2: Canonicalize blog posts at blog root (EN)

**Files:**
- Modify: `mkdocs.blog.yml`
- Modify: `blog-site/index.md`
- Move/Modify: `blog-site/blog/rl-training-system.md`
- Create: `blog-site/rl-training-system.md`
- Create: `blog-site/blog/rl-training-system.md` (redirect stub)

- [ ] **Step 1: Move RL post to blog root**
  - Create `blog-site/rl-training-system.md` from the current `blog-site/blog/rl-training-system.md`.
  - Replace `blog-site/blog/rl-training-system.md` with a redirect stub that points to `/blog/rl-training-system/`.

- [ ] **Step 2: Fix blog home indexes**
  - Make `blog-site/index.md` English and ensure the “Latest posts” list points to the canonical slugs (no broken `rl-training-system.md` references).
  - Ensure locale indexes `blog-site/zh/index.md`, `blog-site/ja/index.md`, `blog-site/ko/index.md` list the same core posts (localized titles ok).

- [ ] **Step 3: Update blog nav**
  - Update `mkdocs.blog.yml` `nav` to include the core set posts explicitly:
    - `rl-training-system.md`
    - `contextdb-fts-bm25-search.md`
    - `windows-cli-startup-stability.md`
    - `orchestrate-live.md`
  - Keep existing items (launch post, cli comparison, automation playbook, xiaohongshu).

### Task 3: Translate and sync core blog posts for zh/ja/ko

**Files:**
- Modify/Create: `blog-site/zh/*.md`
- Create: `blog-site/ja/*.md`
- Create: `blog-site/ko/*.md`

- [ ] **Step 1: RL Training translations**
  - Ensure `blog-site/zh/rl-training-system.md` matches EN structure and content (translated).
  - Create `blog-site/ja/rl-training-system.md` (full translation).
  - Create `blog-site/ko/rl-training-system.md` (full translation).

- [ ] **Step 2: ContextDB search upgrade translations**
  - Ensure `blog-site/zh/contextdb-fts-bm25-search.md` exists and is complete.
  - Create `blog-site/ja/contextdb-fts-bm25-search.md` (full translation).
  - Create `blog-site/ko/contextdb-fts-bm25-search.md` (full translation).

- [ ] **Step 3: Windows stability translations**
  - Ensure `blog-site/zh/windows-cli-startup-stability.md` exists and is complete.
  - Create `blog-site/ja/windows-cli-startup-stability.md` (full translation).
  - Create `blog-site/ko/windows-cli-startup-stability.md` (full translation).

### Task 4: Fix docs home to surface RL Training in 4 locales

**Files:**
- Modify: `docs-site/index.md`
- Modify: `docs-site/zh/index.md`
- Modify: `docs-site/ja/index.md`
- Modify: `docs-site/ko/index.md`

- [ ] **Step 1: Add “Latest / Core Features” section**
  - Add a short section that highlights RL Training and links to `/blog/rl-training-system/` (EN) and relies on locale link localization for non-EN.
  - Also include links to the other core posts.
  - Keep the rest of the existing docs home content intact.

### Task 5: Remove docs-side /blog emission and migrate docs-blog posts

**Files:**
- Delete: `docs-site/blog/*`
- Modify: any docs pages linking to `blog/...` relative paths
- Create redirect stubs in blog as needed

- [ ] **Step 1: Remove `docs-site/blog/*`**
  - Delete the folder to avoid `/blog/*` collisions in the docs build.

- [ ] **Step 2: Preserve content via blog**
  - Move any valuable content into `blog-site/` as canonical posts (EN), and add locale translations if they become part of the core set.
  - If old URLs existed, add redirect stubs under `blog-site/blog/*` to point to new canonical locations.

### Task 6: Fix broken in-post links and cross-site locale behavior

**Files:**
- Modify: core blog posts (EN + locales)
- Modify: docs pages that currently link to `blog/...` relative docs paths

- [ ] **Step 1: Replace repo-relative links**
  - Replace links like `docs-site/architecture.md` with published URLs (prefer root-relative: `/architecture/`).
  - Replace links to design specs (in `docs/superpowers/specs/...`) with GitHub repo links or remove from published blog posts if not intended for public browsing.

- [ ] **Step 2: Verify locale behavior**
  - Ensure non-EN pages link to the correct locale path (docs↔blog).
  - Keep current JS link localization behavior intact.

### Task 7: Add a sync gate (prevents future drift)

**Files:**
- Create: `scripts/check-site-sync.mjs`
- Modify (optional): `package.json` to add `check:site-sync`

- [ ] **Step 1: Implement sync check**
  - Verify core files exist for all locales in both docs and blog.
  - Verify blog nav entries exist for all locales.
  - Exit non-zero with actionable error messages when drift is detected.

### Task 8: Verification

- [ ] **Step 1: Build docs + blog strict**
  - Run: `/Users/rex/cool.cnb/rex-ai-boot/.venv-docs/bin/mkdocs build -f mkdocs.yml --strict`
  - Run: `/Users/rex/cool.cnb/rex-ai-boot/.venv-docs/bin/mkdocs build -f mkdocs.blog.yml --strict`
  - Expected: exit 0.

- [ ] **Step 2: Grep output for broken paths**
  - Run: `rg -n "docs-site/|docs/superpowers|/blog/blog/" site -S`
  - Expected: no `docs-site/` or `docs/superpowers` path leaks; `/blog/blog/` should only appear in redirect stub outputs.

