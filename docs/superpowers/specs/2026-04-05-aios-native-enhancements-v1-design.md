# AIOS Native Enhancements v1 Design

## Goal

Turn AIOS from a strong cross-client runtime/tooling platform into a stronger native enhancement layer for supported agent clients.

v1 should make AIOS feel more "installed into" clients instead of merely wrapping them, while preserving the current platform advantage:

- shared local-first runtime across multiple clients
- Browser MCP + ContextDB + orchestration as the durable base
- safe installation, update, and doctor flows

## Scope

### In scope

- Introduce a first-class `native` component in AIOS setup/update/doctor flows.
- Build one shared source-of-truth for native enhancement artifacts.
- Cover four clients in the shared base:
  - `codex`
  - `claude`
  - `gemini`
  - `opencode`
- Deepen `codex` and `claude` first.
- Provide compatibility-tier native enhancement for `gemini` and `opencode`.
- Add managed metadata, conflict detection, backups, and doctor checks for native artifacts.

### Out of scope

- Full OMC-style Claude lifecycle hook platform in v1.
- Two permanently divergent client integration stacks.
- Unbounded modification of user-owned config files.
- Replacing the existing shell wrapper / ContextDB / Browser MCP architecture.

## Product Positioning

AIOS v1 native enhancements should be described as:

`four-client shared native base + Codex/Claude deeper native integration`

This preserves the current AIOS advantage:

- broader than single-client enhancement projects
- still local-first and platform-oriented
- safer to maintain over time

## Current State

AIOS already has important pieces of the target state:

- repo-local and global skills install paths across clients
- generated agent catalogs for `codex` and `claude`
- shell wrappers for `codex`, `claude`, `gemini`, and `opencode`
- Browser MCP, ContextDB, privacy guard, quality gate, orchestrate, and learn-eval

But the native integration surface is incomplete and inconsistent:

- `skills` installation covers four clients
- `agents` synchronization currently targets only `codex` and `claude`
- there is no first-class `native` component
- native enhancement artifacts are not managed as one coherent install/update/doctor surface
- user-facing setup still reads as separate capabilities rather than "AIOS enhances your client natively"

## Design Principles

1. Shared source of truth first.
2. Client-specific overlays only where the client genuinely differs.
3. Marker-bounded managed content only.
4. Backups before mutation.
5. Native doctor must explain ownership, conflicts, and recovery.
6. `gemini` and `opencode` are included in the base, but not over-claimed as fully deep-integrated in v1.

## Proposed Architecture

### 1. New native enhancement source tree

Add a dedicated source tree for native artifacts:

`client-sources/native-base/`

Structure:

```text
client-sources/native-base/
  shared/
    bootstrap/
    doctor/
    metadata/
  codex/
    bootstrap/
    config/
  claude/
    bootstrap/
    config/
    local/
  gemini/
    bootstrap/
    config/
  opencode/
    bootstrap/
    config/
```

Purpose:

- `shared/` contains client-agnostic native enhancement material.
- per-client directories contain only overlays and emission-specific fragments.

This avoids creating four long-lived divergent implementations.

### 2. New native sync pipeline

Add:

- `scripts/lib/native/sync.mjs`
- `scripts/lib/native/doctor.mjs`
- `scripts/lib/native/emitters/codex.mjs`
- `scripts/lib/native/emitters/claude.mjs`
- `scripts/lib/native/emitters/gemini.mjs`
- `scripts/lib/native/emitters/opencode.mjs`

Responsibilities:

- resolve target roots by client + scope
- materialize native enhancement artifacts from shared base + client overlay
- write only managed blocks/files
- attach ownership metadata
- back up existing managed targets before replacing them
- detect unmanaged conflicts and stop safely

### 3. First-class lifecycle component

Promote `native` to a first-class component in AIOS lifecycle flows:

- `aios setup --components native`
- `aios update --components native`
- `aios doctor --native`
- `aios internal native install`
- `aios internal native update`
- `aios internal native doctor`

`all` should include `native`.

This changes AIOS from "multiple independent installables" to "one platform with a native enhancement layer".

## Client Strategy

### Codex

#### v1 target

Codex should become the strongest v1 native target.

Planned outputs:

- managed Codex bootstrap instructions
- managed native enhancement instructions for Codex-specific behavior
- synchronized `.codex/agents`
- synchronized `.codex/skills`
- managed Codex-native metadata and doctor checks
- optional managed config fragments only where AIOS can safely prove ownership

#### Why Codex first

- AIOS already has strong `.codex/skills` coverage
- Codex paths and repo-local conventions are already well established
- shell + ContextDB story already fits Codex well

### Claude

#### v1 target

Claude should get the shared native base plus a safe deeper integration layer.

Planned outputs:

- managed Claude bootstrap instructions
- synchronized `.claude/agents`
- synchronized `.claude/skills`
- safe, marker-bounded local config fragments
- ownership-aware doctor and update logic

#### v1 limitation

Do not ship a full plugin/hook orchestration rewrite in v1.

Instead:

- prepare a clean managed surface
- make deeper hook integration possible later
- keep default behavior safe and reversible

### Gemini

#### v1 target

Gemini is included in the shared base.

Planned outputs:

- bootstrap instructions
- synchronized `.gemini/skills`
- compatibility-tier native metadata
- doctor checks

#### v1 limitation

No promise of Codex/Claude-level deep native integration.

### Opencode

#### v1 target

Opencode is included in the shared base.

Planned outputs:

- bootstrap instructions
- synchronized `.opencode/skills`
- compatibility-tier native metadata
- doctor checks

#### v1 limitation

No promise of Codex/Claude-level deep native integration.

## Managed Ownership Model

### Ownership metadata

Each managed native artifact should write a metadata file similar in spirit to current skill sync metadata.

Suggested file:

- `.aios-native-sync.json`

Minimum fields:

- `client`
- `scope`
- `sourcePath`
- `generatedAt`
- `aiosVersion`
- `managedTargets`
- `tier`

Where:

- `tier = deep` for `codex` and `claude` deepened artifacts
- `tier = compatibility` for `gemini` and `opencode`

### Managed content rules

AIOS may:

- create managed files it clearly owns
- replace managed files it previously created
- append or update marker-bounded managed blocks in shared files

AIOS may not:

- overwrite unmanaged whole files
- rewrite user-authored content outside managed blocks
- silently convert unmanaged content into managed content

## Compatibility and Safety Strategy

### Safe mutation policy

All client config mutations must follow this order:

1. detect target
2. detect ownership
3. detect unmanaged conflict
4. back up managed content if changing
5. write managed update
6. record metadata

### Conflict policy

If an unmanaged target already occupies a managed path or block:

- stop
- mark doctor status as `conflict`
- print exact remediation guidance

Do not auto-overwrite.

### Scope policy

Support:

- global scope
- project scope

Rules:

- project scope only mutates project-local client roots
- global scope only mutates home-level client roots
- no mixed writes in a single target operation

## CLI and UX Changes

### Root help and setup mental model

Update CLI help and README language so native enhancement is explicit.

Current mental model:

- browser
- shell
- skills
- agents
- superpowers

Target mental model:

- native enhancements
- browser automation
- memory/runtime wrappers
- orchestration/quality utilities

### Doctor output

Doctor should show a native section with explicit statuses:

- `managed`
- `unmanaged`
- `missing`
- `conflict`
- `compatibility`

Sample conceptual output:

```text
native.codex.bootstrap      managed
native.codex.agents         managed
native.claude.local-config  managed
native.gemini.bootstrap     compatibility
native.opencode.bootstrap   compatibility
```

This gives users a clear picture of what "AIOS native enhancement" actually means.

## Phase Plan

### Phase A: Shared base

Deliver:

- `client-sources/native-base`
- `scripts/lib/native/sync.mjs`
- `scripts/lib/native/doctor.mjs`
- `native` lifecycle component
- four-client native bootstrap generation
- ownership metadata
- basic doctor validation

Success condition:

AIOS can install, update, and doctor a native base for all four clients.

### Phase B: Codex polish + Claude safe deepening

Deliver:

- stronger Codex bootstrap/native enhancement outputs
- Claude local config fragment management
- improved conflict detection and backups
- better help text and setup UX

Success condition:

Codex and Claude feel materially more native after setup.

### Phase C: Claude deeper integration preparation

Deliver:

- extension points for future lifecycle/hook integration
- clearer ownership boundaries for deeper Claude surfaces

Success condition:

AIOS can deepen Claude later without redesigning v1 foundations.

## Risks

### Risk 1: user config damage

This is the highest risk.

Mitigation:

- marker-bounded writes only
- backups before mutation
- unmanaged conflict refusal
- explicit doctor output

### Risk 2: false symmetry across clients

Trying to force all four clients to look identical would produce fragile design.

Mitigation:

- shared base, not fake parity
- explicit `deep` vs `compatibility` tiers

### Risk 3: drift between skills/agents/native artifacts

Mitigation:

- one source tree for native enhancements
- one sync pipeline
- one doctor pipeline

### Risk 4: low user-perceived value

Mitigation:

- make `native` visible in setup/help/doctor
- ensure `codex` and `claude` show immediate first-run benefit

## Validation Plan

### Static validation

Commands:

- `node scripts/aios.mjs setup --components native --client codex`
- `node scripts/aios.mjs setup --components native --client claude`
- `node scripts/aios.mjs setup --components native --client gemini`
- `node scripts/aios.mjs setup --components native --client opencode`

Expected:

- correct artifacts exist
- metadata exists
- unmanaged files are not overwritten

### Doctor validation

Command:

- `node scripts/aios.mjs doctor --native`

Expected:

- ownership is reported correctly
- missing/conflict states are distinguishable
- remediation text is actionable

### Update and rollback validation

Scenarios:

- run setup twice
- run update after modifying managed content
- run update with unmanaged conflict

Expected:

- idempotent behavior
- backup exists before managed replacement
- no duplicate managed blocks
- unmanaged conflict stops safely

### Real client smoke validation

#### Codex

Expected:

- native bootstrap visible
- repo-local skills/agents still resolve
- AIOS-managed artifacts are discoverable by doctor

#### Claude

Expected:

- native bootstrap visible
- local enhancement fragments merge safely
- existing user configuration remains intact

#### Gemini and Opencode

Expected:

- compatibility bootstrap present
- skill integration remains valid
- doctor reflects compatibility tier accurately

## Success Criteria

This design succeeds when:

1. AIOS has a formal `native` component.
2. All four clients are covered by a shared native enhancement base.
3. `codex` and `claude` receive stronger, clearly better native integration than today.
4. `gemini` and `opencode` are included without being over-claimed.
5. Setup/update/doctor become the authoritative operating surface for native enhancement state.

## Recommendation

Proceed with:

`AIOS Native Enhancements v1 = four-client shared base + Codex/Claude deep integration first`

This is the highest-leverage path because it:

- strengthens AIOS product quality
- preserves AIOS platform identity
- keeps future Claude deep integration open
- avoids building four separate systems
