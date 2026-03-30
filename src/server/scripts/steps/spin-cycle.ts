import type { Page } from '@playwright/test';
import type { DeviceType } from '../../../shared/types';
import * as claudeVision from '../../lib/claude-vision';
import type { EventAccumulator } from '../../lib/event-accumulator';
import {
  GEL_EVENT,
  POST_SPIN_BUFFER_MS,
  SPIN_END_WAIT_MS,
  SPIN_START_TIMEOUT_MS,
} from '../../lib/gel-events';
import * as replay from '../../lib/replay';
import * as screenshot from '../../lib/screenshot';
import * as stepCache from '../../lib/step-cache';
import type { CachedStep, Viewport } from '../../types';
import { track } from './track';
import type { StepContext } from './types';

const DISCOVERY_MAX_ATTEMPTS = 20;
const DISCOVERY_POLL_INTERVAL_MS = 1_000;

class SpinDiscoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SpinDiscoveryError';
  }
}

function register(accumulator: EventAccumulator): void {
  accumulator.register(GEL_EVENT.SPIN_START);
  accumulator.register(GEL_EVENT.SPIN_END);
}

async function discover(ctx: StepContext): Promise<void> {
  const { page, accumulator, game, viewport, deviceType, runID, runState } = ctx;

  await track(runState.steps, 'Discover spin button', () => {
    return runDiscoveryLoop(page, accumulator, game, viewport, deviceType, runID);
  });

  await track(runState.steps, `Spin end: ${GEL_EVENT.SPIN_END}`, () => {
    return accumulator.waitFor(GEL_EVENT.SPIN_END, SPIN_END_WAIT_MS);
  });

  await takePostSpinSnapshots(page, runID, deviceType);
}

async function execute(ctx: StepContext): Promise<void> {
  const { page, accumulator, game, viewport, runID, deviceType, runState } = ctx;
  const cached = stepCache.getSteps(game.id, deviceType, viewport);

  if (!cached) {
    throw new Error(`No cached steps found for game '${game.name}' — run discovery first`);
  }

  await track(runState.steps, `Replay ${cached.steps.length} cached step(s)`, () => {
    return replay.replaySteps(page, runID, cached.steps, deviceType);
  });

  await track(runState.steps, `Spin start: ${GEL_EVENT.SPIN_START}`, async () => {
    await accumulator.waitFor(GEL_EVENT.SPIN_START, SPIN_START_TIMEOUT_MS);
    await screenshot.snap(page, `${runID}/${deviceType}/spin-start.png`);
  });

  await track(runState.steps, `Spin end: ${GEL_EVENT.SPIN_END}`, () => {
    return accumulator.waitFor(GEL_EVENT.SPIN_END, SPIN_END_WAIT_MS);
  });

  await takePostSpinSnapshots(page, runID, deviceType);
}

async function takePostSpinSnapshots(
  page: Page,
  runID: string,
  deviceType: DeviceType,
): Promise<void> {
  await page.waitForTimeout(POST_SPIN_BUFFER_MS);
  await screenshot.snap(page, `${runID}/${deviceType}/final-1.png`);
  await page.waitForTimeout(1_500);
  await screenshot.snap(page, `${runID}/${deviceType}/final-2.png`);
  await page.waitForTimeout(1_500);
  await screenshot.snap(page, `${runID}/${deviceType}/final-3.png`);
}

async function runDiscoveryLoop(
  page: Page,
  accumulator: EventAccumulator,
  game: StepContext['game'],
  viewport: Viewport,
  deviceType: DeviceType,
  runID: string,
): Promise<void> {
  const allFailedButtons: claudeVision.FailedButton[] = [];
  const preSpinSteps: CachedStep[] = [];

  let lastClickTime = Date.now();

  for (let attempt = 1; attempt <= DISCOVERY_MAX_ATTEMPTS; attempt++) {
    const screenshotPath = await screenshot.snap(
      page,
      `${runID}/${deviceType}/discovery-${attempt}.png`,
    );

    const spinResult = await claudeVision.detectSpinButton(
      screenshotPath,
      viewport,
      allFailedButtons,
    );

    if (spinResult.found) {
      const waitMs = Date.now() - lastClickTime;

      await page.mouse.click(spinResult.x, spinResult.y);
      lastClickTime = Date.now();

      const spun = await checkSpinStarted(accumulator);

      if (spun) {
        preSpinSteps.push({ waitMs, x: spinResult.x, y: spinResult.y, label: spinResult.label });

        stepCache.setSteps(game.id, deviceType, viewport, {
          discoveredAt: new Date().toISOString(),
          steps: preSpinSteps,
        });

        return;
      }

      console.log(
        `[spin-cycle] False positive: "${spinResult.label}" at ${spinResult.x},${spinResult.y} — recording as navigation step`,
      );

      preSpinSteps.push({ waitMs, x: spinResult.x, y: spinResult.y, label: spinResult.label });
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

  if (preSpinSteps.length > 0) {
    stepCache.setSteps(game.id, deviceType, viewport, {
      discoveredAt: new Date().toISOString(),
      steps: preSpinSteps,
      partial: true,
    });
  }

  await screenshot.snap(page, `${runID}/${deviceType}/discovery-failed.png`);

  throw new SpinDiscoveryError(
    `Could not find spin button for ${game.name} (${game.desktopGameID}) after ${DISCOVERY_MAX_ATTEMPTS} attempts. See src/server/screenshots/${runID}/${deviceType}/discovery-failed.png`,
  );
}

async function checkSpinStarted(accumulator: EventAccumulator): Promise<boolean> {
  try {
    await accumulator.waitFor(GEL_EVENT.SPIN_START, SPIN_START_TIMEOUT_MS);

    return true;
  } catch {
    return false;
  }
}

export { register, discover, execute };
