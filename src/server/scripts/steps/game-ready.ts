import * as discovery from '../../lib/discovery';
import type { EventAccumulator } from '../../lib/event-accumulator';
import * as replay from '../../lib/replay';
import * as stepCache from '../../lib/step-cache';
import { track } from './track';
import type { StepContext } from './types';

function register(_accumulator: EventAccumulator): void {
  // pre-spin-navigation has no GEL event interests
}

async function discover(ctx: StepContext): Promise<void> {
  const { page, game, viewport, deviceType, runID, runState } = ctx;

  const gameReady = await track(runState.steps, 'Discover steps', async () => {
    try {
      const result = await discovery.discoverSteps(page, game, viewport, deviceType, runID);

      stepCache.setSteps(game.id, deviceType, viewport, {
        discoveredAt: new Date().toISOString(),
        steps: result.steps,
      });

      return result.gameReady;
    } catch (err) {
      if (err instanceof discovery.DiscoveryError && err.partialSteps.length > 0) {
        stepCache.setSteps(game.id, deviceType, viewport, {
          discoveredAt: new Date().toISOString(),
          steps: err.partialSteps,
          partial: true,
        });
      }

      throw err;
    }
  });

  if (gameReady) {
    runState.annotations['load-time-ms'] = String(gameReady.loadTimeMs);
    runState.annotations['had-load-progress'] = String(gameReady.hadLoadProgress);
  }
}

async function execute(ctx: StepContext): Promise<void> {
  const { page, game, viewport, deviceType, runID, runState } = ctx;
  const cached = stepCache.getSteps(game.id, deviceType, viewport);

  if (!cached) {
    throw new Error(`No cached steps found for game '${game.name}' — run discovery first`);
  }

  const gameReady = await track(
    runState.steps,
    `Replay ${cached.steps.length} cached step(s)`,
    () => {
      return replay.replaySteps(page, runID, cached.steps, deviceType);
    },
  );

  if (gameReady) {
    runState.annotations['load-time-ms'] = String(gameReady.loadTimeMs);
    runState.annotations['had-load-progress'] = String(gameReady.hadLoadProgress);
  }
}

export { register, discover, execute };
