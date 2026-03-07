// mcp-server/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  tools as playwrightTools,
  browserLauncher,
  navigate,
  click,
  type,
  snapshot,
  screenshot,
  authCheck,
  challengeCheck,
} from './browser/index.js';

const server = new Server(
  {
    name: 'playwright-browser-mcp',
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
      // Playwright 浏览器工具
      ...playwrightTools,
      {
        name: 'browser_close',
        description: 'Close browser',
        inputSchema: {
          type: 'object',
          properties: {
            profile: { type: 'string', default: 'default' },
          },
        },
      },
      {
        name: 'browser_list_tabs',
        description: 'List all tabs',
        inputSchema: {
          type: 'object',
          properties: {
            profile: { type: 'string', default: 'default' },
          },
        },
      },
      // 保留旧版 puppeteer 工具（可选）
    ],
  };
});

// 工具处理器映射
const toolHandlers: Record<string, (args: any) => Promise<any>> = {
  browser_launch: async (args) => {
    const { profile = 'default', url, headless, visible } = args ?? {};
    const state = await browserLauncher.launch(profile, url, headless, visible);
    return {
      success: true,
      profile,
      effectiveProfile: state.effectiveProfile ?? profile,
      headless: state.headless ?? false,
      visible: state.visible ?? true,
      launchMode: state.launchMode ?? 'ephemeral-local',
      connectedOverCdp: state.connectedOverCdp ?? false,
    };
  },
  browser_navigate: async (args) => {
    const { url, profile, newTab } = args ?? {};
    if (!url) throw new Error('browser_navigate requires url');
    return await navigate(url, profile, newTab);
  },
  browser_click: async (args) => {
    const { selector, profile, double } = args ?? {};
    if (!selector) throw new Error('browser_click requires selector');
    return await click(selector, profile, double);
  },
  browser_type: async (args) => {
    const { selector, text, profile } = args ?? {};
    if (!selector) throw new Error('browser_type requires selector');
    if (typeof text !== 'string') throw new Error('browser_type requires text');
    return await type(selector, text, profile);
  },
  browser_snapshot: async (args) => {
    return await snapshot(args?.profile, {
      includeHtml: args?.includeHtml,
      htmlMaxChars: args?.htmlMaxChars,
    });
  },
  browser_auth_check: async (args) => {
    return await authCheck(args?.profile);
  },
  browser_challenge_check: async (args) => {
    return await challengeCheck(args?.profile);
  },
  browser_screenshot: async (args) => {
    const { fullPage, profile, filePath, selector } = args ?? {};
    return await screenshot(fullPage, profile, filePath, selector);
  },
  browser_close: async (args) => {
    const profile = args?.profile || 'default';
    await browserLauncher.close(profile);
    return { success: true, profile };
  },
  browser_list_tabs: async (args) => {
    const profile = args?.profile || 'default';
    const state = browserLauncher.getState(profile);
    if (!state) {
      return { tabs: [], profile };
    }
    const tabs = await Promise.all(
      Array.from(state.pages.entries()).map(async ([id, page]) => ({
        id,
        url: page.url(),
        title: await page.title(),
      }))
    );
    return { tabs, profile };
  },
};

// 处理工具调用
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    const tool = toolHandlers[name];
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
  console.error('Playwright Browser MCP Server running on stdio');
}

main().catch(console.error);
