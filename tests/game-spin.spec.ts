import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import { getClickCoords } from '../lib/claude-click';
import type { DeviceType } from '../lib/click-cache';

type Step = {
  waitMs: number;
  screenshotName: string;
  clickPrompt: string | null;
};

dotenv.config();

const GAME_URL = process.env.GAME_URL;
if (!GAME_URL) {
  throw new Error(
    'GAME_URL environment variable is not set. See .env.example for setup instructions.',
  );
}

const GAME_ID = new URL(GAME_URL).searchParams.get('gameid') ?? 'unknown-game';

function deviceTypeFromProjectName(projectName: string): DeviceType {
  return /mobile/i.test(projectName) ? 'mobile' : 'desktop';
}

const STEPS: Step[] = [
  {
    waitMs: 10_000,
    screenshotName: '01-after-load.png',
    clickPrompt: 'the CONTINUE button at the bottom of the screen',
  },
  {
    waitMs: 3_000,
    screenshotName: '02-after-continue.png',
    clickPrompt: 'the circular Spin button',
  },
  {
    waitMs: 5_000,
    screenshotName: '03-final-result.png',
    clickPrompt: null,
  },
];

async function snap(page: Page, name: string): Promise<string> {
  const dir = path.resolve('screenshots');
  fs.mkdirSync(dir, { recursive: true });

  const file = path.join(dir, name);

  await page.screenshot({ path: file, fullPage: false });

  console.log('Screenshot saved:', file);

  return file;
}

test('launch and spin 9 Masks of Fire', async ({ page }, testInfo: TestInfo) => {
  const deviceType = deviceTypeFromProjectName(testInfo.project.name);

  await page.goto(GAME_URL);

  for (const step of STEPS) {
    await page.waitForTimeout(step.waitMs);

    const screenshotPath = await snap(page, step.screenshotName);

    if (step.clickPrompt) {
      const viewport = page.viewportSize()!;

      const coords = await getClickCoords(screenshotPath, step.clickPrompt, viewport, {
        gameId: GAME_ID,
        deviceType,
      });

      console.log(`Clicking "${step.clickPrompt}" at`, coords);

      await page.mouse.click(coords.x, coords.y);
    }
  }

  console.log('Done — final screenshot: screenshots/03-final-result.png');
});
