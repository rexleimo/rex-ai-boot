# Browser AX Snapshot Parity Design

**Date**: 2026-03-08

## Problem

Our Playwright MCP browser tools often underperform `ChromeDevTools/chrome-devtools-mcp` in real workflows:

- `browser_snapshot` (hybrid layout) is limited and sometimes low-signal on modern, dynamic pages.
- The returned `selectorHint` is helpful for debugging but is often too brittle for consistent automation.
- LLMs do better when given an accessibility-tree (AX/a11y) representation with stable semantics.

## Goal

Close the biggest usability gap quickly without switching our MCP runtime away from Playwright:

- Provide an AX-tree based snapshot (text) similar to `chrome-devtools-mcp`'s `take_snapshot`.
- Keep the existing `browser_snapshot` output compatible (hybrid layout remains default).
- Reduce “bad guidance” from snapshot output (clamp pathological bboxes, tighten pageType heuristics).

## Non-goals (this iteration)

- Full uid-based action primitives (click/fill by uid) inside our MCP server.
- Site-specific selector learning or external storage/state.
- CAPTCHA/anti-bot bypass; we still surface `auth/challenge` signals for manual handoff.

## Options

### Option A (Recommended): Add AX snapshot output to `browser_snapshot`

Extend `browser_snapshot` with:

- `includeAx: boolean` to attach `axSnapshot` alongside the existing hybrid layout.
- `mode: "hybrid" | "ax"` to return *only* AX output when requested (smaller, faster, cheaper tokens).

AX collection uses Chromium CDP (`Accessibility.getFullAXTree`) so it works in our Playwright-based server.

Pros:
- Biggest quality boost for LLM understanding.
- Minimal disruption: existing flows still work; no new tool required.
- Keeps actions unchanged; users can still click/type using existing selectors, but with better context.

Cons:
- No direct uid-based click (yet).

### Option B: Add new tool `browser_take_snapshot` (AX-only)

Pros:
- Explicit tool symmetry with `chrome-devtools-mcp`.

Cons:
- More surface area to maintain; users must learn a new tool name.

### Option C: Implement uid-based click/fill by CDP backendDOMNodeId

Pros:
- Closest parity with `chrome-devtools-mcp` action style.

Cons:
- More engineering risk (scrolling, coordinates, focus, cross-frame mapping, post-action waiting).
- Bigger maintenance burden; not ideal for a “timely fix”.

## Chosen Design (Option A)

### API changes

`browser_snapshot` input schema additions:

- `mode?: "hybrid" | "ax"` (default: `"hybrid"`)
- `includeAx?: boolean` (default: `false`)
- `axMaxLines?: number` (default: `350`)
- `axVerbose?: boolean` (default: `false`)

Output additions (when requested):

- `axSnapshot: { mode: "ax-v1", truncated: boolean, maxLines: number, text: string, interactive: [...] }`

`interactive` is a compact list for high-value nodes (link/button/textbox/etc) including:

- `uid` (derived from `backendDOMNodeId` when available)
- `role`, `name`
- optional `url` (for links)

### Hybrid snapshot fixes

- Clamp returned `elements[]` / `textBlocks[]` bbox fields to viewport (not only for region bucketing).
- Tighten `pageType` heuristics to avoid misclassifying generic content pages as editors.

### Testing

- Unit tests for:
  - `pageType` heuristic tightening (regression guard).
  - bbox clamping on returned `elements/textBlocks`.
  - AX snapshot formatter: stable output header + truncation behavior.

### Rollout / Compatibility

- Default behavior remains unchanged (`mode="hybrid"`, no AX unless requested).
- Clients can opt in incrementally by calling `browser_snapshot({ includeAx: true })`.

