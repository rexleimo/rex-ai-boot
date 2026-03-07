# 混合布局快照设计文档

**日期**: 2026-03-07

**目标**: 将浏览器自动化从“整页截图驱动 LLM”切换为“布局图谱驱动 LLM + 局部截图兜底”，在保留页面结构感的同时显著降低 token 消耗。

## 背景

当前 `browser_screenshot` 会返回整张页面截图的 base64，适合视觉兜底，但对 LLM 来说成本极高。

当前 `browser_snapshot` 虽然比截图更轻，但主要返回截断后的整段 HTML。对于大量不固定网站，这种表示仍然存在两个问题：

- HTML 体积大，token 成本仍高；
- LLM 很难仅靠 HTML 理解“按钮在右上角”“弹窗覆盖在中间”“左侧是导航栏”这类布局语义。

本次设计的目标不是完全取消视觉能力，而是把“整页视觉输入”降级成异常路径，把默认输入换成更适合推理的结构化布局表示。

## 设计原则

- **布局优先**：先返回页面结构、区域、元素和相对位置，不默认返回整页图像。
- **视觉降级**：只有在视觉歧义、纯图形组件或覆盖层场景下，才补局部截图。
- **跨站通用**：不依赖站点专属 selector，优先使用通用 DOM 语义和可见元素特征。
- **安全收口**：挑战页、验证码、风控页不走绕过路径，而是显式返回人工接管或 API 优先信号。
- **最小改动**：不引入新依赖，不重构现有动作模型，优先增强 `browser_snapshot` / `browser_screenshot`。

## 方案概览

### 1. `browser_snapshot` 输出混合布局快照

`browser_snapshot` 不再以整段 HTML 为主，而是返回以下结构：

- `pageSummary`
  - `title`
  - `url`
  - `pageType`
  - `viewport`
  - `auth`
  - `challenge`
- `regions`
  - `header`
  - `main`
  - `left-sidebar`
  - `right-sidebar`
  - `modal`
  - `footer`
- `elements`
  - 仅保留高价值、可见、可交互元素
  - 字段包含 `role`、`text`、`selectorHint`、`bbox`、`region`、`clickable`
- `textBlocks`
  - 页面主要可见文本块，用于帮助模型理解当前语境
- `visualHints`
  - `hasModal`
  - `hasCanvas`
  - `hasLargeMedia`
  - `needsVisualFallback`
  - `reason`

同时保留一个极小的 `htmlPreview`/兼容字段，用于调试和回退，而不是继续返回大段 HTML。

### 2. `browser_screenshot` 支持局部截图

为 `browser_screenshot` 增加可选 `selector` 参数：

- 传 `selector` 时，仅截图该元素；
- 不传时，保持现有页面级截图能力；
- 截图仍保存到文件或返回 base64，但推荐只用于局部视觉确认，而不是主决策输入。

### 3. 推荐推理流程

默认流程：

1. `browser_navigate`
2. `browser_snapshot`
3. LLM 基于 `regions + elements + textBlocks` 做动作决策
4. 仅在 `visualHints.needsVisualFallback === true` 或决策置信度低时再调用 `browser_screenshot({ selector })`

### 4. 挑战页和风控页处理

本次不提供任何绕过 CAPTCHA / Cloudflare / Google 风控的设计。

若 `challenge.recommendedPath` 为：

- `manual-handoff`：提示人工接管
- `api-preferred`：提示官方 API / OAuth 路径

LLM 不应在该状态下继续盲点页面元素。

## 页面布局抽取策略

布局抽取基于浏览器内 `page.evaluate()`：

- 只收集视口内或接近视口的元素；
- 使用 `getBoundingClientRect()` 提取 `x/y/width/height`；
- 基于标签、ARIA role、文本、placeholder、aria-label 生成语义；
- 使用简单启发式规则划分区域：顶部固定区、左右侧栏、中心弹窗、底部区、主内容区；
- 限制元素数量，避免向 LLM 暴露过多噪音。

该方案不要求 selector 完全稳定；`selectorHint` 只用于辅助理解和调试，真正的精确点击仍可由后续策略补充。

## 成功标准

- 默认 `browser_snapshot` 输出不再包含大段 HTML；
- 返回的结构化布局足以让 LLM 理解常见社媒/内容站点页面结构；
- `browser_screenshot` 可按 selector 截取局部区域；
- challenge/auth 输出保持兼容；
- 有单元测试覆盖布局摘要和截图参数分流。

## 非目标

- 不做站点专属 selector 学习；
- 不做 OCR / CV 模型集成；
- 不实现验证码破解或挑战页绕过；
- 不引入复杂状态机或外部存储。
