import type { EventAccumulator } from '../../lib/event-accumulator';
import { GEL_EVENT, GEL_READY_TIMEOUT_MS } from '../../lib/gel-events';
import { track } from './track';
import type { StepContext } from './types';

function register(accumulator: EventAccumulator): void {
  accumulator.register(GEL_EVENT.READY);
  accumulator.register(GEL_EVENT.LOAD_PROGRESS);
}

async function discover(ctx: StepContext): Promise<void> {
  console.log('[game-ready] No discovery process — running execute');
  await execute(ctx);
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

  runState.annotations['load-time-ms'] = String(Date.now() - startTime);
  runState.annotations['had-load-progress'] = String(hadLoadProgress);
}

export { register, discover, execute };
