import type { Page } from '@playwright/test';
import type { DeviceType } from '../../shared/types';
import type { CachedStep } from '../types';
import * as clickMarker from './click-marker';
import * as screenshot from './screenshot';

export async function replaySteps(
  page: Page,
  runID: string,
  steps: CachedStep[],
  deviceType: DeviceType,
): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    await page.waitForTimeout(Math.max(steps[i].waitMs, 1_000));
    await clickMarker.injectClickMarker(page, steps[i].x, steps[i].y);
    await screenshot.snap(page, `${runID}/${deviceType}/step-${i + 1}.png`);
    console.log(`Clicking "${steps[i].label}" at ${steps[i].x},${steps[i].y}`);
    await page.mouse.click(steps[i].x, steps[i].y);
  }
}
