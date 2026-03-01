# 浏览器控制模块设计文档

**日期**: 2026-03-01

**目标**: 参照 OpenClaw 实现基于 Playwright 的浏览器控制 MCP，支持反检测和多人浏览 Profile

## 架构概述

```
Claude Code → MCP Server → Playwright → Chrome/Brave/Edge/Chromium
                                            ↓
                                      本地控制服务
```

## 核心技术选型

| 组件 | 选择 | 说明 |
|------|------|------|
| 浏览器驱动 | Playwright | 与 OpenClaw 相同，更成熟的反检测能力 |
| MCP 协议 | 复用现有 mcp-server | 通过 MCP 暴露浏览器工具 |
| 浏览器来源 | 系统浏览器自动检测 | Chrome → Brave → Edge → Chromium |
| Profile | 多 Profile 支持 | 独立的 user data dir 实现隔离 |

## 目录结构

```
mcp-server/
├── src/
│   ├── browser/
│   │   ├── index.ts          # 入口，导出所有工具
│   │   ├── launcher.ts       # 浏览器启动逻辑
│   │   ├── profiles.ts       # Profile 管理
│   │   ├── controller.ts     # 控制服务
│   │   └── actions/         # 浏览器操作
│   │       ├── navigate.ts
│   │       ├── click.ts
│   │       ├── type.ts
│   │       ├── snapshot.ts
│   │       └── screenshot.ts
│   └── index.ts              # MCP server 入口
├── config/
│   └── browser-profiles.json # Profile 配置
└── package.json
```

## MCP 工具接口

### 基础操作

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `browser_launch` | profile?: string | 启动浏览器，可指定 Profile |
| `browser_navigate` | url: string, profile?: string | 导航到 URL |
| `browser_click` | selector: string, profile?: string | 点击元素 |
| `browser_type` | selector: string, text: string, profile?: string | 输入文本 |
| `browser_snapshot` | profile?: string | 获取 ARIA 快照 |
| `browser_screenshot` | fullPage?: boolean, profile?: string | 截图 |
| `browser_close` | profile?: string | 关闭浏览器 |

### Profile 管理

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `browser_profile_create` | name: string, options?: ProfileOptions | 创建新 Profile |
| `browser_profile_list` | - | 列出所有 Profile |
| `browser_profile_delete` | name: string | 删除 Profile |

### 进阶操作

| 工具名 | 参数 | 说明 |
|--------|------|------|
| `browser_tabs` | profile?: string | 列出所有标签页 |
| `browser_tab_new` | url?: string, profile?: string | 新建标签页 |
| `browser_tab_close` | tabId: string, profile?: string | 关闭标签页 |
| `browser_scroll` | y: number, profile?: string | 滚动页面 |
| `browser_evaluate` | script: string, profile?: string | 执行 JavaScript |

## Profile 配置

每个 Profile 独立配置：

```json
{
  "profiles": {
    "aios": {
      "cdpPort": 18800,
      "color": "#FF4500",
      "executablePath": null
    },
    "work": {
      "cdpPort": 18801,
      "color": "#0066CC"
    },
    "remote": {
      "cdpUrl": "http://10.0.0.42:9222"
    }
  }
}
```

## 反检测策略

### 1. 浏览器启动参数

```typescript
const stealthArgs = [
  '--disable-blink-features=AutomationControlled',
  '--disable-dev-shm-usage',
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-infobars',
  '--disable-browser-side-navigation',
  '--disable-web-security',
  '--disable-features=VizDisplayCompositor',
  '--ignore-certificate-errors',
  '--disable-extensions',
  '--disable-plugins',
  '--disable-default-apps',
  '--disable-background-networking',
  '--disable-sync',
  '--metrics-recording-only',
  '--mute-audio',
  '--no-first-run',
  '--safebrowsing-disable-auto-update',
];
```

### 2. 页面注入脚本

```javascript
// 在页面加载前注入
Object.defineProperty(navigator, 'webdriver', { get: () => false });
Object.defineProperty(navigator, 'plugins', { get: () => [1,2,3,4,5] });
Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
window.chrome = { runtime: {} };
```

### 3. 行为模拟

- **随机延迟**: 操作间随机等待 100-500ms
- **鼠标轨迹**: 使用 ghost-cursor 生成自然轨迹
- **滚动行为**: 平滑滚动，带随机停顿

## 本地控制服务

提供 HTTP API（可选）：

```
GET  /browser/status          # 状态
POST /browser/start          # 启动
POST /browser/stop           # 停止
GET  /browser/tabs           # 标签页列表
POST /browser/navigate       # 导航
POST /browser/act            # 执行操作
GET  /browser/snapshot       # 快照
GET  /browser/screenshot     # 截图
```

## 部署方式

- 作为独立 MCP Server 运行
- 通过 stdio 与 Claude Code 通信
- 可选：提供 HTTP API 供外部调用

## 实现阶段

### Phase 1: 核心功能
- [ ] Playwright 集成
- [ ] 浏览器启动/关闭
- [ ] 基础操作 (navigate, click, type, snapshot, screenshot)
- [ ] 单 Profile 支持

### Phase 2: 多 Profile
- [ ] Profile 管理
- [ ] 多浏览器实例
- [ ] Profile 隔离

### Phase 3: 进阶功能
- [ ] HTTP 控制 API
- [ ] 远程 CDP 支持
- [ ] 反检测增强
