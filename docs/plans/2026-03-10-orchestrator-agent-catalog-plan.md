# Orchestrator Agent Catalog (P1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a canonical orchestrator agent catalog spec and generate `.claude/agents` + `.codex/agents` files, then reference `agentRefId` from the orchestrator dispatch plan.

**Architecture:** Keep `memory/specs/orchestrator-agents.json` as the single source of truth. Provide a small harness module to validate/resolve agent refs and to sync generated agent markdown into per-client folders. The orchestrator adds `agentRefId` to phase job `launchSpec` as an additive field.

**Tech Stack:** Node.js ESM, existing `scripts/lib/*` helpers, JSON spec files, `node:test`.

---

### Task 1: Add the orchestrator agent catalog spec

**Files:**
- Create: `memory/specs/orchestrator-agents.json`

**Step 1: Add a minimal spec**

Include:
- four agents (`rex-planner`, `rex-implementer`, `rex-reviewer`, `rex-security-reviewer`)
- `roleMap` mapping orchestrator roles to those agent ids

**Step 2: Validate the JSON parses**

Run: `node -e "console.log(require('./memory/specs/orchestrator-agents.json').schemaVersion)"`
Expected: prints `1`.

---

### Task 2: Write failing tests for agent resolution + generation

**Files:**
- Create: `scripts/tests/aios-orchestrator-agents.test.mjs`
- Modify: `package.json`

**Step 1: Write failing tests**

Cover:
- resolving `agentRefId` for role ids
- rendering agent markdown includes YAML frontmatter and managed marker
- syncing to a temp workspace writes expected files and skips non-managed files

**Step 2: Run test to verify it fails**

Run: `node --test scripts/tests/aios-orchestrator-agents.test.mjs`
Expected: FAIL because the harness module does not exist yet.

---

### Task 3: Implement agent spec helpers and generator

**Files:**
- Create: `scripts/lib/harness/orchestrator-agents.mjs`
- Create: `scripts/generate-orchestrator-agents.mjs`

**Step 1: Implement minimal module**

Provide:
- spec normalization/validation
- `resolveAgentRefIdForRole(roleId)`
- `renderAgentMarkdown(agent)`
- `syncGeneratedAgents({ rootDir, spec })` that writes `.claude/agents` + `.codex/agents`

**Step 2: Re-run tests**

Run: `node --test scripts/tests/aios-orchestrator-agents.test.mjs`
Expected: PASS.

---

### Task 4: Inject agent refs into dispatch plan

**Files:**
- Modify: `scripts/lib/harness/orchestrator.mjs`
- Test: `scripts/tests/aios-orchestrator-agents.test.mjs`

**Step 1: Add `launchSpec.agentRefId` for phase jobs**

Resolve via `roleMap` from the agent spec.

**Step 2: Run tests**

Run:
- `node --test scripts/tests/aios-orchestrator-agents.test.mjs`
- `npm run test:scripts`

Expected: PASS.

---

### Task 5: Release packaging and security scan alignment

**Files:**
- Modify: `scripts/package-release.sh`
- Modify: `scripts/package-release.ps1`
- Modify: `scripts/doctor-security-config.mjs`

**Step 1: Include agent folders in release archives**

Add:
- `.claude/agents`
- `.codex/agents`

**Step 2: Extend security config doctor agent scan**

Scan `.codex/agents` markdown files (same as `.claude/agents`).

**Step 3: Run script tests**

Run: `npm run test:scripts`
Expected: PASS.

---

Plan complete and saved to `docs/plans/2026-03-10-orchestrator-agent-catalog-plan.md`.

