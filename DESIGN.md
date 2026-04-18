# Documentation Interface Design Contract

## Mode
- `Restyle`: Keep information architecture and markdown content unchanged; improve visual language and interaction quality.
- `Brand-forward`: Strengthen visible RexAI brand identity across docs and blog without changing navigation/content structure.

## Assumptions
- `Goal`: Make docs/blog look more premium, readable, and clearly recognizable as RexAI properties without changing navigation structure.
- `Primary user`: AI engineering practitioners using Codex/Claude/Gemini/OpenCode workflows.
- `Platform`: Web desktop first, with strong mobile fallback.
- `Scope`: Visual system refresh for MkDocs Material surfaces (`docs-site` + `blog-site`).

## No-Design-Draft Decisions
- `Audience`: Prosumer + engineering teams
- `Tone`: Editorial technical with brand emphasis
- `Density`: Balanced
- `Contrast`: Medium-high
- `Motion`: Subtle
- `Memorable element`: Aurora stripe + brand glow accents + signature section heading underline

## Visual System
- Typography:
  - Headings: `Space Grotesk`
  - Body: `IBM Plex Sans`
  - Code: `JetBrains Mono`
- Color roles:
  - Primary: deep navy (`#0f3a68`)
  - Accent: teal (`#0f9a90`)
  - Brand flare: electric cyan (`#35d4d1`) for high-priority highlights
  - Surface: white / mist blue
  - Text: ink blue with muted slate secondary text
- Components:
  - Rounded card containers for main reading area
  - Pill-style CTA buttons with clear hover/focus states and stronger brand gradients
  - Elevated but restrained table/code/admonition containers
- Motion:
  - Light page-entry fade/slide
  - Short hover lift on cards/buttons
  - Respect `prefers-reduced-motion`

## Accessibility Baseline
- Keep visible keyboard focus rings.
- Maintain strong foreground/background contrast for body text and controls.
- Preserve readable line length and spacing on desktop/mobile.
