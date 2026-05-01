import type { Page } from '@playwright/test';
import type { DeviceType } from '../../../shared/types';
import type { NodeStepCache } from '../../step-cache';
import type { CachedStep, Viewport } from '../../types';
import * as clickMarker from '../click-marker';
import * as screenshot from '../screenshot';
import type { SessionContext } from '../steps/types';
import type { FailedButton } from './prompt';
import * as claudeVision from './vision';

export type PromptBuilder = (viewport: Viewport, failedButtons: FailedButton[]) => string;
export type VerifyClickFn = (page: Page, x: number, y: number) => Promise<boolean>;

export type DiscoveryContext = {
  page: Page;
  game: SessionContext['game'];
  viewport: Viewport;
  deviceType: DeviceType;
  cache: NodeStepCache;
};

export type DiscoveryConfig = {
  runID: string;
  stepName: string;
  buildPrompt: PromptBuilder;
  verifyClick: VerifyClickFn;
};

const DISCOVERY_MAX_ATTEMPTS = 20;
const DISCOVERY_POLL_INTERVAL_MS = 1_000;

export class DiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

export async function runDiscoveryLoop(ctx: DiscoveryContext, config: DiscoveryConfig) {
  const { page, game, viewport, deviceType, cache } = ctx;
  const { runID, stepName, buildPrompt, verifyClick } = config;

  const allFailedButtons: FailedButton[] = [];
  const preTargetSteps: CachedStep[] = [];

  let lastClickTime = Date.now();

  for (let attempt = 1; attempt <= DISCOVERY_MAX_ATTEMPTS; attempt++) {
    const screenshotPath = await screenshot.snap(
      page,
      `${runID}/${deviceType}/discovery-${attempt}.png`,
    );

    const result = await claudeVision.query(
      screenshotPath,
      buildPrompt(viewport, allFailedButtons),
    );

    if (result.found) {
      const waitMs = Date.now() - lastClickTime;

      await clickMarker.injectClickMarker(page, result.x, result.y);
      await screenshot.snap(page, `${runID}/${deviceType}/discovery-${attempt}-click.png`);
      await page.mouse.click(result.x, result.y);

      const verified = await verifyClick(page, result.x, result.y);

      preTargetSteps.push({ waitMs, x: result.x, y: result.y, label: result.label });

      if (verified) {
        cache.setSteps(
          { id: game.id, deviceType, viewport, stepName },
          { discoveredAt: new Date().toISOString(), steps: preTargetSteps },
        );

        return;
      }

      allFailedButtons.push({ x: result.x, y: result.y, label: result.label });
      lastClickTime = Date.now();
    }

    await page.waitForTimeout(DISCOVERY_POLL_INTERVAL_MS);
  }

  await screenshot.snap(page, `${runID}/${deviceType}/discovery-failed.png`);

  throw new DiscoveryError(
    `Could not find target for '${stepName}' on ${game.name} (${game.desktopGameID}) after ${DISCOVERY_MAX_ATTEMPTS} attempts. See src/core/screenshots/${runID}/${deviceType}/discovery-failed.png`,
  );
}
