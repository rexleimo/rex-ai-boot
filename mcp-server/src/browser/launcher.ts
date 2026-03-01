// mcp-server/src/browser/launcher.ts
import { chromium, type Browser, type BrowserContext } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import type { BrowserProfile, ProfileState } from './types.js';
import { profileManager } from './profiles.js';

// 反检测启动参数
const STEALTH_ARGS = [
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

// 反检测注入脚本
const STEALTH_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', { get: () => false });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en-US', 'en'] });
  window.chrome = { runtime: {} };
`;

export class BrowserLauncher {
  private state: Map<string, ProfileState> = new Map();
  private _pageIdCounter = 0;

  get pageIdCounter(): number {
    return this._pageIdCounter;
  }

  set pageIdCounter(value: number) {
    this._pageIdCounter = value;
  }

  async launch(profileName: string = 'default', url?: string): Promise<ProfileState> {
    if (this.state.has(profileName)) {
      const existing = this.state.get(profileName)!;
      if (existing.browser?.isConnected()) {
        return existing;
      }
    }

    const profile = profileManager.getProfile(profileName) || { name: profileName };
    const profileDir = profileManager.getProfileDir(profileName);

    // 确保 profile 目录存在
    if (!fs.existsSync(profileDir)) {
      fs.mkdirSync(profileDir, { recursive: true });
    }

    // 使用配置的用户数据目录（用于保存登录状态）
    const userDataDir = profile.userDataDir || profileDir;

    // 构建启动选项
    const launchOptions: any = {
      headless: false,
      args: STEALTH_ARGS,
      executablePath: profile.executablePath,
    };

    let browser: Browser;
    let context: BrowserContext;

    // 使用 launchPersistentContext 来支持 userDataDir（持久化登录状态）
    if (userDataDir) {
      context = await chromium.launchPersistentContext(userDataDir, {
        ...launchOptions,
        viewport: { width: 1280, height: 720 },
      });
      browser = context.browser()!;
    } else {
      browser = await chromium.launch(launchOptions);
      context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
      });
    }

    // 注入反检测脚本
    await context.addInitScript(STEALTH_SCRIPT);

    const state: ProfileState = {
      browser,
      context,
      pages: new Map(),
      activePageId: null,
    };

    this.state.set(profileName, state);

    // 创建第一个页面
    if (url) {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle' });
      const pageId = ++this._pageIdCounter;
      state.pages.set(pageId, page);
      state.activePageId = pageId;
    }

    return state;
  }

  getState(profileName: string): ProfileState | undefined {
    return this.state.get(profileName);
  }

  getActivePage(profileName: string) {
    const state = this.state.get(profileName);
    if (!state || state.activePageId === null) return null;
    return state.pages.get(state.activePageId);
  }

  async close(profileName: string): Promise<void> {
    const state = this.state.get(profileName);
    if (!state) return;

    if (state.context) {
      await state.context.close();
    }
    if (state.browser) {
      await state.browser.close();
    }

    this.state.delete(profileName);
  }
}

export const browserLauncher = new BrowserLauncher();
