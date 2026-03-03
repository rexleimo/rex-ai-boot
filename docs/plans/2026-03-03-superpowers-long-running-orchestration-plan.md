# Superpowers Long-Running Orchestration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make AIOS default to a superpowers-style plan route, integrated with long-running harness controls and conditional parallel dispatch.

**Architecture:** Keep runtime code unchanged and enforce behavior through repository instructions and skills. Route all substantial tasks through process skills first, persist state with ContextDB checkpoints, and decide parallel vs sequential execution from dependency boundaries.

**Tech Stack:** Markdown policy docs (`AGENTS.md`, `CLAUDE.md`, `docs/plans/*`), existing superpowers skills, existing AIOS ContextDB + harness skills.

### Task 1: Superpowers Repository Analysis

**Files:**
- Create: `docs/plans/2026-03-03-superpowers-aios-route-analysis.md`

**Step 1: Write analysis artifact**

Document the superpowers mechanisms that matter for AIOS:
- process-skill routing,
- plan artifacts,
- long-running discipline,
- parallel dispatch decision rules.

**Step 2: Validate artifact references**

Run:
```bash
rg -n "superpowers|dispatch|ContextDB|harness" docs/plans/2026-03-03-superpowers-aios-route-analysis.md
```

Expected: non-empty matches for all four concepts.

### Task 2: Default Route Policy in Repository Instructions

**Files:**
- Modify: `AGENTS.md`

**Step 1: Add required route section**

Add a "Default Superpowers Route" section that defines:
- process-skill selection,
- plan artifact requirement,
- harness + ContextDB checkpoint integration,
- conditional parallel dispatch,
- verification gate before completion.

**Step 2: Verify section exists**

Run:
```bash
rg -n "Default Superpowers Route|dispatching-parallel-agents|ContextDB" AGENTS.md
```

Expected: all keywords found.

### Task 3: Runtime Guidance Alignment

**Files:**
- Modify: `CLAUDE.md`
- Modify: `.codex/skills/aios-project-system/SKILL.md`
- Modify: `.claude/skills/aios-project-system/SKILL.md`
- Modify: `.codex/skills/aios-long-running-harness/SKILL.md`
- Modify: `.claude/skills/aios-long-running-harness/SKILL.md`

**Step 1: Mirror routing guidance**

Ensure each file captures the same core logic:
- process routing before implementation,
- long-running harness checkpoints,
- independent-domain parallel dispatch policy,
- sequential fallback for coupled state.

**Step 2: Verify mirrored content**

Run:
```bash
diff -u .codex/skills/aios-project-system/SKILL.md .claude/skills/aios-project-system/SKILL.md
diff -u .codex/skills/aios-long-running-harness/SKILL.md .claude/skills/aios-long-running-harness/SKILL.md
```

Expected: no diff output.

### Task 4: Final Verification

**Files:**
- Verify all modified files in git status.

**Step 1: Check tracked changes**

Run:
```bash
git status --short
```

Expected: only intended documentation/skill files are modified or added.

**Step 2: Commit checkpoint (optional)**

```bash
git add AGENTS.md CLAUDE.md docs/plans/2026-03-03-superpowers-aios-route-analysis.md docs/plans/2026-03-03-superpowers-long-running-orchestration-plan.md .codex/skills/aios-project-system/SKILL.md .claude/skills/aios-project-system/SKILL.md .codex/skills/aios-long-running-harness/SKILL.md .claude/skills/aios-long-running-harness/SKILL.md
git commit -m "docs(workflow): align aios route with superpowers and long-running harness"
```
