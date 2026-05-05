import type { TestStep } from '../../../shared/types';
import { GEL_EVENT, GEL_READY_TIMEOUT_MS } from '../gel/events';
import * as preLaunch from '../pre-launch';
import { track } from './track';
import type { SessionContext, StepDescriptor } from './types';

export const plan: StepDescriptor[] = [
  { title: 'Launch game via harness' },
  { title: GEL_EVENT.LOAD_PROGRESS, optional: true },
  { title: GEL_EVENT.READY },
];

export async function discover(_ctx: SessionContext) {
  console.log('[game-load] No discovery process');
}

export async function execute(ctx: SessionContext) {
  const { page, game, deviceType, accumulator } = ctx;
  const readyPromise = accumulator.waitFor(GEL_EVENT.READY, GEL_READY_TIMEOUT_MS);

  readyPromise.catch(() => {}); // prevent unhandled rejection if timeout fires during launch

  const launchStep = await track('Launch game via harness', () => {
    return preLaunch.launch(page, game, deviceType);
  });

  const readyStep = await track(GEL_EVENT.READY, () => {
    return readyPromise;
  });

  const hadLoadProgress = accumulator.getAll().some((line) => {
    return line.includes(GEL_EVENT.LOAD_PROGRESS);
  });

  const loadProgressStep: TestStep = {
    title: GEL_EVENT.LOAD_PROGRESS,
    duration: 0,
    status: hadLoadProgress ? 'passed' : 'warning',
    optional: true,
  };

  return [launchStep, loadProgressStep, readyStep];
}
