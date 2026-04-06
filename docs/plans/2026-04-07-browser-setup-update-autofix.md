# Browser Setup/Update Auto-Heal Alignment

Date: 2026-04-07  
Scope: `setup` / `update` browser component lifecycle

## Objective

Ensure browser lifecycle commands (`setup --components browser`, `update --components browser`) use the same CDP self-heal behavior as manual browser doctor fix mode.

## Change

1. In setup lifecycle:
   - run browser doctor with `fix: true` after browser install.
2. In update lifecycle:
   - run browser doctor with `fix: true` after browser update.
3. Documentation:
   - add explicit note in README (EN/ZH) that browser setup/update now auto-heals default CDP port when possible.

## Expected Operator Impact

- Fewer manual loops (`cdp-start` -> doctor -> retry) after browser setup/update.
- Better first-run success when default profile depends on CDP and service is down.
