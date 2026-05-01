import type { RunHints } from '../../../shared/types';
import type { Viewport } from '../../types';
import type { VerifyClickFn } from '../discovery/loop';
import * as discoveryLoop from '../discovery/loop';
import { DiscoveryError } from '../discovery/loop';
import type { FailedButton } from '../discovery/prompt';
import { buildDiscoveryPrompt } from '../discovery/prompt';
import type { SessionContext } from './types';

export type MakeDiscoverConfig = {
  stepName: string;
  defaultInstructions: (viewport: Viewport) => string;
  failureContext: (list: string) => string;
  getHint: (hints: RunHints | undefined) => string | undefined;
  verifyClick: (ctx: SessionContext) => VerifyClickFn;
  swallowDiscoveryError?: boolean;
};

export function onGelEvent(event: string, timeoutMs: number) {
  return (ctx: SessionContext): VerifyClickFn => {
    return (_page, _x, _y) => {
      return ctx.accumulator
        .waitFor(event, timeoutMs)
        .then(() => {
          return true;
        })
        .catch(() => {
          return false;
        });
    };
  };
}

export function makeDiscover(config: MakeDiscoverConfig) {
  return async (ctx: SessionContext) => {
    const { page, game, viewport, deviceType, runID, hints, cache } = ctx;

    const cached = cache.getSteps({
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
      return buildDiscoveryPrompt(config.defaultInstructions(v), config.failureContext, hint, f);
    };

    const verifyClick = config.verifyClick(ctx);

    const run = () => {
      return discoveryLoop.runDiscoveryLoop(
        { page, game, viewport, deviceType, cache },
        {
          runID,
          stepName: config.stepName,
          buildPrompt: promptBuilder,
          verifyClick,
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
