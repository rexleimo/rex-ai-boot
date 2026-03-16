# Uninstall Default Installed Selection Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the uninstall skills picker default-select skills that are already installed for the current `scope + client`.

**Architecture:** Keep install/update defaults catalog-driven, but add an installed-skill index to TUI initialization and scope/client sync so uninstall reflects actual filesystem state.

**Tech Stack:** Node.js ESM, TUI state/session modules, node:test, filesystem path checks

---

### Task 1: Default uninstall selection from installed skills

**Files:**
- Modify: `scripts/lib/tui/state.mjs`
- Modify: `scripts/lib/tui/session.mjs`
- Modify: `scripts/tests/aios-tui-state.test.mjs`

- [ ] **Step 1: Write the failing state test**
- [ ] **Step 2: Run the test and verify failure**
- [ ] **Step 3: Implement installed-skill aware uninstall defaults**
- [ ] **Step 4: Re-run tests and verify pass**
