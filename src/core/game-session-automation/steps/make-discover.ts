import type { RunHints } from '../../../shared/types';
import { stepCache } from '../../step-cache';
import type { Viewport } from '../../types';
import type { VerifyClickFn } from '../discovery/loop';
import * as discoveryLoop from '../discovery/loop';
import { DiscoveryError } from '../discovery/loop';
import type { FailedButton } from '../discovery/prompt';
import type { StepContext } from './types';

type MakeDiscoverConfig = {
  stepName: string;
  buildPrompt: (
    hint: string | undefined,
    viewport: Viewport,
    failedButtons: FailedButton[],
  ) => string;
  getHint: (hints: RunHints | undefined) => string | undefined;
  getVerifyClick: (ctx: StepContext) => VerifyClickFn;
  savePartialOnFailure?: boolean;
  swallowDiscoveryError?: boolean;
};

function makeDiscover(config: MakeDiscoverConfig): (ctx: StepContext) => Promise<void> {
  return async (ctx: StepContext) => {
    const { page, game, viewport, deviceType, runID, hints } = ctx;

    const cached = stepCache.getSteps({
      id: game.id,
      deviceType,
      viewport,
      stepName: config.stepName,
    });

    if (cached) {
      return;
    }

    const hint = config.getHint(hints);
    const promptBuilder = (v: Viewport, f: FailedButton[]) => {
      return config.buildPrompt(hint, v, f);
    };
    const verifyClick = config.getVerifyClick(ctx);

    const run = () => {
      return discoveryLoop.runDiscoveryLoop(
        { page, game, viewport, deviceType },
        {
          runID,
          stepName: config.stepName,
          buildPrompt: promptBuilder,
          verifyClick,
          savePartialOnFailure: config.savePartialOnFailure,
        },
      );
    };

    if (config.swallowDiscoveryError) {
      try {
        await run();
      } catch (err) {
        if (err instanceof DiscoveryError) {
          return;
        }

        throw err;
      }
    } else {
      return run();
    }
  };
}

export { makeDiscover };
export type { MakeDiscoverConfig };
