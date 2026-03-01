# Puppeteer Stealth MCP 服务器实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建一个使用 puppeteer-extra + stealth 插件的反检测浏览器 MCP 服务器，替换现有的 chrome-devtools MCP。

**Architecture:** 使用 @modelcontextprotocol/server 构建 MCP 服务器，集成 puppeteer-extra-plugin-stealth 实现反检测，使用 ghost-cursor 模拟人类鼠标行为。支持多标签页管理。

**Tech Stack:** TypeScript, @modelcontextprotocol/server, puppeteer-extra, puppeteer-extra-plugin-stealth, ghost-cursor, zod

---

### Task 1: 创建 MCP 服务器项目结构

**Files:**
- Create: `mcp-server/package.json`
- Create: `mcp-server/tsconfig.json`
- Create: `mcp-server/src/index.ts`
- Create: `mcp-server/src/tools.ts`
- Create: `mcp-server/src/browser.ts`

**Step 1: 创建项目目录和 package.json**

```bash
mkdir -p mcp-server/src
cd mcp-server
cat > package.json << 'EOF'
{
  "name": "puppeteer-stealth-mcp",
  "version": "1.0.0",
  "type": "module",
  "description": "Puppeteer Stealth MCP Server for anti-detection browser automation",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@modelcontextprotocol/server": "^1.0.0",
    "@modelcontextprotocol/sdk": "^1.0.0",
    "puppeteer-extra": "^3.3.6",
    "puppeteer-extra-plugin-stealth": "^2.11.2",
    "ghost-cursor": "^1.5.3",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
EOF
```

**Step 2: 创建 tsconfig.json**

```bash
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
```

**Step 3: Commit**

```bash
git add mcp-server/package.json mcp-server/tsconfig.json
git commit -m "feat: create MCP server project structure"
```

---

### Task 2: 安装依赖

**Files:**
- Modify: `mcp-server/package.json`

**Step 1: 安装 npm 依赖**

```bash
cd mcp-server
npm install
```

**Step 2: Commit**

```bash
git add mcp-server/package-lock.json
git commit -m "chore: install MCP server dependencies"
```

---

### Task 3: 实现浏览器管理器

**Files:**
- Create: `mcp-server/src/browser.ts`

**Step 1: 编写浏览器管理器代码**

```typescript
// mcp-server/src/browser.ts
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createCursor, Cursor } from 'ghost-cursor';
import { Page } from 'puppeteer';

// 启用反检测插件
puppeteer.use(StealthPlugin());

export interface BrowserState {
  browser: puppeteer.Browser | null;
  pages: Map<number, Page>;
  cursors: Map<number, Cursor>;
  activePageId: number | null;
}

const state: BrowserState = {
  browser: null,
  pages: new Map(),
  cursors: new Map(),
  activePageId: null,
};

let pageIdCounter = 0;

export async function launchBrowser(): Promise<puppeteer.Browser> {
  if (state.browser) {
    return state.browser;
  }

  state.browser = await puppeteer.launch({
    headless: false,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    defaultViewport: { width: 1280, height: 800 },
  });

  return state.browser;
}

export async function createNewPage(url?: string): Promise<{ pageId: number; page: Page }> {
  const browser = await launchBrowser();
  const page = await browser.newPage();

  const pageId = ++pageIdCounter;
  state.pages.set(pageId, page);

  // 为页面创建 cursor
  const cursor = await createCursor(page);
  state.cursors.set(pageId, cursor);

  state.activePageId = pageId;

  if (url) {
    await page.goto(url, { waitUntil: 'networkidle2' });
  }

  return { pageId, page };
}

export function getActivePage(): Page | null {
  if (state.activePageId === null) return null;
  return state.pages.get(state.activePageId) || null;
}

export function getPage(pageId: number): Page | null {
  return state.pages.get(pageId) || null;
}

export function getCursor(pageId: number): Cursor | null {
  return state.cursors.get(pageId) || null;
}

export function setActivePage(pageId: number): boolean {
  if (!state.pages.has(pageId)) return false;
  state.activePageId = pageId;
  return true;
}

export async function closePage(pageId: number): Promise<boolean> {
  const page = state.pages.get(pageId);
  if (!page) return false;

  await page.close();
  state.pages.delete(pageId);
  state.cursors.delete(pageId);

  if (state.activePageId === pageId) {
    const remainingIds = Array.from(state.pages.keys());
    state.activePageId = remainingIds.length > 0 ? remainingIds[remainingIds.length - 1] : null;
  }

  return true;
}

export async function closeBrowser(): Promise<void> {
  if (state.browser) {
    await state.browser.close();
    state.browser = null;
    state.pages.clear();
    state.cursors.clear();
    state.activePageId = null;
  }
}

export function getPageList(): Array<{ id: number; url: string; title: string }> {
  const list: Array<{ id: number; url: string; title: string }> = [];
  for (const [id, page] of state.pages) {
    try {
      list.push({
        id,
        url: page.url(),
        title: page.title(),
      });
    } catch {
      // 页面可能已关闭
    }
  }
  return list;
}
```

**Step 2: Commit**

```bash
git add mcp-server/src/browser.ts
git commit -feat: implement browser manager with stealth and ghost-cursor
```

---

### Task 4: 实现 MCP 工具

**Files:**
- Create: `mcp-server/src/tools.ts`

**Step 1: 编写工具实现**

```typescript
// mcp-server/src/tools.ts
import { z } from 'zod';
import { getActivePage, getPage, getCursor, createNewPage, closePage, setActivePage, getPageList, closeBrowser } from './browser.js';

// 工具输入验证 schema
export const navigateSchema = z.object({
  url: z.string(),
  pageId: z.number().optional(),
});

export const clickSchema = z.object({
  selector: z.string(),
  pageId: z.number().optional(),
});

export const fillSchema = z.object({
  selector: z.string(),
  value: z.string(),
  pageId: z.number().optional(),
});

export const typeSchema = z.object({
  selector: z.string(),
  text: z.string(),
  pageId: z.number().optional(),
});

export const screenshotSchema = z.object({
  fullPage: z.boolean().optional(),
  pageId: z.number().optional(),
});

export const evaluateSchema = z.object({
  script: z.string(),
  pageId: z.number().optional(),
});

export const waitForSchema = z.object({
  selector: z.string(),
  timeout: z.number().optional(),
  pageId: z.number().optional(),
});

export const scrollSchema = z.object({
  y: z.number().optional(),
  pageId: z.number().optional(),
});

export const mouseMoveSchema = z.object({
  x: z.number(),
  y: z.number(),
  pageId: z.number().optional(),
});

export const newTabSchema = z.object({
  url: z.string().optional(),
});

export const switchTabSchema = z.object({
  target: z.union([z.number(), z.enum(['previous', 'next'])]),
});

export const closeTabSchema = z.object({
  pageId: z.number().optional(),
});

// 辅助函数：获取页面
function getTargetPage(pageId?: number): ReturnType<typeof getActivePage> {
  if (pageId !== undefined) {
    return getPage(pageId);
  }
  return getActivePage();
}

// 随机延迟
function randomDelay(min = 1000, max = 3000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, Math.random() * (max - min) + min));
}

// 工具实现
export const tools = {
  stealth_navigate: async (input: z.infer<typeof navigateSchema>) => {
    const { url, pageId } = navigateSchema.parse(input);
    const page = getTargetPage(pageId);
    if (!page) throw new Error('No active page');

    await page.goto(url, { waitUntil: 'networkidle2' });
    await randomDelay(1000, 2000);
    return { success: true, url: page.url() };
  },

  stealth_click: async (input: z.infer<typeof clickSchema>) => {
    const { selector, pageId } = clickSchema.parse(input);
    const page = getTargetPage(pageId);
    if (!page) throw new Error('No active page');

    const cursor = pageId ? (await import('./browser.js')).getCursor(pageId) : null;
    if (cursor) {
      await cursor.click(selector);
    } else {
      await page.click(selector);
    }
    await randomDelay(500, 1500);
    return { success: true };
  },

  stealth_fill: async (input: z.infer<typeof fillSchema>) => {
    const { selector, value, pageId } = fillSchema.parse(input);
    const page = getTargetPage(pageId);
    if (!page) throw new Error('No active page');

    await page.click(selector);
    await page.$eval(selector, (el: any) => el.value = '');
    await page.type(selector, value);
    await randomDelay(300, 800);
    return { success: true };
  },

  stealth_type: async (input: z.infer<typeof typeSchema>) => {
    const { selector, text, pageId } = typeSchema.parse(input);
    const page = getTargetPage(pageId);
    if (!page) throw new Error('No active page');

    await page.click(selector);
    for (const char of text) {
      await page.type(selector, char, { delay: 30 + Math.random() * 100 });
      if (Math.random() > 0.9) {
        await randomDelay(200, 500);
      }
    }
    return { success: true };
  },

  stealth_screenshot: async (input: z.infer<typeof screenshotSchema>) => {
    const { fullPage, pageId } = screenshotSchema.parse(input);
    const page = getTargetPage(pageId);
    if (!page) throw new Error('No active page');

    const buffer = await page.screenshot({ fullPage: fullPage ?? false, encoding: 'base64' });
    return { success: true, image: buffer };
  },

  stealth_snapshot: async (input: { pageId?: number }) => {
    const pageId = input?.pageId;
    const page = getTargetPage(pageId);
    if (!page) throw new Error('No active page');

    const content = await page.content();
    const url = page.url();
    const title = await page.title();
    return { success: true, content, url, title };
  },

  stealth_evaluate: async (input: z.infer<typeof evaluateSchema>) => {
    const { script, pageId } = evaluateSchema.parse(input);
    const page = getTargetPage(pageId);
    if (!page) throw new Error('No active page');

    const result = await page.evaluate(script);
    return { success: true, result };
  },

  stealth_wait_for: async (input: z.infer<typeof waitForSchema>) => {
    const { selector, timeout, pageId } = waitForSchema.parse(input);
    const page = getTargetPage(pageId);
    if (!page) throw new Error('No active page');

    await page.waitForSelector(selector, { timeout: timeout ?? 30000 });
    return { success: true };
  },

  stealth_scroll: async (input: z.infer<typeof scrollSchema>) => {
    const { y, pageId } = scrollSchema.parse(input);
    const page = getTargetPage(pageId);
    if (!page) throw new Error('No active page');

    if (y !== undefined) {
      await page.evaluate((scrollY) => {
        window.scrollBy({ top: scrollY, behavior: 'smooth' });
      }, y);
    } else {
      // 随机滚动
      const scrollAmount = Math.random() * 500 + 300;
      await page.evaluate((amount) => {
        window.scrollBy({ top: amount, behavior: 'smooth' });
      }, scrollAmount);
    }
    await randomDelay(500, 1500);
    return { success: true };
  },

  stealth_mouse_move: async (input: z.infer<typeof mouseMoveSchema>) => {
    const { x, y, pageId } = mouseMoveSchema.parse(input);
    const page = getTargetPage(pageId);
    if (!page) throw new Error('No active page');

    const cursor = pageId ? (await import('./browser.js')).getCursor(pageId) : null;
    if (cursor) {
      await cursor.move({ x, y });
    } else {
      await page.mouse.move(x, y);
    }
    return { success: true };
  },

  stealth_new_tab: async (input: z.infer<typeof newTabSchema>) => {
    const { url } = newTabSchema.parse(input);
    const { pageId } = await createNewPage(url);
    return { success: true, pageId };
  },

  stealth_switch_tab: async (input: z.infer<typeof switchTabSchema>) => {
    const { target } = switchTabSchema.parse(input);
    const pages = getPageList();

    if (pages.length === 0) throw new Error('No pages open');

    const currentIndex = pages.findIndex(p => p.id === (await import('./browser.js')).getActivePage() ? (await import('./browser.js')).getActivePage() : null);
    let newIndex: number;

    if (typeof target === 'number') {
      newIndex = pages.findIndex(p => p.id === target);
    } else if (target === 'previous') {
      newIndex = currentIndex > 0 ? currentIndex - 1 : pages.length - 1;
    } else {
      newIndex = currentIndex < pages.length - 1 ? currentIndex + 1 : 0;
    }

    setActivePage(pages[newIndex].id);
    return { success: true, pageId: pages[newIndex].id };
  },

  stealth_close_tab: async (input: z.infer<typeof closeTabSchema>) => {
    const { pageId } = closeTabSchema.parse(input);
    const targetId = pageId ?? (await import('./browser.js')).getActivePage()?.id;
    if (!targetId) throw new Error('No page to close');

    await closePage(targetId);
    return { success: true };
  },

  stealth_list_tabs: async () => {
    const pages = getPageList();
    return { success: true, pages };
  },

  stealth_close_browser: async () => {
    await closeBrowser();
    return { success: true };
  },
};
```

**Step 2: Commit**

```bash
git add mcp-server/src/tools.ts
git commit -feat: implement MCP tools
```

---

### Task 5: 实现 MCP 服务器入口

**Files:**
- Modify: `mcp-server/src/index.ts`

**Step 1: 编写服务器入口**

```typescript
// mcp-server/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { tools } from './tools.js';

const server = new Server(
  {
    name: 'puppeteer-stealth-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'stealth_navigate',
        description: 'Navigate to a URL with stealth mode',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'URL to navigate to' },
            pageId: { type: 'number', description: 'Optional page ID' },
          },
          required: ['url'],
        },
      },
      {
        name: 'stealth_click',
        description: 'Click an element with human-like behavior',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS or XPath selector' },
            pageId: { type: 'number', description: 'Optional page ID' },
          },
          required: ['selector'],
        },
      },
      {
        name: 'stealth_fill',
        description: 'Fill an input field',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS or XPath selector' },
            value: { type: 'string', description: 'Value to fill' },
            pageId: { type: 'number', description: 'Optional page ID' },
          },
          required: ['selector', 'value'],
        },
      },
      {
        name: 'stealth_type',
        description: 'Type text with human-like delays',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS or XPath selector' },
            text: { type: 'string', description: 'Text to type' },
            pageId: { type: 'number', description: 'Optional page ID' },
          },
          required: ['selector', 'text'],
        },
      },
      {
        name: 'stealth_screenshot',
        description: 'Take a screenshot',
        inputSchema: {
          type: 'object',
          properties: {
            fullPage: { type: 'boolean', description: 'Capture full page' },
            pageId: { type: 'number', description: 'Optional page ID' },
          },
        },
      },
      {
        name: 'stealth_snapshot',
        description: 'Get page HTML snapshot',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'number', description: 'Optional page ID' },
          },
        },
      },
      {
        name: 'stealth_evaluate',
        description: 'Evaluate JavaScript in page context',
        inputSchema: {
          type: 'object',
          properties: {
            script: { type: 'string', description: 'JavaScript code' },
            pageId: { type: 'number', description: 'Optional page ID' },
          },
          required: ['script'],
        },
      },
      {
        name: 'stealth_wait_for',
        description: 'Wait for an element to appear',
        inputSchema: {
          type: 'object',
          properties: {
            selector: { type: 'string', description: 'CSS or XPath selector' },
            timeout: { type: 'number', description: 'Timeout in ms' },
            pageId: { type: 'number', description: 'Optional page ID' },
          },
          required: ['selector'],
        },
      },
      {
        name: 'stealth_scroll',
        description: 'Scroll the page with human-like behavior',
        inputSchema: {
          type: 'object',
          properties: {
            y: { type: 'number', description: 'Pixels to scroll' },
            pageId: { type: 'number', description: 'Optional page ID' },
          },
        },
      },
      {
        name: 'stealth_mouse_move',
        description: 'Move mouse with human-like trajectory',
        inputSchema: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X coordinate' },
            y: { type: 'number', description: 'Y coordinate' },
            pageId: { type: 'number', description: 'Optional page ID' },
          },
          required: ['x', 'y'],
        },
      },
      {
        name: 'stealth_new_tab',
        description: 'Create a new browser tab',
        inputSchema: {
          type: 'object',
          properties: {
            url: { type: 'string', description: 'Optional URL to open' },
          },
        },
      },
      {
        name: 'stealth_switch_tab',
        description: 'Switch to another tab',
        inputSchema: {
          type: 'object',
          properties: {
            target: {
              oneOf: [
                { type: 'number' },
                { type: 'string', enum: ['previous', 'next'] }
              ],
              description: 'Page ID or direction'
            },
          },
          required: ['target'],
        },
      },
      {
        name: 'stealth_close_tab',
        description: 'Close a tab',
        inputSchema: {
          type: 'object',
          properties: {
            pageId: { type: 'number', description: 'Page ID to close' },
          },
        },
      },
      {
        name: 'stealth_list_tabs',
        description: 'List all open tabs',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'stealth_close_browser',
        description: 'Close the browser',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const tool = (tools as any)[name];
    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const result = await tool(args);
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
        },
      ],
      isError: true,
    };
  }
});

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Puppeteer Stealth MCP Server running on stdio');
}

main().catch(console.error);
```

**Step 2: 编译 TypeScript**

```bash
cd mcp-server
npm run build
```

**Step 3: Commit**

```bash
git add mcp-server/src/index.ts mcp-server/dist/
git commit -feat: implement MCP server entry point
```

---

### Task 6: 配置 Claude Code MCP

**Files:**
- Modify: `.claude/settings.local.json`

**Step 1: 添加 MCP 配置**

```json
{
  "mcpServers": {
    "puppeteer-stealth": {
      "command": "node",
      "args": ["/Users/molei/codes/aios/mcp-server/dist/index.js"]
    }
  }
}
```

**Step 2: Commit**

```bash
git add .claude/settings.local.json
git commit -feat: configure puppeteer-stealth MCP in Claude Code
```

---

### Task 7: 更新浏览器操作技能

**Files:**
- Modify: `memory/skills/反检测脚本.json`（可能需要更新引用）
- Modify: `memory/skills/人类行为模拟.json`（可能需要更新引用）

**Step 1: 检查现有技能文件**

```bash
ls -la memory/skills/
```

**Step 2: 查看需要更新的技能**

根据现有技能结构，可能需要更新：
- 反检测脚本
- 人类行为模拟

这些技能目前使用 chrome-devtools MCP，实现新 MCP 后需要更新工具名称引用。

**Step 3: Commit**

```bash
git add memory/skills/
git commit -feat: update browser operation skills for new MCP
```

---

## 验证步骤

1. 启动 MCP 服务器：
   ```bash
   cd mcp-server
   node dist/index.js
   ```

2. 使用工具访问小红书：
   - `stealth_navigate` 打开 xiaohongshu.com
   - 验证无 "Chrome 正在受到控制" 提示

3. 检查反检测效果：
   - 执行 `stealth_evaluate` 检查 `navigator.webdriver`

---

**Plan complete and saved to `docs/plans/2026-03-01-puppeteer-stealth-mcp-implementation.md`. Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing_plans, batch execution with checkpoints

**Which approach?**
