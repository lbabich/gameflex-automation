import type { Page } from '@playwright/test';
import type { DeviceType } from '../../shared/types';
import type { CachedStep } from '../types';
import { clickMarker } from './capture/click-marker';
import { screenshot } from './capture/screenshot';

async function replaySteps(page: Page, runID: string, steps: CachedStep[], deviceType: DeviceType) {
  for (let i = 0; i < steps.length; i++) {
    await page.waitForTimeout(Math.max(steps[i].waitMs, 1_000));
    await clickMarker.injectClickMarker(page, steps[i].x, steps[i].y);
    await screenshot.snap(page, `${runID}/${deviceType}/step-${i + 1}.png`);
    console.log(`Clicking "${steps[i].label}" at ${steps[i].x},${steps[i].y}`);
    await page.mouse.click(steps[i].x, steps[i].y);
  }
}

export const replay = { replaySteps };
