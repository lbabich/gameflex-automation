import { GEL_EVENT, GEL_READY_TIMEOUT_MS } from '../../lib/gel-events';
import * as preLaunch from '../../lib/pre-launch';
import { track } from './track';
import type { StepContext } from './types';

async function discover(_ctx: StepContext): Promise<void> {
  console.log('[game-load] No discovery process');
}

async function execute(ctx: StepContext): Promise<void> {
  const { page, game, deviceType, playmode, accumulator, runState } = ctx;
  const startTime = Date.now();

  await track(runState.steps, 'Launch game via harness', () => {
    return preLaunch.launch(page, game, deviceType, playmode);
  });

  await accumulator.waitFor(GEL_EVENT.READY, GEL_READY_TIMEOUT_MS);

  const loadTime = Date.now() - startTime;
  const hadLoadProgress = accumulator.getAll().some((line) => {
    return line.includes(GEL_EVENT.LOAD_PROGRESS);
  });

  runState.steps.push({
    title: GEL_EVENT.LOAD_PROGRESS,
    duration: 0,
    ...(hadLoadProgress ? {} : { error: 'Not detected' }),
  });

  runState.steps.push({
    title: GEL_EVENT.READY,
    duration: loadTime,
  });
}

export { discover, execute };
