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
function getTargetPage(pageId?: number) {
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

    const cursor = pageId ? getCursor(pageId) : null;
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
        (globalThis as any).window.scrollBy({ top: scrollY, behavior: 'smooth' });
      }, y);
    } else {
      const scrollAmount = Math.random() * 500 + 300;
      await page.evaluate((amount) => {
        (globalThis as any).window.scrollBy({ top: amount, behavior: 'smooth' });
      }, scrollAmount);
    }
    await randomDelay(500, 1500);
    return { success: true };
  },

  stealth_mouse_move: async (input: z.infer<typeof mouseMoveSchema>) => {
    const { x, y, pageId } = mouseMoveSchema.parse(input);
    const page = getTargetPage(pageId);
    if (!page) throw new Error('No active page');

    // ghost-cursor doesn't support direct coordinate movement
    // use page.mouse for coordinate-based movement
    await page.mouse.move(x, y);
    return { success: true };
  },

  stealth_new_tab: async (input: z.infer<typeof newTabSchema>) => {
    const { url } = newTabSchema.parse(input);
    const { pageId } = await createNewPage(url);
    return { success: true, pageId };
  },

  stealth_switch_tab: async (input: z.infer<typeof switchTabSchema>) => {
    const { target } = switchTabSchema.parse(input);
    const pages = await getPageList();

    if (pages.length === 0) throw new Error('No pages open');

    const currentPage = getActivePage();
    const currentIndex = pages.findIndex(p => currentPage && p.url === currentPage.url());
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
    const pages = await getPageList();
    const currentPage = getActivePage();

    let targetId: number | undefined;
    if (pageId !== undefined) {
      targetId = pageId;
    } else if (currentPage) {
      const currentPageInfo = pages.find(p => p.url === currentPage.url());
      targetId = currentPageInfo?.id;
    }

    if (!targetId) throw new Error('No page to close');

    await closePage(targetId);
    return { success: true };
  },

  stealth_list_tabs: async () => {
    const pages = await getPageList();
    return { success: true, pages };
  },

  stealth_close_browser: async () => {
    await closeBrowser();
    return { success: true };
  },
};
