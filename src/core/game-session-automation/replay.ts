import type { Page } from '@playwright/test';
import type { DeviceType } from '../../shared/types';
import type { CachedStep } from '../types';
import { clickMarker } from './capture/click-marker';
import { screenshot } from './capture/screenshot';
import { processLog } from './process-log';

async function replaySteps(
  page: Page,
  runID: string,
  steps: CachedStep[],
  deviceType: DeviceType,
  stepName?: string,
) {
  const ctx = stepName ?? 'replay';

  processLog.log(ctx, `Replaying ${steps.length} step(s)`);

  for (let i = 0; i < steps.length; i++) {
    processLog.log(
      ctx,
      `Step ${i + 1}/${steps.length} — clicking "${steps[i].label}" at (${steps[i].x},${steps[i].y})`,
    );

    await page.waitForTimeout(Math.max(steps[i].waitMs, 1_000));
    await clickMarker.injectClickMarker(page, steps[i].x, steps[i].y);
    await screenshot.snap(page, `${runID}/${deviceType}/step-${i + 1}.png`);
    await page.mouse.click(steps[i].x, steps[i].y);
  }

  processLog.log(ctx, 'Replay complete');
}

export const replay = { replaySteps };
