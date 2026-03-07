import { promises as fs } from 'fs';
import * as path from 'path';

import { browserLauncher } from '../launcher.js';

export async function screenshot(
  fullPage: boolean = false,
  profile: string = 'default',
  filePath?: string,
  selector?: string
) {
  const state = browserLauncher.getState(profile);
  if (!state || state.activePageId === null) {
    throw new Error('No active page');
  }

  const page = state.pages.get(state.activePageId);
  if (!page) {
    throw new Error('Page not found');
  }

  const buffer = selector
    ? await page.locator(selector).screenshot()
    : await page.screenshot({ fullPage });

  let savedTo: string | undefined;
  if (filePath) {
    const absolute = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
    await fs.mkdir(path.dirname(absolute), { recursive: true });
    await fs.writeFile(absolute, buffer);
    savedTo = absolute;
  }

  return {
    success: true,
    image: buffer.toString('base64'),
    savedTo,
    fullPage,
    profile,
    selector,
  };
}
