import { GEL_EVENT, GEL_READY_TIMEOUT_MS } from '../gel-events';
import * as preLaunch from '../pre-launch';
import { track } from './track';
import type { StepContext, StepDescriptor } from './types';

const plan: StepDescriptor[] = [
  { title: 'Launch game via harness' },
  { title: GEL_EVENT.LOAD_PROGRESS, optional: true },
  { title: GEL_EVENT.READY },
];

async function discover(_ctx: StepContext): Promise<void> {
  console.log('[game-load] No discovery process');
}

async function execute(ctx: StepContext): Promise<void> {
  const { page, game, deviceType, accumulator, runState } = ctx;
  const readyPromise = accumulator.waitFor(GEL_EVENT.READY, GEL_READY_TIMEOUT_MS);

  readyPromise.catch(() => {}); // prevent unhandled rejection if timeout fires during launch

  await track(runState.steps, 'Launch game via harness', () => {
    return preLaunch.launch(page, game, deviceType);
  });

  await track(runState.steps, GEL_EVENT.READY, () => {
    return readyPromise;
  });

  const hadLoadProgress = accumulator.getAll().some((line) => {
    return line.includes(GEL_EVENT.LOAD_PROGRESS);
  });

  const loadProgressStep = runState.steps.find((step) => {
    return step.title === GEL_EVENT.LOAD_PROGRESS;
  })!;

  loadProgressStep.status = hadLoadProgress ? 'passed' : 'warning';
}

export { discover, execute, plan };
