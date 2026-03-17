# TUI Skill Picker Scroll And Bulk Actions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the skill picker usable in smaller terminals by adding a scrolling window and bulk select controls, with uninstall supporting all-visible select/clear actions.

**Architecture:** Keep the existing state reducer and string renderer structure, but add a small skill-picker view model that computes visible rows from `cursor`, `scrollOffset`, and a fixed page size. Render bulk action rows after the list, and keep selection semantics scoped to the current `scope + client` filter.

**Tech Stack:** Node.js, TUI state/render modules, `node:test`

---

### Task 1: Lock the new skill-picker behavior with tests

**Files:**
- Modify: `scripts/tests/aios-tui-state.test.mjs`
- Modify: `scripts/tests/aios-tui-render.test.mjs`

- [ ] **Step 1: Write a failing state test for scroll offset updates while moving through a long skill list**
- [ ] **Step 2: Write a failing state test for `Select all` and `Clear all` in uninstall picker**
- [ ] **Step 3: Write a failing render test that only a windowed subset of skills is shown, with window metadata**
- [ ] **Step 4: Run `node --test scripts/tests/aios-tui-state.test.mjs scripts/tests/aios-tui-render.test.mjs` and verify the new tests fail for the expected missing behavior**

### Task 2: Implement skill-picker windowing and bulk actions

**Files:**
- Modify: `scripts/lib/tui/state.mjs`
- Modify: `scripts/lib/tui/render.mjs`
- Modify: `scripts/lib/tui/skill-picker.mjs`

- [ ] **Step 1: Add shared helpers to compute ordered skill rows, page size, and visible window slice**
- [ ] **Step 2: Extend TUI state with `scrollOffset` lifecycle for the skill picker**
- [ ] **Step 3: Keep `scrollOffset` synchronized with cursor movement and reset it when entering/leaving the picker**
- [ ] **Step 4: Add `Select all`, `Clear all`, and `Done` action rows to the picker interaction model**
- [ ] **Step 5: Scope bulk selection to the current filtered skill set only**
- [ ] **Step 6: Render only the current window, plus a compact `Showing X-Y of Z` indicator**

### Task 3: Verify regression coverage

**Files:**
- Test: `scripts/tests/aios-tui-state.test.mjs`
- Test: `scripts/tests/aios-tui-render.test.mjs`
- Test: `scripts/tests/aios-cli.test.mjs`
- Test: `scripts/tests/skills-component.test.mjs`

- [ ] **Step 1: Re-run `node --test scripts/tests/aios-tui-state.test.mjs scripts/tests/aios-tui-render.test.mjs` and verify pass**
- [ ] **Step 2: Re-run `node --test scripts/tests/aios-tui-state.test.mjs scripts/tests/aios-tui-render.test.mjs scripts/tests/aios-cli.test.mjs scripts/tests/skills-component.test.mjs` and verify full pass**
