import type { Page } from '@playwright/test';
import type { DeviceType } from '../../../shared/types';
import type { EventAccumulator } from '../../lib/event-accumulator';
import {
  GEL_EVENT,
  POST_SPIN_BUFFER_MS,
  SPIN_END_WAIT_MS,
  SPIN_START_TIMEOUT_MS,
} from '../../lib/gel-events';
import * as screenshot from '../../lib/screenshot';
import { track } from './track';
import type { StepContext } from './types';

function register(accumulator: EventAccumulator): void {
  accumulator.register(GEL_EVENT.SPIN_START);
  accumulator.register(GEL_EVENT.SPIN_END);
}

async function discover(ctx: StepContext): Promise<void> {
  console.log('[spin-cycle] No discovery process — running execute');
  await execute(ctx);
}

async function execute(ctx: StepContext): Promise<void> {
  const { page, accumulator, runID, deviceType, runState } = ctx;

  await track(runState.steps, `Spin start: ${GEL_EVENT.SPIN_START}`, async () => {
    await accumulator.waitFor(GEL_EVENT.SPIN_START, SPIN_START_TIMEOUT_MS);
    await screenshot.snap(page, `${runID}/${deviceType}/spin-start.png`);
  });

  await track(runState.steps, `Spin end: ${GEL_EVENT.SPIN_END}`, () => {
    return accumulator.waitFor(GEL_EVENT.SPIN_END, SPIN_END_WAIT_MS);
  });

  await takePostSpinSnapshots(page, runID, deviceType);
}

async function takePostSpinSnapshots(
  page: Page,
  runID: string,
  deviceType: DeviceType,
): Promise<void> {
  await page.waitForTimeout(POST_SPIN_BUFFER_MS);
  await screenshot.snap(page, `${runID}/${deviceType}/final-1.png`);
  await page.waitForTimeout(1_500);
  await screenshot.snap(page, `${runID}/${deviceType}/final-2.png`);
  await page.waitForTimeout(1_500);
  await screenshot.snap(page, `${runID}/${deviceType}/final-3.png`);
}

export { register, discover, execute };
