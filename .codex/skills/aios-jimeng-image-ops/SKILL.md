---
name: aios-jimeng-image-ops
description: Use when generating images on jimeng.jianying.com through browser automation, or when diagnosing unstable Jimeng execution in aios.
---

# AIOS Jimeng Image Ops

## Overview
Use this runbook for stable image generation on Jimeng. It includes selectors, completion signals, policy-failure handling, and evidence requirements verified in a live run.

## Preconditions
- Browser profile has valid Jimeng login session.
- `default` profile should connect to fingerprint browser via CDP (port `9222` by default).
- MCP tools available: `browser_launch`, `browser_navigate`, `browser_auth_check`, `browser_challenge_check`, `browser_type`, `browser_click`, `browser_snapshot`, `browser_screenshot`.
- For page understanding, prefer `browser_snapshot` fields in this order: `pageSummary` -> `regions` -> `elements` -> `textBlocks` -> `visualHints`.
- Use `browser_screenshot` only when `visualHints.needsVisualFallback=true`, and prefer `selector`-scoped capture over full-page screenshots.
- Prompt is policy-safe (avoid risky terms, political/person-identifiable/sensitive wording).

## Execution Flow
1. Open generation page directly:
   - `https://jimeng.jianying.com/ai-tool/generate?ai_feature_name=image`
2. Run `browser_auth_check` and `browser_challenge_check`; if either returns `requiresHumanAction=true`, ask user to complete login/challenge and resume.
3. Confirm prompt box exists:
   - `textarea[placeholder*='请描述你想生成的图片']`
4. Fill prompt in visible textarea.
5. Click submit button with selector strategy:
   - Primary: `button[class*='submit-button'][class*='lv-btn-primary']:not([disabled])`
   - Fallback: `button[class*='submit-button']:not([disabled])`
6. Poll snapshots until one result class appears:
   - Success markers: latest task has image tiles + `重新编辑` and `再次生成`
   - Policy failure marker: `你输入的文字不符合平台规则，请修改后重试`
   - Timeout marker: still `生成中` after budget
   - Read snapshot layout fields first; only take a local screenshot if the result area is visually ambiguous.

## Error Handling
- Policy failure: rewrite prompt to neutral scene/style terms and retry once.
- Timeout: refresh generation page and retry with same prompt once.
- Selector failure: recapture snapshot and update selectors from visible controls.

## Evidence Standard
- Keep at least one snapshot proving success or failure.
- Save one screenshot for run summary.
- Record prompt, outcome, and retry path in final doc.

## Resources
- `references/run-report-2026-03-02.md`: verified live-run record.
- `references/selectors-and-errors.md`: selector cookbook and failure taxonomy.
