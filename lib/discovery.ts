import type { Page } from '@playwright/test';
import type { FailedButton } from './claude-vision';
import { detectNextClick, detectSpinButton } from './claude-vision';
import { snap } from './screenshot';
import type { CachedStep, Viewport } from './step-cache';

const DISCOVERY_INITIAL_WAIT_MS = 8_000;
const DISCOVERY_POLL_INTERVAL_MS = 1_000;
const DISCOVERY_MAX_ATTEMPTS = 20;

export class DiscoveryError extends Error {
  constructor(
    message: string,
    readonly partialSteps: CachedStep[],
  ) {
    super(message);
    this.name = 'DiscoveryError';
  }
}

export async function discoverSteps(
  page: Page,
  game: { gameId: string; name: string },
  viewport: Viewport,
  waitForSpinStart: () => Promise<boolean>,
): Promise<CachedStep[]> {
  const allFailedButtons: FailedButton[] = [];
  const preSpinSteps: CachedStep[] = [];

  let lastClickTime = Date.now();

  await page.waitForTimeout(DISCOVERY_INITIAL_WAIT_MS);

  for (let attempt = 1; attempt <= DISCOVERY_MAX_ATTEMPTS; attempt++) {
    const screenshot = await snap(page, `${game.gameId}/discovery-${attempt}.png`);

    const spinResult = await detectSpinButton(screenshot, viewport, allFailedButtons);

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

    const nextResult = await detectNextClick(screenshot, viewport, allFailedButtons);

    if (nextResult.found) {
      const waitMs = Date.now() - lastClickTime;

      preSpinSteps.push({ waitMs, x: nextResult.x, y: nextResult.y, label: nextResult.label });
      await page.mouse.click(nextResult.x, nextResult.y);
      lastClickTime = Date.now();
    }

    await page.waitForTimeout(DISCOVERY_POLL_INTERVAL_MS);
  }

  await snap(page, `${game.gameId}/discovery-failed.png`);
  throw new DiscoveryError(
    `Could not find spin button for ${game.name} (${game.gameId}) after ${DISCOVERY_MAX_ATTEMPTS} attempts. See screenshots/${game.gameId}/discovery-failed.png`,
    preSpinSteps,
  );
}
