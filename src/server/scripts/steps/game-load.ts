import type { EventAccumulator } from '../../lib/event-accumulator';
import * as preLaunch from '../../lib/pre-launch';
import { track } from './track';
import type { StepContext } from './types';

function register(_accumulator: EventAccumulator): void {
  // game-load has no GEL event interests
}

async function discover(ctx: StepContext): Promise<void> {
  console.log('[game-load] No discovery process — running execute');
  await execute(ctx);
}

async function execute(ctx: StepContext): Promise<void> {
  await track(ctx.runState.steps, 'Launch game via harness', () => {
    return preLaunch.launch(ctx.page, ctx.game, ctx.deviceType, ctx.playmode);
  });
}

export { register, discover, execute };
