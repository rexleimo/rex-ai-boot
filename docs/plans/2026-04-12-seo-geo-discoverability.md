# 2026-04-12 SEO/GEO Discoverability Optimization

## Goal
Improve project discoverability across GitHub, docs, and blog search by strengthening high-intent keywords and answer-engine friendly structure, with English-first updates and synced zh/ja/ko landing pages.

## Scope
- README: `README.md`, `README-zh.md`
- Docs landing pages: `docs-site/index.md`, `docs-site/zh/index.md`, `docs-site/ja/index.md`, `docs-site/ko/index.md`
- Blog landing pages: `blog-site/index.md`, `blog-site/zh/index.md`, `blog-site/ja/index.md`, `blog-site/ko/index.md`
- Site metadata: `mkdocs.yml`, `mkdocs.blog.yml`
- LLM index summaries: `docs-site/llms.txt`, `docs-site/llms-full.txt`

## Strategy
1. Add explicit first-screen “Quick Answer + CTA” messaging for core intents.
2. Align wording with high-interest entities and intent clusters:
   - AI memory system / 记忆系统
   - Hermes engine workflows
   - Agent Team orchestration
   - Automatic subagent planning
3. Keep claims implementation-safe and avoid unverifiable marketing statements.
4. Preserve existing canonical links and localization structure for search stability.
5. Validate site link sync and script tests.

## Verification
- `npm run check:site-sync`
- `npm run test:scripts`
