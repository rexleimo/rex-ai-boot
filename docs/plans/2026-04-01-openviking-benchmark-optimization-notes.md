# OpenViking Benchmark & Optimization Notes (rex-ai-boot)

**Goal:** 拉取 OpenViking 并基于其工程实践，输出对当前仓库可落地的优化建议（优先低成本高收益）。

## Scope
- OpenViking：架构与关键工程机制（入口、配置、运行、测试、文档）
- rex-ai-boot：可对齐点与差距

## Checklist
- [x] 拉取仓库并确认版本
- [x] 盘点 OpenViking 模块与开发流程
- [x] 对照 rex-ai-boot 提炼优化点（按优先级）
- [x] 给出建议执行顺序（P0/P1/P2）

## 拉取结果

- 仓库：`https://github.com/volcengine/OpenViking`
- 本地路径：`temp/OpenViking`
- 当前提交：`27f6188`

## 对比观察（精简）

1. OpenViking 在主分支 push 上默认跑测试与安全扫描，且测试覆盖多 OS/多版本矩阵。
2. OpenViking 有周度安全扫描、Dependabot、Issue/PR 模板等协作治理基础设施。
3. OpenViking 的测试文档按模块拆分清晰，测试场景可直接复现。
4. OpenViking 的 doctor 输出是“检查项 + 修复建议”模式，故障定位路径短。
5. rex-ai-boot 当前 workflow 偏发布/文档与 Windows smoke，缺少 main 分支常规 CI 质量门。

## 优化建议（P0/P1/P2）

### P0（本周可落地，高收益）

1. 增加 main 分支 CI 质量门（Linux 先行）
   - 触发：`push/pull_request` 到 `main`
   - 最小检查：`npm run test:scripts` + `cd mcp-server && npm run typecheck && npm run test && npm run build`
   - 目标：把“只在 release/tag 才跑核心检查”前移为“日常提交即拦截”

2. 补齐安全自动化
   - 增加 `CodeQL` workflow（至少 JS/TS）
   - 增加周度 schedule 运行安全扫描
   - 增加 `dependabot.yml`（github-actions + npm）

3. 补齐协作模板
   - 增加 `.github/ISSUE_TEMPLATE/*` 与 `.github/PULL_REQUEST_TEMPLATE.md`
   - 在 PR 模板中强制勾选：验证命令、跨平台验证、文档同步

### P1（1-2 周，稳定性提升）

1. 建立测试文档总览
   - 增加 `scripts/tests/README.md` 或仓库级 `tests/README.md`
   - 说明每类测试的目标、命令、故障排查入口

2. 将 AGENTS 测试说明与现状对齐
   - 当前说明“无自动化测试套件”与实际存在 `test:scripts`、`mcp-server test` 不一致
   - 更新后可减少误导与人工回归成本

3. Doctor 输出增强（不改行为先改可观测）
   - 给 `aios doctor` 增加“检查项 -> 状态 -> 修复建议”统一格式
   - 聚焦 Node 版本、native addon、shell wrapper、skills sync、workflow 入口可用性

### P2（后续迭代）

1. 增加跨平台矩阵（Windows/macOS）到核心 CI
2. 增加性能基准 smoke（例如 orchestrate/learn-eval 的耗时阈值报警）
3. 增加官方 examples 目录（最小可运行案例），降低新用户上手摩擦

## 建议执行顺序

1. P0-1：先建 main CI 质量门（最小闭环）
2. P0-2：并行补 CodeQL + Dependabot
3. P0-3：补 Issue/PR 模板
4. P1-1/P1-2：整理测试文档并修订 AGENTS
5. P1-3：增强 doctor 输出

---

## OpenViking 仓库更新后（二次检查）可优化点

更新时间：`git pull --ff-only` 后（结果：`Already up to date`）

### A. CI 质量门完整性（优先）

1. 恢复 full test，而不是长期停留在 lite 替代
   - 现状：`_test_full.yml` 仍注明 TODO，实际只跑 `test_quick_start_lite.py`
   - 影响：主分支“full checks”名义与实际覆盖不一致

2. PR 阶段测试基线偏窄
   - 现状：`pr.yml` 只调用 `test-lite` 且固定 `ubuntu + py3.10`
   - 影响：跨平台/多版本回归只能在更晚阶段暴露

### B. Workflow 安全基线（优先）

1. 第三方 Action 未固定 commit SHA
   - 现状：`pr-review.yml` 使用 `qodo-ai/pr-agent@main` 且携带 secrets
   - 风险：供应链变更不可控

2. PR Review job 权限可进一步最小化
   - 现状：`contents: write`、`pull-requests: write`、`issues: write`
   - 建议：按实际行为收敛权限，默认只给必需范围

### C. Lint 稳定性与门禁强度（中优）

1. changed-files 依赖 `github.base_ref`，手动触发场景不稳
   - 现状：`_lint.yml` 直接用 `origin/${{ github.base_ref }}` 做 diff
   - 风险：`workflow_dispatch` 时可能空值，导致结果不稳定

2. mypy 失败不阻断
   - 现状：`continue-on-error: true`
   - 影响：类型问题可能持续累积

### D. 产品能力“占位实现”治理（中优）

1. 音视频解析路径存在明确占位 TODO
   - `video.py` 仍返回 placeholder 描述
   - `audio.py` 对接为 OpenAI 转写路径，注释仍标注“待真实 ASR 集成”

2. 配置项存在“声明但未生效”
   - `parser_config.py` 中 `download_images`、`request_timeout` 明确标注暂未实现/未透传
   - 建议：为这些字段补状态标识、兼容策略或禁用入口，避免误解
