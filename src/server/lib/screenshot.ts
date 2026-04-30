import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page } from '@playwright/test';

export const SCREENSHOTS_DIR = 'src/server/screenshots';

/** Takes a screenshot of the current page and saves it as a PNG. Returns the absolute path to the saved file. */
export async function snap(page: Page, name: string) {
  const file = path.resolve(SCREENSHOTS_DIR, name);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: false });
  console.log('Screenshot saved:', file);

  return file;
}
