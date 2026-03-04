# X.com 运营计划（openclaw / openfang 风格）

日期：2026-03-04  
目标：用“可验证的交付结果”持续获取开发者关注与试用转化。

## 核心定位

- 反空话：不讲“AI 很强”，只讲“今天修了什么、怎么复现、怎么验证”。
- 跨客户端能力层：Codex / Claude Code / Gemini / OpenCode 一次建设，多端复用。
- 可靠性优先：Windows 友好、可诊断、可回滚、可版本化。

## 7 天发布节奏

1. Day 1：主宣发帖（问题-方案-价值-CTA）
2. Day 2：Windows 修复证明帖（前后对比 + 复测命令）
3. Day 3：多客户端一致能力帖（减少上下文切换成本）
4. Day 4：工程理念帖（稳定性 > 花哨 Demo）
5. Day 5：Pilot 招募帖（5 支团队）
6. Day 6：转发用户反馈/截图（社会证明）
7. Day 7：Weekly Build Log（本周交付 + 下周路线）

## Day 1 首帖文案（英文）

```text
Most AI agent stacks look great in demos, then break in setup.

We built rex-ai-boot to make real workflows stable across:
Codex + Claude Code + Gemini CLI + OpenCode

One capability layer.
Local-first.
Windows included.

Repo: <your-link>
#opensource #aiagents #devtools
```

## Day 1 发布动作清单

1. 主帖发布时间：北京时间 21:00-23:00（覆盖美区上午时段）。
2. 发布后 2 分钟内追加首条评论：
   - 内容：`Windows users: pull latest and run scripts/doctor-browser-mcp.ps1`
3. 置顶到主页（至少保留 72 小时）。
4. 转发到你已有社区入口（Discord/微信群/开发者群）并附一句“已支持 Windows 修复路径”。
5. 24 小时内回复所有技术问题，回复格式固定：问题 -> 命令 -> 结果。

## Day 1 配图方向（即梦）

- 方向 A（推荐）：终端实拍风 + 结果对比
- 方向 B：四客户端能力层架构图（工具 logo + 能力中台）

### 即梦提示词（方向 A）

```text
Create a high-contrast developer marketing image for X.com.
Scene: split-screen terminal comparison.
Left side shows red failed setup logs on Windows PowerShell.
Right side shows green successful doctor check output.
Center headline text: "From Setup Chaos to Reliable Agent Ops".
Subtext: "Codex + Claude Code + Gemini + OpenCode".
Style: cinematic, sharp, technical, trustworthy, minimal clutter.
Color palette: dark graphite background, red error accents, green success accents, cyan highlight.
Composition: 16:9, strong center focus, readable typography, no watermark.
```

### 即梦提示词（方向 B）

```text
Design a bold technical infographic for X.com about AI coding workflow reliability.
Main title: "One Capability Layer, Four AI Clients".
Show four nodes: Codex, Claude Code, Gemini CLI, OpenCode.
All connect to a central layer named "rex-ai-boot".
Below central layer show features: "doctor", "security check", "skills sync", "versioned release".
Visual style: modern developer tooling, clean geometry, high readability, no cartoon.
Palette: deep navy, electric cyan, white text, orange accent.
Layout: 16:9, social media friendly, high contrast, no watermark.
```

## 成功判定（Day 1）

- 24 小时目标：曝光 > 2,000，互动率 > 2.5%，至少 3 条技术向回复。
- 如果低于目标：Day 2 改成“问题截图 + 修复命令 + 结果截图”的证据流内容。
