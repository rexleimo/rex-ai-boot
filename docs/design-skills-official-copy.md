# Official Copy Pack: No-Design-Handoff UI

Updated: 2026-04-18

## 1) One-liner (website / landing page)

`No design handoff? Still ship beautiful UI: lock style with DESIGN.md first, then implement with frontend-design.`

## 2) Product Description (short)

`This workflow is built for teams without ready mockups. Generate a DESIGN.md style contract first, then let the coding agent implement UI under that contract for stronger consistency and better aesthetics.`

## 3) Onboarding Copy (drop-in)

1. Install skills in your project root:

```bash
node <AIOS_ROOT>/scripts/aios.mjs setup --components skills --client codex --scope project --skills awesome-design-md,frontend-design
```

2. Generate a `DESIGN.md` baseline:

```bash
npx --yes getdesign@latest list
npx --yes getdesign@latest add linear --force
```

3. Send this fixed prompt:

```text
First lock style with DESIGN.md, then implement the page using frontend-design.
```

## 3.1) Works with vague prompts too

Even if user instructions are brief or fuzzy, the workflow can still converge to high-quality UI/UX.

Examples users can type directly:

- Element tweak:
  - `Polish this button area, keep the current layout.`
- Style reference:
  - `Restyle this page with a Stripe-like direction, keep features unchanged.`
- Full SaaS flow:
  - `Design a complete SaaS admin UI with dashboard, list, detail, create, and settings flows.`

Recommended built-in system prompt:

```text
When user intent is vague, classify the task into Patch/Restyle/Flow first. Lock style with DESIGN.md, then implement with complete interaction states (hover/focus/active/disabled) and core flow states (loading/empty/error/success).
```

## 4) Default Style Picks (no design handoff)

- SaaS / B2B: `linear`, `vercel`, `supabase`
- Marketing / brand: `framer`, `stripe`, `notion`
- Documentation: `mintlify`, `hashicorp`, `mongodb`

## 5) Support FAQ Templates

Q: Can I use this without any design files?  
A: Yes. It is designed for that. Generate `DESIGN.md` first, then build with `frontend-design`.

Q: I am not a designer. What should I pick?  
A: Start with defaults: `linear` for SaaS, `framer` for landing pages, `mintlify` for docs.

Q: Will output still look generic?  
A: Locking style via `DESIGN.md` first significantly reduces generic template output.

## 6) Success Metrics

- Stable visual direction on first screen
- Consistent typography/spacing/component states
- Fewer design rework loops
- Better subjective UI quality feedback
