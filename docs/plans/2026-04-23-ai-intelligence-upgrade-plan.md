# AIOS AI智力升级计划

**日期**: 2026-04-23
**来源**: 分析 Auto-Redbook-Skills + baoyu-skills 参考项目
**目标**: 为AIOS添加核心AI智力能力

---

## 背景

通过深入分析两个参考项目的最新代码：
- **Auto-Redbook-Skills**: 8套主题皮肤、4种智能分页模式、封面正文一体化渲染、智能Cookie验证
- **baoyu-skills**: 12种风格×8种布局×3种配色、内容分析框架、三种策略变体、图片锚定链、智能确认工作流、EXTEND.md偏好配置

识别出5个高价值可落地的AI智力功能点。

---

## 功能点清单

### 1. 智能内容分析引擎 (高优先级)
**来源**: baoyu-skills analysis-framework
**价值**: 让AI在生成内容前先"读懂"内容，做出智能决策

- 内容类型识别（情感/干货/教程/故事）
- Hook潜力评估（吸引力评分）
- 受众匹配分析（目标用户画像）
- 视觉机会地图（哪些点适合配图）
- 互动潜力预测（评论/分享可能性）
- 输出结构化 analysis.md

### 2. 内容策略自动选择系统 (高优先级)
**来源**: baoyu-skills 三种策略变体 + Auto-Redbook 主题系统
**价值**: AI根据内容自动选择最优表达策略

- 策略A — 故事驱动: Hook→Problem→Discovery→Experience→Conclusion
- 策略B — 信息密集: Core conclusion→Info card→Pros/Cons→Recommendation
- 策略C — 视觉优先: Hero image→Detail shots→Lifestyle scene→CTA
- 自动选择算法：基于关键词信号匹配
- 风格×布局兼容性矩阵
- 25+预设组合（知识卡、清单、教程、海报等）

### 3. 智能配图生成工作流 (高优先级)
**来源**: baoyu-skills xhs-images + imagine + Auto-Redbook 渲染引擎
**价值**: 升级现有配图能力，增加一致性和效率

- 图片1锚定链：封面作为视觉锚点，后续图以封面为参考
- 批量并行生成策略
- 提示词文件优先（可重现性记录）
- 风格×布局×配色三维选择系统
- 升级配色系统：macaron/warm/neon + 主题默认色
- 增加预设系统（知识卡、清单、教程等）

### 4. 智能发布工作流 (中优先级)
**来源**: Auto-Redbook publish_xhs.py + baoyu 确认策略
**价值**: 发布更智能、更安全、更可靠

- Cookie验证和错误诊断（签名错误、过期等）
- 发布前检查清单
- 定时发布支持
- 仅自己可见/公开发布选项
- 自动重试机制（最多3次）
- Dry-run验证模式

### 5. 用户偏好配置系统 (中优先级)
**来源**: baoyu-skills EXTEND.md
**价值**: 持久化用户偏好，减少重复确认

- 风格/布局/配色/语言偏好
- 水印配置
- 默认后端选择
- 三级配置：项目级 > XDG级 > 用户级
- 首次使用引导

---

## 实施顺序

1. 功能1: 智能内容分析引擎 → commit
2. 功能2: 内容策略自动选择系统 → commit
3. 功能3: 智能配图生成工作流 → commit
4. 功能4: 智能发布工作流 → commit
5. 功能5: 用户偏好配置系统 → commit
6. 更新官方文档 → commit

---

## 文件变更清单

### 新增文件
- `memory/skills/智能内容分析.json`
- `memory/skills/内容策略选择.json`
- `memory/skills/智能发布工作流.json`
- `config/extend-preferences.json`
- `docs/plans/2026-04-23-ai-intelligence-upgrade-plan.md`

### 修改文件
- `memory/skills/生成小红书配图.json` → 大幅升级
- `memory/skills/publish笔记.json` → 升级为智能发布
- `docs/plans/2026-03-01-xiaohongshu-assistant-design.md` → 更新后续迭代

---

## 成功标准

- [x] 所有5个功能点的skill文件创建/更新完成
- [x] 每个功能点有清晰的工作流程和示例
- [x] 功能之间可以协同工作（分析→策略→配图→发布）
- [x] 官方文档更新
- [x] 每个关键节点有commit记录
