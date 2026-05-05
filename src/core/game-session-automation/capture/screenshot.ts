import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page } from '@playwright/test';
import { SCREENSHOTS_DIR } from '../../types';

async function snap(page: Page, name: string) {
  const file = path.resolve(SCREENSHOTS_DIR, name);

  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: false });
  console.log('Screenshot saved:', file);

  return file;
}

export const screenshot = { snap };
