# TUI Skill Picker Grouping Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve skill picker readability by grouping skills into `Core` and `Optional` sections and truncating descriptions to a terminal-friendly length.

**Architecture:** Keep skill selection behavior unchanged, but compute grouped render lists from existing catalog metadata and render them with short one-line descriptions under each skill.

**Tech Stack:** TUI render module, node:test

---

### Task 1: Group and truncate the skill picker

**Files:**
- Modify: `scripts/lib/tui/render.mjs`
- Modify: `scripts/tests/aios-tui-render.test.mjs`

- [ ] **Step 1: Write the failing render test**
- [ ] **Step 2: Run the test and verify failure**
- [ ] **Step 3: Implement grouped rendering with description truncation**
- [ ] **Step 4: Re-run render tests and verify pass**
