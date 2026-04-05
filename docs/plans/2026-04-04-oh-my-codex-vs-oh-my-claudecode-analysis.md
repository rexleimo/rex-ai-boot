# Oh My Codex vs Oh My ClaudeCode Analysis Plan

> **For agentic workers:** REQUIRED: Use superpowers:executing-plans or an equivalent evidence-first execution flow. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clone `oh-my-codex` and `oh-my-claudecode`, then produce an evidence-backed comparison of how each repository augments its target client.

**Architecture:** Treat each repository as a productized client overlay. Inspect install paths, bootstrap scripts, prompt/rule injection, command additions, hook wiring, MCP integration, model/subagent support, UI/statusline customization, and memory/runtime orchestration. Synthesize only from repository evidence.

**Tech Stack:** Git, shell inspection, Markdown/docs analysis, repository diffing.

---

### Task 1: Scope and Evidence Lock

**Files:**
- Create: `docs/plans/2026-04-04-oh-my-codex-vs-oh-my-claudecode-analysis.md`
- Inspect: `temp/vendor/oh-my-codex/*`
- Inspect: `temp/vendor/oh-my-claudecode/*`

- [ ] **Step 1: Define comparison dimensions**

Dimensions:
- installation/bootstrap behavior
- client config injection points
- prompt/rule/skill additions
- commands/hooks/MCP/extensions
- memory/state/session helpers
- UI/statusline/model/subagent features
- upgrade and maintenance flow

- [ ] **Step 2: Define evidence rule**

Evidence rule:
- prefer README + installer + generated config templates + source scripts
- cite exact files for every major claim
- distinguish “ships capability” from “documents a manual workflow”

- [ ] **Step 3: Define stop condition**

Stop when:
- both repos are cloned locally
- enablement surface areas are enumerated
- unique features and shared patterns are mapped
- final summary is backed by direct file evidence

### Task 2: Repository Acquisition

**Files:**
- Create: `temp/vendor/oh-my-codex/`
- Create: `temp/vendor/oh-my-claudecode/`

- [ ] **Step 1: Clone `oh-my-codex`**

Run: `git clone https://github.com/Yeachan-Heo/oh-my-codex.git temp/vendor/oh-my-codex`

- [ ] **Step 2: Clone `oh-my-claudecode`**

Run: `git clone https://github.com/Yeachan-Heo/oh-my-claudecode.git temp/vendor/oh-my-claudecode`

- [ ] **Step 3: Record baseline repo facts**

Run:
- `git -C temp/vendor/oh-my-codex remote -v`
- `git -C temp/vendor/oh-my-claudecode remote -v`
- `git -C temp/vendor/oh-my-codex rev-parse HEAD`
- `git -C temp/vendor/oh-my-claudecode rev-parse HEAD`

### Task 3: Capability Extraction

**Files:**
- Inspect: `temp/vendor/oh-my-codex/README.md`
- Inspect: `temp/vendor/oh-my-codex/install.sh`
- Inspect: `temp/vendor/oh-my-codex/src/**`
- Inspect: `temp/vendor/oh-my-codex/templates/**`
- Inspect: `temp/vendor/oh-my-claudecode/README.md`
- Inspect: `temp/vendor/oh-my-claudecode/install.sh`
- Inspect: `temp/vendor/oh-my-claudecode/src/**`
- Inspect: `temp/vendor/oh-my-claudecode/templates/**`

- [ ] **Step 1: Map top-level structure**
- [ ] **Step 2: Identify install targets and generated artifacts**
- [ ] **Step 3: Enumerate commands, hooks, MCP, prompts, slash commands, or agents**
- [ ] **Step 4: Identify model/runtime/session or memory augmentations**
- [ ] **Step 5: Identify UX layers such as statusline or TUI additions**

### Task 4: Comparison Synthesis

**Files:**
- Modify: `docs/plans/2026-04-04-oh-my-codex-vs-oh-my-claudecode-analysis.md`

- [ ] **Step 1: Write per-repo enablement summary**
- [ ] **Step 2: Write shared patterns and major differences**
- [ ] **Step 3: Note operational implications for Codex vs Claude Code users**

### Task 5: Final Verification

**Files:**
- Verify: `docs/plans/2026-04-04-oh-my-codex-vs-oh-my-claudecode-analysis.md`

- [ ] **Step 1: Re-run source-of-truth commands**

Run:
- `git -C temp/vendor/oh-my-codex rev-parse --short HEAD`
- `git -C temp/vendor/oh-my-claudecode rev-parse --short HEAD`
- `rg -n "statusline|hook|mcp|subagent|agent|memory|command|slash|install" temp/vendor/oh-my-codex temp/vendor/oh-my-claudecode`

- [ ] **Step 2: Confirm every major claim has a supporting file reference**

