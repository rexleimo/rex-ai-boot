---
title: Agent Team & HUD
description: Monitor and manage multi-agent collaborations with HUD dashboards and Team Ops status tracking.
---

# Agent Team & HUD

AIOS provides **Team Operations (Team Ops)** — a set of tools for monitoring and managing multi-agent collaborations across Codex CLI, Claude Code, and Gemini CLI sessions.

## Overview

Team Ops gives you visibility into:
- **Real-time session status** via HUD (Heads-Up Display)
- **Historical session analysis** with quality-gate tracking
- **Skill improvement opportunities** via skill candidates
- **Dispatch hindsight** for debugging failed runs

## Quick Start

### View Current Session Status

```bash
# Minimal HUD for current session
aios hud

# Full details with watch mode
aios hud --watch --preset full

# Specify provider and session
aios hud --provider codex --session <session-id>
```

### Team Status & History

```bash
# Watch team status in real-time
aios team status --provider codex --watch

# View session history (last 20 runs)
aios team history --provider codex --limit 20
```

## Core Components

### HUD (Heads-Up Display)

HUD provides a real-time dashboard for a single session:
- Current task goal
- Dispatch status (jobs executed, blocked, pending)
- Quality-gate outcome
- Skill candidate availability
- Hindsight analysis (failure patterns, regressions)

**HUD Presets:**
| Preset | Use Case |
|--------|----------|
| `minimal` | Long-running watch sessions |
| `compact` | Terminal-friendly summary |
| `focused` (default) | Balanced detail |
| `full` | Complete diagnostics |

### Team Status

Shows aggregated status across all recent sessions for a provider:
- Active vs completed sessions
- Success/failure rates
- Quality-gate summaries
- Top skill candidates

### Team History

Historical analysis of past sessions:
- Dispatch outcomes
- Quality-gate failures by category
- Hindsight patterns (repeated failures, regressions)
- Fix hints and recommendations

## Skill Candidates

**Skill Candidates** are automated improvement suggestions extracted from failed sessions:

1. Session fails quality-gate
2. Learn-eval analyzes failure patterns
3. Generates skill patch draft
4. You review and apply the patch

### View Skill Candidates

```bash
# Show skill candidates for current session
aios team status --show-skill-candidates

# HUD with skill candidate detail view
aios hud --show-skill-candidates --skill-candidate-view detail

# List candidates for specific session
aios team skill-candidates list --session-id <session-id>
```

### Export & Apply Patches

```bash
# Export patch template to artifact file
aios team status --export-skill-candidate-patch-template

# Export with custom output path
aios team skill-candidates export --output-path ./my-patch.md

# Apply a skill candidate patch
aios skill-candidate apply <candidate-id>
```

### Filter by Draft ID

```bash
# Filter skill candidates by draft ID
aios team status --show-skill-candidates --draft-id <draft-id>

# HUD with draft filter
aios hud --show-skill-candidates --draft-id <draft-id>
```

## Quality-Gate Filters

Filter history by quality-gate outcomes:

```bash
# Show only failed sessions
aios team history --quality-failed-only

# Filter by specific category
aios team history --quality-category clarity
aios team history --quality-category sample.latency-watch

# Filter by category prefix (match any)
aios team history --quality-category-prefix clarity,sample

# Filter by prefix (match all)
aios team history --quality-category-prefixes clarity,dispatch --prefix-mode all
```

## Command Reference

### `aios hud`

| Option | Default | Description |
|--------|---------|-------------|
| `--session-id` | current | Target session ID |
| `--provider` | codex | Provider (codex/claude/gemini) |
| `--preset` | focused | HUD preset (minimal/compact/focused/full) |
| `--watch` | false | Continuous monitoring |
| `--fast` | false | Fast mode (reduced data fetch) |
| `--show-skill-candidates` | false | Show skill candidate details |
| `--skill-candidate-limit` | 6 | Max candidates to show (1-20) |
| `--skill-candidate-view` | inline | View mode (inline/detail) |
| `--export-skill-candidate-patch-template` | false | Export patch artifact |
| `--draft-id` | - | Filter by draft ID |
| `--json` | false | Output as JSON |
| `--interval-ms` | 1000 | Watch refresh interval |

### `aios team status`

| Option | Default | Description |
|--------|---------|-------------|
| `--session-id` | current | Target session ID |
| `--provider` | codex | Provider (codex/claude/gemini) |
| `--preset` | focused | HUD preset |
| `--watch` | false | Continuous monitoring |
| `--fast` | false | Fast mode |
| `--show-skill-candidates` | false | Show skill candidates |
| `--skill-candidate-limit` | 6 | Max candidates (1-20) |
| `--export-skill-candidate-patch-template` | false | Export patch artifact |
| `--draft-id` | - | Filter by draft ID |
| `--json` | false | Output as JSON |

### `aios team history`

| Option | Default | Description |
|--------|---------|-------------|
| `--provider` | codex | Provider (codex/claude/gemini) |
| `--limit` | 10 | Max sessions to show |
| `--concurrency` | 4 | Parallel session reads |
| `--fast` | false | Skip hindsight details |
| `--quality-failed-only` | false | Show only failed sessions |
| `--quality-category` | - | Filter by category |
| `--quality-category-prefix` | - | Filter by prefix |
| `--quality-category-prefixes` | - | Multiple prefixes |
| `--quality-category-prefix-mode` | any | Match mode (any/all) |
| `--draft-id` | - | Filter by draft ID |
| `--since` | - | Filter by date (ISO) |
| `--status` | - | Filter by status |
| `--json` | false | Output as JSON |

### `aios team skill-candidates`

| Subcommand | Description |
|------------|-------------|
| `list` | List skill candidates for session |
| `export` | Export patch template artifact |

## Related Documentation

- [HUD Guide](hud-guide.md) - Detailed HUD usage and customization
- [Skill Candidates](skill-candidates.md) - Understanding and applying skill patches
- [ContextDB](contextdb.md) - Session storage and memory system
