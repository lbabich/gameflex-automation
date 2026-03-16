import type { Page } from '@playwright/test';
import * as claudeVision from './claude-vision';
import * as screenshot from './screenshot';
import type { CachedStep, Viewport } from './types';

const DISCOVERY_INITIAL_WAIT_MS = 8_000;
const DISCOVERY_POLL_INTERVAL_MS = 1_000;
const DISCOVERY_MAX_ATTEMPTS = 20;

export type Game = { gameId: string; name: string };

export class DiscoveryError extends Error {
  constructor(
    message: string,
    readonly partialSteps: CachedStep[],
  ) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

/**
 * Attempts up to 20 times to locate and click the spin button via Claude Vision,
 * recording each navigation step in the returned array.
 *
 * The `waitForSpinStart` callback should wait up to ~10 s for a spin event and
 * return `true` if one was detected, `false` on timeout.
 *
 * @throws {DiscoveryError} when the spin button is not found after all attempts;
 *   `err.partialSteps` contains any navigation steps recorded before failure.
 */
export async function discoverSteps(
  page: Page,
  game: Game,
  viewport: Viewport,
  waitForSpinStart: () => Promise<boolean>,
) {
  const allFailedButtons: claudeVision.FailedButton[] = [];
  const preSpinSteps: CachedStep[] = [];

  let lastClickTime = Date.now();

  await page.waitForTimeout(DISCOVERY_INITIAL_WAIT_MS);

  for (let attempt = 1; attempt <= DISCOVERY_MAX_ATTEMPTS; attempt++) {
    const screenshotPath = await screenshot.snap(page, `${game.gameId}/discovery-${attempt}.png`);

    const spinResult = await claudeVision.detectSpinButton(
      screenshotPath,
      viewport,
      allFailedButtons,
    );

    if (spinResult.found) {
      const waitMs = Date.now() - lastClickTime;

      await page.mouse.click(spinResult.x, spinResult.y);
      lastClickTime = Date.now();
      const spun = await waitForSpinStart();

      if (spun) {
        preSpinSteps.push({ waitMs, x: spinResult.x, y: spinResult.y, label: spinResult.label });

        return preSpinSteps;
      }

      console.log(
        `[discover] False positive: "${spinResult.label}" at ${spinResult.x},${spinResult.y} — recording as navigation step`,
      );

      preSpinSteps.push({ waitMs, x: spinResult.x, y: spinResult.y, label: spinResult.label });
      // Reset failed buttons — this click navigated to a new screen, so old positions are irrelevant
      allFailedButtons.length = 0;
      await page.waitForTimeout(DISCOVERY_POLL_INTERVAL_MS);
      continue;
    }

    const nextResult = await claudeVision.detectNextClick(
      screenshotPath,
      viewport,
      allFailedButtons,
    );

    if (nextResult.found) {
      const waitMs = Date.now() - lastClickTime;

      preSpinSteps.push({ waitMs, x: nextResult.x, y: nextResult.y, label: nextResult.label });
      await page.mouse.click(nextResult.x, nextResult.y);
      lastClickTime = Date.now();
    }

    await page.waitForTimeout(DISCOVERY_POLL_INTERVAL_MS);
  }

  await screenshot.snap(page, `${game.gameId}/discovery-failed.png`);
  throw new DiscoveryError(
    `Could not find spin button for ${game.name} (${game.gameId}) after ${DISCOVERY_MAX_ATTEMPTS} attempts. See src/server/screenshots/${game.gameId}/discovery-failed.png`,
    preSpinSteps,
  );
}
