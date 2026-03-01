// mcp-server/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { tools as playwrightTools, browserLauncher, navigate, click, type, snapshot, screenshot } from './browser/index.js';

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
    const { profile = 'default', url } = args;
    const state = await browserLauncher.launch(profile, url);
    return { success: true, profile };
  },
  browser_navigate: async (args) => {
    return await navigate(args.url, args.profile);
  },
  browser_click: async (args) => {
    return await click(args.selector, args.profile, args.double);
  },
  browser_type: async (args) => {
    return await type(args.selector, args.text, args.profile);
  },
  browser_snapshot: async (args) => {
    return await snapshot(args.profile);
  },
  browser_screenshot: async (args) => {
    return await screenshot(args.fullPage, args.profile);
  },
  browser_close: async (args) => {
    const profile = args.profile || 'default';
    await browserLauncher.close(profile);
    return { success: true, profile };
  },
  browser_list_tabs: async (args) => {
    const state = browserLauncher.getState(args.profile || 'default');
    if (!state) {
      return { tabs: [], profile: args.profile || 'default' };
    }
    const tabs = Array.from(state.pages.entries()).map(([id, page]) => ({
      id,
      url: page.url(),
      title: page.title(),
    }));
    return { tabs, profile: args.profile || 'default' };
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
