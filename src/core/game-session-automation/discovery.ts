import type { RunHints } from '../../shared/types';
import type { CachedStep, Viewport } from '../types';
import { clickMarker } from './capture/click-marker';
import { screenshot } from './capture/screenshot';
import type { GelEvent } from './gel/events';
import type { FullStepContext } from './steps/types';
import type { VisionContext } from './vision-analyzer';

export type DiscoveryProfile = {
  stepName: string;
  hintKey?: keyof RunHints;
  instructions: (viewport: Viewport) => string;
  failureInstructions: string;
  verifyEvent?: GelEvent;
  checkEvent?: GelEvent;
  customVerify?: (ctx: FullStepContext, x: number, y: number) => Promise<boolean>;
};

const DiscoveryDecision = {
  Commit: 'commit',
  FalsePositive: 'falsePositive',
  Continue: 'continue',
} as const;
type DiscoveryDecision = (typeof DiscoveryDecision)[keyof typeof DiscoveryDecision];

const DISCOVERY_MAX_ATTEMPTS = 20;
const DISCOVERY_POLL_INTERVAL_MS = 1_000;
const VERIFY_TIMEOUT_MS = 3_000;

class DiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

async function discoverTarget(ctx: FullStepContext, profile: DiscoveryProfile): Promise<void> {
  const { page, game, viewport, deviceType, runID, hints, cache, visionAnalyzer } = ctx;

  const cached = cache.getSteps({ id: game.id, deviceType, viewport, stepName: profile.stepName });

  if (cached) {
    return;
  }

  const hint = profile.hintKey ? hints?.[profile.hintKey] : undefined;
  const allFailedButtons: Array<{ x: number; y: number; label: string }> = [];
  const preTargetSteps: CachedStep[] = [];
  const verifyClick = buildVerifyClick(profile);
  const checkComplete = buildCheckComplete(profile);

  const commit = () => {
    cache.setSteps(
      { id: game.id, deviceType, viewport, stepName: profile.stepName },
      { discoveredAt: new Date().toISOString(), steps: preTargetSteps },
    );
  };

  let lastClickTime = Date.now();

  for (let attempt = 1; attempt <= DISCOVERY_MAX_ATTEMPTS; attempt++) {
    if (checkComplete && (await checkComplete(ctx))) {
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
      instructions: profile.instructions,
      failureInstructions: profile.failureInstructions,
    };

    const result = await visionAnalyzer.analyze(screenshotPath, visionContext);
    let verified = false;

    if (result.found) {
      const waitMs = Date.now() - lastClickTime;

      await clickMarker.injectClickMarker(page, result.x, result.y);
      await screenshot.snap(page, `${runID}/${deviceType}/discovery-${attempt}-click.png`);
      await page.mouse.click(result.x, result.y);

      verified = await verifyClick(ctx, result.x, result.y);

      preTargetSteps.push({ waitMs, x: result.x, y: result.y, label: result.label });
    }

    const decision = decide(result, verified);

    if (decision === DiscoveryDecision.Commit) {
      commit();

      return;
    }

    if (decision === DiscoveryDecision.FalsePositive && result.found) {
      allFailedButtons.push({ x: result.x, y: result.y, label: result.label });
      lastClickTime = Date.now();
    }

    await page.waitForTimeout(DISCOVERY_POLL_INTERVAL_MS);
  }

  await screenshot.snap(page, `${runID}/${deviceType}/discovery-failed.png`);

  throw new DiscoveryError(
    `Could not find target for '${profile.stepName}' on ${game.name} (${game.desktopGameID}) after ${DISCOVERY_MAX_ATTEMPTS} attempts. See src/core/data/screenshots/${runID}/${deviceType}/discovery-failed.png`,
  );
}

function decide(result: { found: boolean }, verified: boolean): DiscoveryDecision {
  if (result.found && verified) {
    return DiscoveryDecision.Commit;
  }

  if (result.found) {
    return DiscoveryDecision.FalsePositive;
  }

  return DiscoveryDecision.Continue;
}

function buildVerifyClick(
  profile: DiscoveryProfile,
): (ctx: FullStepContext, x: number, y: number) => Promise<boolean> {
  if (profile.customVerify) {
    return profile.customVerify;
  }

  if (profile.verifyEvent) {
    const event = profile.verifyEvent;

    return (ctx, _x, _y) => {
      return ctx.accumulator
        .waitFor(event, VERIFY_TIMEOUT_MS)
        .then(() => {
          return true;
        })
        .catch(() => {
          return false;
        });
    };
  }

  return async () => {
    return true;
  };
}

function buildCheckComplete(
  profile: DiscoveryProfile,
): ((ctx: FullStepContext) => Promise<boolean>) | undefined {
  if (!profile.checkEvent) {
    return undefined;
  }

  const event = profile.checkEvent;

  return (ctx) => {
    return ctx.accumulator
      .waitFor(event, 0)
      .then(() => {
        return true;
      })
      .catch(() => {
        return false;
      });
  };
}

export const discovery = { DiscoveryError, discoverTarget, decide };
