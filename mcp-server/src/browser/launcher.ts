// mcp-server/src/browser/launcher.ts
import { chromium, type Browser, type BrowserContext } from 'playwright';
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
  '--disable-crash-reporter',
  '--disable-breakpad',
];

// Playwright 默认会传 --enable-automation，容易触发“Chrome 正受到自动测试软件控制”提示条。
const IGNORE_DEFAULT_ARGS = ['--enable-automation'];

// 反检测注入脚本
const STEALTH_SCRIPT = `
  Object.defineProperty(navigator, 'webdriver', { get: () => false });
  Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
  Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en-US', 'en'] });
  window.chrome = { runtime: {} };
`;

function parseHeadlessEnv(value: string | undefined): boolean | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return undefined;
}

export function resolveLaunchHeadless(
  options: { headless?: boolean; visible?: boolean },
  profile: BrowserProfile,
  envValue: string | undefined
): { headless: boolean; visible: boolean; source: 'arg-visible' | 'arg-headless' | 'profile-headless' | 'env-headless' | 'default-visible' } {
  if (typeof options.visible === 'boolean') {
    return {
      headless: !options.visible,
      visible: options.visible,
      source: 'arg-visible',
    };
  }

  if (typeof options.headless === 'boolean') {
    return {
      headless: options.headless,
      visible: !options.headless,
      source: 'arg-headless',
    };
  }

  if (typeof profile.headless === 'boolean') {
    return {
      headless: profile.headless,
      visible: !profile.headless,
      source: 'profile-headless',
    };
  }

  const envHeadless = parseHeadlessEnv(envValue);
  if (typeof envHeadless === 'boolean') {
    return {
      headless: envHeadless,
      visible: !envHeadless,
      source: 'env-headless',
    };
  }

  return {
    headless: false,
    visible: true,
    source: 'default-visible',
  };
}

function resolveExecutablePath(profile: BrowserProfile): string | undefined {
  if (profile.executablePath) return profile.executablePath;
  if (process.env.BROWSER_EXECUTABLE_PATH) return process.env.BROWSER_EXECUTABLE_PATH;

  if (process.platform === 'darwin') {
    const macCandidates = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ];
    for (const candidate of macCandidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return undefined;
}

export class BrowserLauncher {
  private state: Map<string, ProfileState> = new Map();
  private _pageIdCounter = 0;
  private profileInitPromise: Promise<void> | null = null;

  private async ensureProfilesLoaded(): Promise<void> {
    if (!this.profileInitPromise) {
      this.profileInitPromise = profileManager.init();
    }
    await this.profileInitPromise;
  }

  get pageIdCounter(): number {
    return this._pageIdCounter;
  }

  set pageIdCounter(value: number) {
    this._pageIdCounter = value;
  }

  async launch(profileName: string = 'default', url?: string, headless?: boolean, visible?: boolean): Promise<ProfileState> {
    await this.ensureProfilesLoaded();

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
    const userDataDir = profile.userDataDir
      ? profileManager.resolveWorkspacePath(profile.userDataDir)
      : profileDir;

    const launchPreference = resolveLaunchHeadless({ headless, visible }, profile, process.env.BROWSER_HEADLESS);
    const resolvedHeadless = launchPreference.headless;
    const executablePath = resolveExecutablePath(profile);
    const cdpEndpoint = profile.cdpUrl || (profile.cdpPort ? `http://127.0.0.1:${profile.cdpPort}` : undefined);

    let browser: Browser;
    let context: BrowserContext;
    let connectedOverCdp = false;
    let launchMode: ProfileState['launchMode'] = 'ephemeral-local';
    let effectiveProfile = profileName;

    try {
      // 优先支持指纹浏览器/CDP 接入，避免本地启动 Chrome for Testing 崩溃。
      if (cdpEndpoint) {
        try {
          browser = await chromium.connectOverCDP(cdpEndpoint);
          connectedOverCdp = true;
          launchMode = 'cdp';
          const contexts = browser.contexts();
          context = contexts.length > 0
            ? contexts[0]
            : await browser.newContext({ viewport: { width: 1280, height: 720 } });
        } catch (cdpError) {
          // 新用户最常见问题：默认 profile 配置了 CDP，但本机没有启动 9222。
          // 对 default profile 自动降级到 local，减少首次接入成本。
          if (profileName !== 'default') {
            throw cdpError;
          }

          const fallbackProfile = profileManager.getProfile('local') || { name: 'local', userDataDir: '.browser-profiles/local' };
          const fallbackUserDataDir = fallbackProfile.userDataDir
            ? profileManager.resolveWorkspacePath(fallbackProfile.userDataDir)
            : profileManager.getProfileDir('local');
          const fallbackExecutablePath = resolveExecutablePath(fallbackProfile);

          context = await chromium.launchPersistentContext(fallbackUserDataDir, {
            headless: resolvedHeadless,
            args: STEALTH_ARGS,
            ignoreDefaultArgs: IGNORE_DEFAULT_ARGS,
            executablePath: fallbackExecutablePath,
            viewport: { width: 1280, height: 720 },
          });
          browser = context.browser()!;
          launchMode = 'persistent-local-fallback';
          effectiveProfile = 'local';

          const reason = cdpError instanceof Error ? cdpError.message : String(cdpError);
          console.error(
            `[browser_launch] default profile cdp fallback -> local. reason=${reason}`
          );
        }
      } else if (userDataDir) {
        // 使用 launchPersistentContext 来支持 userDataDir（持久化登录状态）
        context = await chromium.launchPersistentContext(userDataDir, {
          headless: resolvedHeadless,
          args: STEALTH_ARGS,
          ignoreDefaultArgs: IGNORE_DEFAULT_ARGS,
          executablePath,
          viewport: { width: 1280, height: 720 },
        });
        browser = context.browser()!;
        launchMode = 'persistent-local';
      } else {
        browser = await chromium.launch({
          headless: resolvedHeadless,
          args: STEALTH_ARGS,
          ignoreDefaultArgs: IGNORE_DEFAULT_ARGS,
          executablePath,
        });
        context = await browser.newContext({
          viewport: { width: 1280, height: 720 },
        });
        launchMode = 'ephemeral-local';
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const tips = [
        `profile=${profileName}`,
        cdpEndpoint ? `cdp=${cdpEndpoint}` : 'cdp=disabled',
        `headless=${String(resolvedHeadless)}`,
        executablePath ? `executablePath=${executablePath}` : 'executablePath=playwright-default',
      ].join(', ');
      throw new Error(
        `Browser launch failed (${tips}). ${reason}\n` +
        `建议：在 config/browser-profiles.json 为该 profile 配置 cdpUrl/cdpPort（连接指纹浏览器）` +
        `或 executablePath（系统浏览器路径）。`
      );
    }

    // 注入反检测脚本
    await context.addInitScript(STEALTH_SCRIPT);

    const state: ProfileState = {
      browser,
      context,
      pages: new Map(),
      activePageId: null,
      connectedOverCdp,
      headless: resolvedHeadless,
      visible: launchPreference.visible,
      launchMode,
      requestedProfile: profileName,
      effectiveProfile,
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

    if (state.connectedOverCdp) {
      // CDP 模式下 close() 只断开连接，不关闭外部浏览器进程。
      await state.browser?.close();
    } else {
      if (state.context) {
        await state.context.close();
      }
      if (state.browser) {
        await state.browser.close();
      }
    }

    this.state.delete(profileName);
  }
}

export const browserLauncher = new BrowserLauncher();
