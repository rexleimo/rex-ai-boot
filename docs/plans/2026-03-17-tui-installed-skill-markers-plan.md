# TUI Installed Skill Markers Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a clear `(installed)` marker in setup and update skill pickers so users can tell which skills are already installed without cluttering the uninstall picker.

**Architecture:** Keep the current skill-picker interaction model unchanged and limit the change to render-time labeling. Reuse existing installed-skill state and scope/client filters so the marker reflects the selected target context.

**Tech Stack:** Node.js, TUI render module, `node:test`

---

### Task 1: Lock marker behavior with render tests

**Files:**
- Modify: `scripts/tests/aios-tui-render.test.mjs`

- [ ] **Step 1: Write a failing render test that setup or update picker shows `(installed)` on installed skills**
- [ ] **Step 2: Write a failing render test that uninstall picker does not duplicate the `(installed)` marker**
- [ ] **Step 3: Run `node --test scripts/tests/aios-tui-render.test.mjs` and verify the new tests fail**

### Task 2: Implement installed markers in the picker renderer

**Files:**
- Modify: `scripts/lib/tui/render.mjs`

- [ ] **Step 1: Add a small render helper that decides whether a skill should show an installed marker**
- [ ] **Step 2: Scope marker rendering to setup and update pickers only**
- [ ] **Step 3: Reuse current scope/client installed-skill data so the marker matches the active filter**

### Task 3: Verify regression coverage

**Files:**
- Test: `scripts/tests/aios-tui-render.test.mjs`
- Test: `scripts/tests/aios-tui-state.test.mjs`
- Test: `scripts/tests/aios-cli.test.mjs`
- Test: `scripts/tests/skills-component.test.mjs`

- [ ] **Step 1: Re-run `node --test scripts/tests/aios-tui-render.test.mjs` and verify pass**
- [ ] **Step 2: Re-run `node --test scripts/tests/aios-tui-state.test.mjs scripts/tests/aios-tui-render.test.mjs scripts/tests/aios-cli.test.mjs scripts/tests/skills-component.test.mjs` and verify full pass**
