import type { CachedStep, Viewport } from '../types';
import { clickMarker } from './capture/click-marker';
import { screenshot } from './capture/screenshot';
import type { DiscoveryContext } from './steps/types';
import type { ClickResult, VisionContext } from './vision-analyzer';

export type DiscoverySpec<TCtx extends DiscoveryContext> = {
  stepName: string;
  defaultInstructions: (viewport: Viewport) => string;
  failureContext: (list: string) => string;
  getHint: (hints: DiscoveryContext['hints']) => string | undefined;
  verifyClick: (ctx: TCtx, x: number, y: number) => Promise<boolean>;
  checkComplete?: (ctx: TCtx) => Promise<boolean>;
};

type DiscoveryDecision = 'commit' | 'falsePositive' | 'continue';

const DISCOVERY_MAX_ATTEMPTS = 20;
const DISCOVERY_POLL_INTERVAL_MS = 1_000;

class DiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

async function discoverTarget<TCtx extends DiscoveryContext>(
  ctx: TCtx,
  spec: DiscoverySpec<TCtx>,
): Promise<void> {
  const { page, game, viewport, deviceType, runID, hints, cache, visionAnalyzer } = ctx;

  const cached = cache.getSteps({ id: game.id, deviceType, viewport, stepName: spec.stepName });

  if (cached) {
    return;
  }

  const hint = spec.getHint(hints);
  const allFailedButtons: Array<{ x: number; y: number; label: string }> = [];
  const preTargetSteps: CachedStep[] = [];

  const commit = () => {
    cache.setSteps(
      { id: game.id, deviceType, viewport, stepName: spec.stepName },
      { discoveredAt: new Date().toISOString(), steps: preTargetSteps },
    );
  };

  let lastClickTime = Date.now();

  for (let attempt = 1; attempt <= DISCOVERY_MAX_ATTEMPTS; attempt++) {
    if (spec.checkComplete && (await spec.checkComplete(ctx))) {
      commit();

      return;
    }

    const screenshotPath = await screenshot.snap(
      page,
      `${runID}/${deviceType}/discovery-${attempt}.png`,
    );

    const visionContext: VisionContext = {
      viewport,
      hint,
      failedButtons: allFailedButtons,
      defaultInstructions: spec.defaultInstructions,
      failureContext: spec.failureContext,
    };

    const result = await visionAnalyzer.analyze(screenshotPath, visionContext);
    let verified = false;

    if (result.found) {
      const waitMs = Date.now() - lastClickTime;

      await clickMarker.injectClickMarker(page, result.x, result.y);
      await screenshot.snap(page, `${runID}/${deviceType}/discovery-${attempt}-click.png`);
      await page.mouse.click(result.x, result.y);

      verified = await spec.verifyClick(ctx, result.x, result.y);

      preTargetSteps.push({ waitMs, x: result.x, y: result.y, label: result.label });
    }

    const decision = decide(result, verified);

    if (decision === 'commit') {
      commit();

      return;
    }

    if (decision === 'falsePositive' && result.found) {
      allFailedButtons.push({ x: result.x, y: result.y, label: result.label });
      lastClickTime = Date.now();
    }

    await page.waitForTimeout(DISCOVERY_POLL_INTERVAL_MS);
  }

  await screenshot.snap(page, `${runID}/${deviceType}/discovery-failed.png`);

  throw new DiscoveryError(
    `Could not find target for '${spec.stepName}' on ${game.name} (${game.desktopGameID}) after ${DISCOVERY_MAX_ATTEMPTS} attempts. See src/core/data/screenshots/${runID}/${deviceType}/discovery-failed.png`,
  );
}

function decide(result: ClickResult, verified: boolean): DiscoveryDecision {
  if (result.found && verified) {
    return 'commit';
  }

  if (result.found) {
    return 'falsePositive';
  }

  return 'continue';
}

export const discovery = { DiscoveryError, discoverTarget, decide };
