// mcp-server/src/browser/index.ts
import { profileManager } from './profiles.js';
import { browserLauncher } from './launcher.js';
import { navigate } from './actions/navigate.js';
import { click } from './actions/click.js';
import { type } from './actions/type.js';
import { snapshot } from './actions/snapshot.js';
import { screenshot } from './actions/screenshot.js';
import { authCheck } from './actions/auth-check.js';
import { challengeCheck } from './actions/challenge-check.js';

export {
  profileManager,
  browserLauncher,
  navigate,
  click,
  type,
  snapshot,
  screenshot,
  authCheck,
  challengeCheck,
};

// MCP 工具定义
export const tools = [
  {
    name: 'browser_launch',
    description: 'Launch browser. Defaults to a visible (headful) browser window unless headless mode is explicitly requested.',
    inputSchema: {
      type: 'object',
      properties: {
        profile: { type: 'string', default: 'default' },
        url: { type: 'string' },
        headless: { type: 'boolean' },
        visible: { type: 'boolean', default: true },
      },
    },
  },
  {
    name: 'browser_navigate',
    description: 'Navigate to URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        profile: { type: 'string', default: 'default' },
        newTab: { type: 'boolean', default: false },
      },
    },
  },
  {
    name: 'browser_click',
    description: 'Click element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        profile: { type: 'string', default: 'default' },
        double: { type: 'boolean', default: false },
      },
    },
  },
  {
    name: 'browser_type',
    description: 'Type text into element',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
        text: { type: 'string' },
        profile: { type: 'string', default: 'default' },
      },
    },
  },
  {
    name: 'browser_snapshot',
    description: 'Get page snapshot',
    inputSchema: {
      type: 'object',
      properties: {
        profile: { type: 'string', default: 'default' },
        includeHtml: { type: 'boolean', default: false },
        htmlMaxChars: { type: 'number', default: 1500 },
      },
    },
  },
  {
    name: 'browser_auth_check',
    description: 'Check whether current page likely requires manual login',
    inputSchema: {
      type: 'object',
      properties: {
        profile: { type: 'string', default: 'default' },
      },
    },
  },
  {
    name: 'browser_challenge_check',
    description: 'Check whether current page is blocked by anti-bot challenge (Cloudflare/Google/captcha)',
    inputSchema: {
      type: 'object',
      properties: {
        profile: { type: 'string', default: 'default' },
      },
    },
  },
  {
    name: 'browser_screenshot',
    description: 'Take screenshot',
    inputSchema: {
      type: 'object',
      properties: {
        fullPage: { type: 'boolean', default: false },
        profile: { type: 'string', default: 'default' },
        filePath: { type: 'string' },
        selector: { type: 'string' },
      },
    },
  },
];
