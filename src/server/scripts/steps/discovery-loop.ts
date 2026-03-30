import type { Page } from '@playwright/test';
import type { DeviceType } from '../../../shared/types';
import * as claudeVision from '../../lib/claude-vision';
import * as screenshot from '../../lib/screenshot';
import * as stepCache from '../../lib/step-cache';
import type { CachedStep, Viewport } from '../../types';
import type { StepContext } from './types';

type FailedButton = { x: number; y: number; label: string };

type PromptBuilder = (viewport: Viewport, failedButtons: FailedButton[]) => string;

const DISCOVERY_MAX_ATTEMPTS = 20;
const DISCOVERY_POLL_INTERVAL_MS = 1_000;

class DiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

async function runDiscoveryLoop(
  page: Page,
  game: StepContext['game'],
  viewport: Viewport,
  deviceType: DeviceType,
  runID: string,
  stepName: string,
  buildPrimaryPrompt: PromptBuilder,
  buildNavPrompt: PromptBuilder,
): Promise<void> {
  const allFailedButtons: FailedButton[] = [];
  const preTargetSteps: CachedStep[] = [];

  let lastClickTime = Date.now();

  for (let attempt = 1; attempt <= DISCOVERY_MAX_ATTEMPTS; attempt++) {
    const screenshotPath = await screenshot.snap(
      page,
      `${runID}/${deviceType}/discovery-${attempt}.png`,
    );

    const primaryResult = await claudeVision.query(
      screenshotPath,
      buildPrimaryPrompt(viewport, allFailedButtons),
    );

    if (primaryResult.found) {
      const waitMs = Date.now() - lastClickTime;

      preTargetSteps.push({
        waitMs,
        x: primaryResult.x,
        y: primaryResult.y,
        label: primaryResult.label,
      });

      await page.mouse.click(primaryResult.x, primaryResult.y);

      stepCache.setPendingSteps(game.id, deviceType, viewport, stepName, {
        discoveredAt: new Date().toISOString(),
        steps: preTargetSteps,
      });

      return;
    }

    const navResult = await claudeVision.query(
      screenshotPath,
      buildNavPrompt(viewport, allFailedButtons),
    );

    if (navResult.found) {
      const waitMs = Date.now() - lastClickTime;

      preTargetSteps.push({ waitMs, x: navResult.x, y: navResult.y, label: navResult.label });
      await page.mouse.click(navResult.x, navResult.y);
      lastClickTime = Date.now();
    }

    await page.waitForTimeout(DISCOVERY_POLL_INTERVAL_MS);
  }

  if (preTargetSteps.length > 0) {
    stepCache.setSteps(game.id, deviceType, viewport, stepName, {
      discoveredAt: new Date().toISOString(),
      steps: preTargetSteps,
      partial: true,
    });
  }

  await screenshot.snap(page, `${runID}/${deviceType}/discovery-failed.png`);

  throw new DiscoveryError(
    `Could not find target for '${stepName}' on ${game.name} (${game.desktopGameID}) after ${DISCOVERY_MAX_ATTEMPTS} attempts. See src/server/screenshots/${runID}/${deviceType}/discovery-failed.png`,
  );
}

export type { FailedButton, PromptBuilder };
export { DiscoveryError, runDiscoveryLoop };
