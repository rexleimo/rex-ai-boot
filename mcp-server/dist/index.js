// mcp-server/src/index.ts
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import { tools } from './tools.js';
const server = new Server({
    name: 'puppeteer-stealth-mcp',
    version: '1.0.0',
}, {
    capabilities: {
        tools: {},
    },
});
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
        const tool = tools[name];
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
    }
    catch (error) {
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
//# sourceMappingURL=index.js.map