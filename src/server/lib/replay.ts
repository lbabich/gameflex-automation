import type { Page } from '@playwright/test';
import type { DeviceType } from '../../shared/types';
import type { CachedStep } from '../types';
import * as screenshot from './screenshot';

async function replaySteps(
  page: Page,
  runID: string,
  steps: CachedStep[],
  deviceType: DeviceType,
): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    await page.waitForTimeout(Math.max(steps[i].waitMs, 1_000));
    await injectClickMarker(page, steps[i].x, steps[i].y);
    await screenshot.snap(page, `${runID}/${deviceType}/step-${i + 1}.png`);
    console.log(`Clicking "${steps[i].label}" at ${steps[i].x},${steps[i].y}`);
    await page.mouse.click(steps[i].x, steps[i].y);
  }
}

async function injectClickMarker(page: Page, x: number, y: number) {
  await page.evaluate(
    ({ x, y }) => {
      const existing = document.getElementById('__click_marker__');

      if (existing) {
        existing.remove();
      }

      const marker = document.createElement('div');

      marker.id = '__click_marker__';
      marker.style.cssText = `position:fixed;left:${x - 15}px;top:${y - 15}px;width:30px;height:30px;border-radius:50%;background:rgba(255,0,0,0.6);border:3px solid red;z-index:2147483647;pointer-events:none;`;
      document.body.appendChild(marker);
    },
    { x, y },
  );
}

export { replaySteps };
