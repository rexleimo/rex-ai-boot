# Jimeng Selectors and Error Patterns

## Selector Priority
1. `textarea[placeholder*='请描述你想生成的图片']`
2. `button[class*='submit-button'][class*='lv-btn-primary']:not([disabled])`
3. `button[class*='submit-button']:not([disabled])`

## Why Not Text-Only Selectors
- Generate submit may be icon-only with empty button text.
- `再次生成` appears in history cards and can be misclicked.

## Completion Signals
- Success: new task card with prompt text + image tiles + `重新编辑`/`再次生成` actions.
- Policy reject: explicit warning string about platform rules.
- Still running: `生成中` or `智能创意中`.

## Common Failure Modes
- `No active page`: browser not launched or profile lost.
- Selector timeout: page changed layout or hidden composer state.
- Policy block: prompt contains disallowed phrasing.
- Session expired: redirected state or login wall appears.
