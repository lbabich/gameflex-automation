import { GEL_EVENT, GEL_READY_TIMEOUT_MS } from '../../lib/gel-events';
import * as preLaunch from '../../lib/pre-launch';
import type { StepContext } from './types';

async function discover(_ctx: StepContext): Promise<void> {
  console.log('[game-load] No discovery process');
}

async function execute(ctx: StepContext): Promise<void> {
  const { page, game, deviceType, playmode, accumulator, runState } = ctx;
  const startTime = Date.now();

  await preLaunch.launch(page, game, deviceType, playmode);
  await accumulator.waitFor(GEL_EVENT.READY, GEL_READY_TIMEOUT_MS);

  const hadLoadProgress = accumulator.getAll().some((line) => {
    return line.includes(GEL_EVENT.LOAD_PROGRESS);
  });

  runState.metadata.loadTime = Date.now() - startTime;
  runState.metadata.hasLoadProgress = hadLoadProgress;
}

export { discover, execute };
