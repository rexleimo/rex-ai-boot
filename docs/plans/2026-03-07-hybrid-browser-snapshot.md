# Hybrid Browser Snapshot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace full-page screenshot-heavy browser reasoning with a hybrid snapshot that returns layout-aware structured data and only escalates to selector-scoped screenshots when visual fallback is needed.

**Architecture:** `browser_snapshot` will gather viewport-aware layout data from the live DOM, classify regions, and return a compact `layout` payload plus auth/challenge state. `browser_screenshot` will accept an optional `selector` so callers can capture only the ambiguous visual region instead of the full page.

**Tech Stack:** TypeScript, Playwright, MCP server, node:test, tsx

---

### Task 1: Document the approved design

**Files:**
- Create: `docs/plans/2026-03-07-hybrid-browser-snapshot-design.md`
- Create: `docs/plans/2026-03-07-hybrid-browser-snapshot.md`

**Step 1: Write the approved design**

- Capture the hybrid snapshot concept, visual fallback policy, and challenge/auth safety boundary.

**Step 2: Save the implementation plan**

- Record the file list, TDD order, and verification commands.

**Step 3: Review scope before coding**

- Confirm the change stays inside `mcp-server/` and `docs/plans/`.

### Task 2: Add failing snapshot-layout tests

**Files:**
- Create: `mcp-server/tests/browser-layout.test.ts`
- Modify: `mcp-server/src/browser/actions/snapshot.ts`
- Modify: `mcp-server/src/browser/index.ts`
- Modify: `mcp-server/src/index.ts`

**Step 1: Write the failing test**

- Add tests that expect a compact `layout` payload with `regions`, `elements`, `textBlocks`, and `visualHints`.

**Step 2: Run test to verify it fails**

Run: `cd mcp-server && npm test -- --test-name-pattern="layout|snapshot"`

Expected: FAIL because the new helper/output does not exist yet.

**Step 3: Write the minimal implementation**

- Introduce snapshot layout extraction helpers and wire them into `browser_snapshot`.

**Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npm test -- --test-name-pattern="layout|snapshot"`

Expected: PASS.

### Task 3: Add failing selector-screenshot tests

**Files:**
- Create: `mcp-server/tests/browser-screenshot.test.ts`
- Modify: `mcp-server/src/browser/actions/screenshot.ts`
- Modify: `mcp-server/src/browser/index.ts`
- Modify: `mcp-server/src/index.ts`

**Step 1: Write the failing test**

- Add tests that expect `browser_screenshot` to use locator-scoped screenshot when `selector` is provided.

**Step 2: Run test to verify it fails**

Run: `cd mcp-server && npm test -- --test-name-pattern="screenshot"`

Expected: FAIL because screenshot currently only captures the full page.

**Step 3: Write the minimal implementation**

- Add `selector?: string` support, preserve current full-page behavior as fallback.

**Step 4: Run tests to verify they pass**

Run: `cd mcp-server && npm test -- --test-name-pattern="screenshot"`

Expected: PASS.

### Task 4: Wire MCP schema and compatibility fields

**Files:**
- Modify: `mcp-server/src/browser/index.ts`
- Modify: `mcp-server/src/index.ts`
- Modify: `mcp-server/src/browser/actions/snapshot.ts`

**Step 1: Update tool schemas**

- Add optional snapshot controls and selector-scoped screenshot input.

**Step 2: Preserve compatibility**

- Keep top-level title/url/auth/challenge fields and a compact HTML preview instead of the old large HTML blob.

**Step 3: Run focused tests**

Run: `cd mcp-server && npm test -- --test-name-pattern="layout|snapshot|screenshot"`

Expected: PASS.

### Task 5: Verify the complete change

**Files:**
- Modify: `mcp-server/src/browser/actions/snapshot.ts`
- Modify: `mcp-server/src/browser/actions/screenshot.ts`
- Modify: `mcp-server/src/browser/index.ts`
- Modify: `mcp-server/src/index.ts`
- Create: `mcp-server/tests/browser-layout.test.ts`
- Create: `mcp-server/tests/browser-screenshot.test.ts`

**Step 1: Run all tests**

Run: `cd mcp-server && npm test`

Expected: PASS.

**Step 2: Run typecheck**

Run: `cd mcp-server && npm run typecheck`

Expected: PASS.

**Step 3: Run build**

Run: `cd mcp-server && npm run build`

Expected: PASS and `dist/` regenerated.

**Step 4: Manual smoke path**

Run a local flow: `browser_launch -> browser_navigate -> browser_snapshot -> browser_screenshot({ selector }) -> browser_close`.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-07-hybrid-browser-snapshot-design.md \
        docs/plans/2026-03-07-hybrid-browser-snapshot.md \
        mcp-server/src/browser/actions/snapshot.ts \
        mcp-server/src/browser/actions/screenshot.ts \
        mcp-server/src/browser/index.ts \
        mcp-server/src/index.ts \
        mcp-server/tests/browser-layout.test.ts \
        mcp-server/tests/browser-screenshot.test.ts
git commit -m "feat(browser): add hybrid snapshot layout mode"
```
