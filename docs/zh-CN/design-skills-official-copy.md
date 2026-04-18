# 无设计稿 UI 官方文案包

更新时间：2026-04-18

## 1) 对外一句话（官网/落地页）

`没有设计稿，也能做出好看的界面：先用 DESIGN.md 锁定风格，再用 frontend-design 落地页面实现。`

## 2) 产品功能说明（中短版）

`这套流程为“无设计稿”场景设计。先自动生成 DESIGN.md 作为风格约束，再让 coding agent 按约束实现页面，减少模板化输出，提升一致性与美观度。`

## 3) Onboarding 引导文案（可直接放产品内）

1. 在项目根目录安装技能：

```bash
node <AIOS_ROOT>/scripts/aios.mjs setup --components skills --client codex --scope project --skills awesome-design-md,frontend-design
```

2. 生成一个 `DESIGN.md` 风格基线：

```bash
npx --yes getdesign@latest list
npx --yes getdesign@latest add linear --force
```

3. 发送这条固定提示词：

```text
先按 DESIGN.md 定风格，再用 frontend-design 落地实现页面。
```

## 3.1) 模糊提示词也可用（重点）

即使用户只给模糊指令，系统也会自动收敛为可执行任务并保证 UI/UX 质量。

可直接引导用户这样说：

- 元素微调：
  - `把这个页面的按钮区改得更高级一点，保持现有结构。`
- 风格参考：
  - `参考 Stripe 风格，把当前页面重新设计，但保持功能不变。`
- 完整 SaaS 流程：
  - `做一个完整的 SaaS 后台界面，包含仪表盘、列表、详情、创建、设置流程。`

建议平台内置固定系统提示词：

```text
当用户需求模糊时，请先自动判断是 Patch/Restyle/Flow 三类中的哪一类；基于 DESIGN.md 锁定风格后再实现页面。输出必须包含完整交互状态（hover/focus/active/disabled）以及核心流程的 loading/empty/error/success。
```

## 4) 默认风格推荐（无设计稿时）

- SaaS / B2B：`linear`、`vercel`、`supabase`
- 营销页 / 品牌页：`framer`、`stripe`、`notion`
- 文档站：`mintlify`、`hashicorp`、`mongodb`

## 5) 客服 FAQ 回复模板

Q: 我没有设计稿，能用吗？  
A: 可以。我们就是为“无设计稿”设计的，先自动生成 `DESIGN.md` 风格基线，再由 `frontend-design` 生成页面代码。

Q: 我不会设计，应该怎么选？  
A: 建议先用默认风格起步：SaaS 用 `linear`，营销页用 `framer`，文档站用 `mintlify`。跑通后再微调。

Q: 这会不会还是 AI 模板风？  
A: 先锁定 `DESIGN.md` 再实现，能明显减少模板化输出，页面风格会更统一且更有辨识度。

## 6) 成功标准（给运营/产品）

- 首屏视觉风格稳定，不再随机漂移
- 按钮、间距、字体层级一致
- 设计返工次数下降
- 用户对“美观/专业感”主观评价提升
