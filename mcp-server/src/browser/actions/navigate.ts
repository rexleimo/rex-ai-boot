// mcp-server/src/browser/actions/navigate.ts
import { browserLauncher } from '../launcher.js';

export async function navigate(url: string, profile: string = 'default') {
  const state = browserLauncher.getState(profile);
  if (!state || !state.context) {
    await browserLauncher.launch(profile, url);
    return { success: true, url, profile };
  }

  const page = await state.context.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });

  const pageId = ++browserLauncher.pageIdCounter;
  state.pages.set(pageId, page);
  state.activePageId = pageId;

  return {
    success: true,
    url: await page.url(),
    title: await page.title(),
    pageId,
    profile,
  };
}
