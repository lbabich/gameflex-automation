import { GEL_EVENT, GEL_READY_TIMEOUT_MS } from '../../lib/gel-events';
import { track } from './track';
import type { StepContext } from './types';

async function discover(_ctx: StepContext): Promise<void> {
  console.log('[game-ready] No discovery process');
}

async function execute(ctx: StepContext): Promise<void> {
  const { accumulator, runState } = ctx;
  const startTime = Date.now();

  await track(runState.steps, 'Wait for game ready', () => {
    return accumulator.waitFor(GEL_EVENT.READY, GEL_READY_TIMEOUT_MS);
  });

  const hadLoadProgress = accumulator.getAll().some((line) => {
    return line.includes(GEL_EVENT.LOAD_PROGRESS);
  });

  runState.metadata.loadTime = String(Date.now() - startTime);
  runState.metadata.hasLoadProgress = String(hadLoadProgress);
}

export { discover, execute };
