# Puppeteer Stealth MCP 服务器设计

## 背景

当前使用 Chrome DevTools MCP 反检测能力弱，小红书会触发滑动验证和"Chrome 正在受到控制"提示。

目标是构建一个更强的反检测浏览器 MCP 服务。

## 架构

```
用户操作 → Claude Code → Puppeteer Stealth MCP → Chrome（反检测）
                              ↓
                        内存中的 Page 管理
                        (多标签页支持)
```

## 技术栈

| 组件 | 技术 | 版本 |
|------|------|------|
| MCP 框架 | @modelcontextprotocol/server | latest |
| 浏览器 | puppeteer-extra | ^3.x |
| 反检测 | puppeteer-extra-plugin-stealth | ^3.x |
| 鼠标模拟 | ghost-cursor | ^1.x |

## 核心组件

| 组件 | 职责 |
|------|------|
| `Server` | MCP 服务器入口，处理请求和响应 |
| `BrowserManager` | 浏览器生命周期管理（启动、关闭） |
| `PageManager` | 多页面管理（创建、切换、关闭） |
| `StealthPlugin` | 反检测集成（自动启用） |
| `ToolHandlers` | 各种工具的实现 |
| `ErrorHandler` | 智能错误处理和重试 |

## 工具列表

| 工具 | 功能 | 参数 |
|------|------|------|
| `stealth_navigate` | 打开 URL | `url: string` |
| `stealth_click` | 点击元素（带人类轨迹） | `selector: string` |
| `stealth_fill` | 填写输入框 | `selector: string, value: string` |
| `stealth_type` | 打字输入（带随机延迟） | `selector: string, text: string` |
| `stealth_screenshot` | 截图 | `fullPage?: boolean` |
| `stealth_snapshot` | 获取页面快照 | - |
| `stealth_evaluate` | 执行 JS | `script: string` |
| `stealth_wait_for` | 等待元素 | `selector: string, timeout?: number` |
| `stealth_scroll` | 滚动（带人类行为） | `y?: number` |
| `stealth_mouse_move` | 鼠标移动（曲线轨迹） | `x: number, y: number` |
| `stealth_new_tab` | 新建标签页 | `url?: string` |
| `stealth_switch_tab` | 切换标签页 | `target: number | 'previous' | 'next'` |
| `stealth_close_tab` | 关闭标签页 | `pageId?: number` |

## 反检测特性

1. **浏览器指纹隐藏**
   - `navigator.webdriver = false`
   - 随机化的 `navigator.plugins`
   - 完整的 `navigator.languages`
   - `chrome.runtime` 对象模拟

2. **行为模拟**
   - 曲线鼠标移动（贝塞尔曲线 + 随机抖动）
   - 随机延迟（3-15秒非线性分布）
   - 自然滚动（缓动 + 随机反向）
   - 点击位置随机偏移
   - 打字随机延迟

3. **Chrome 启动参数**
   - `--disable-blink-features=AutomationControlled`
   - `--disable-infobars`
   - `--disable-dev-shm-usage`

## 错误处理

- **可重试错误**：元素未找到、页面未加载、网络超时
- **不可重试错误**：权限拒绝、浏览器崩溃、参数错误
- 自动重试次数：3 次

## 验证标准

- [ ] 无 "Chrome 正在受到控制" 提示
- [ ] `navigator.webdriver === undefined`
- [ ] 无滑动验证触发
- [ ] 小红书正常发布内容
