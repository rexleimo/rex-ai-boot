// mcp-server/src/browser/actions/click.ts
import { browserLauncher } from '../launcher.js';

export async function click(selector: string, profile: string = 'default', double: boolean = false) {
  const state = browserLauncher.getState(profile);
  if (!state || state.activePageId === null) {
    throw new Error('No active page');
  }

  const page = state.pages.get(state.activePageId);
  if (!page) {
    throw new Error('Page not found');
  }

  await page.click(selector, { double });

  return {
    success: true,
    selector,
    action: double ? 'double-click' : 'click',
    profile,
  };
}
