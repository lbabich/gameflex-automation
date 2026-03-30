import * as preLaunch from '../../lib/pre-launch';
import { track } from './track';
import type { StepContext } from './types';

async function discover(_ctx: StepContext): Promise<void> {
  console.log('[game-load] No discovery process');
}

async function execute(ctx: StepContext): Promise<void> {
  await track(ctx.runState.steps, 'Launch game via harness', () => {
    return preLaunch.launch(ctx.page, ctx.game, ctx.deviceType, ctx.playmode);
  });
}

export { discover, execute };
