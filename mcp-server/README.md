# Puppeteer Stealth MCP Server

反检测浏览器自动化 MCP 服务器，使用 puppeteer-extra + stealth 插件。

## 快速开始

### 1. 安装依赖

```bash
cd mcp-server
npm install
```

### 2. 编译 TypeScript

```bash
npm run build
```

### 3. 配置 Claude Code

在 `.claude/settings.local.json` 中添加：

```json
{
  "mcpServers": {
    "puppeteer-stealth": {
      "command": "node",
      "args": ["/path/to/mcp-server/dist/index.js"]
    }
  }
}
```

### 4. 重启 Claude Code

重启后即可使用以下工具：

| 工具 | 功能 |
|------|------|
| `stealth_navigate` | 打开 URL |
| `stealth_click` | 点击元素 |
| `stealth_fill` | 填写输入框 |
| `stealth_type` | 打字输入 |
| `stealth_screenshot` | 截图 |
| `stealth_snapshot` | 获取页面快照 |
| `stealth_evaluate` | 执行 JS |
| `stealth_wait_for` | 等待元素 |
| `stealth_scroll` | 滚动页面 |
| `stealth_mouse_move` | 鼠标移动 |
| `stealth_new_tab` | 新建标签页 |
| `stealth_switch_tab` | 切换标签页 |
| `stealth_close_tab` | 关闭标签页 |
| `stealth_list_tabs` | 列出标签页 |
| `stealth_close_browser` | 关闭浏览器 |

## 反检测特性

- `puppeteer-extra-plugin-stealth` 自动隐藏 WebDriver 特征
- `ghost-cursor` 模拟人类鼠标行为
- 随机延迟（1-3秒）模拟人类操作节奏
- 平滑滚动模拟人类浏览行为

## 开发

```bash
# 开发模式（热重载）
npm run dev

# 类型检查
npm run typecheck

# 构建
npm run build
```
