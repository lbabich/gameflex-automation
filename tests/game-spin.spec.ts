import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import { detectNextClick, detectSpinButton } from '../lib/claude-vision';
import type { CachedStep, DeviceType } from '../lib/step-cache';
import { getSteps, setSteps } from '../lib/step-cache';
import type { GameEntry } from './games';
import { GAMES } from './games';

dotenv.config();

const DISCOVERY_INITIAL_WAIT_MS = 8_000;
const DISCOVERY_POLL_INTERVAL_MS = 1_000;
const DISCOVERY_MAX_ATTEMPTS = 15;
const POST_SPIN_WAIT_MS = 5_000;

function deviceTypeFromProjectName(projectName: string): DeviceType {
  return /mobile/i.test(projectName) ? 'mobile' : 'desktop';
}

async function snap(page: Page, name: string): Promise<string> {
  const file = path.resolve('screenshots', name);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  await page.screenshot({ path: file, fullPage: false });
  console.log('Screenshot saved:', file);
  return file;
}

async function discoverSteps(
  page: Page,
  game: GameEntry,
  viewport: { width: number; height: number },
): Promise<CachedStep[]> {
  await page.waitForTimeout(DISCOVERY_INITIAL_WAIT_MS);

  const steps: CachedStep[] = [];

  for (let attempt = 1; attempt <= DISCOVERY_MAX_ATTEMPTS; attempt++) {
    const screenshot = await snap(page, `${game.gameId}/discovery-${attempt}.png`);

    const spinResult = await detectSpinButton(screenshot, viewport);

    if (spinResult.found) {
      const waitMs = steps.length === 0 ? DISCOVERY_INITIAL_WAIT_MS : DISCOVERY_POLL_INTERVAL_MS;
      steps.push({ waitMs, x: spinResult.x, y: spinResult.y, label: spinResult.label });
      await page.mouse.click(spinResult.x, spinResult.y);
      return steps;
    }

    const nextResult = await detectNextClick(screenshot, viewport);

    if (nextResult.found) {
      const waitMs = steps.length === 0 ? DISCOVERY_INITIAL_WAIT_MS : DISCOVERY_POLL_INTERVAL_MS;
      steps.push({ waitMs, x: nextResult.x, y: nextResult.y, label: nextResult.label });
      await page.mouse.click(nextResult.x, nextResult.y);
    }

    await page.waitForTimeout(DISCOVERY_POLL_INTERVAL_MS);
  }

  await snap(page, `${game.gameId}/discovery-failed.png`);
  throw new Error(
    `Could not find spin button for ${game.name} (${game.gameId}) after ${DISCOVERY_MAX_ATTEMPTS} attempts. See screenshots/${game.gameId}/discovery-failed.png`,
  );
}

async function replaySteps(page: Page, game: GameEntry, steps: CachedStep[]): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    await page.waitForTimeout(steps[i].waitMs);
    await snap(page, `${game.gameId}/step-${i + 1}.png`);
    console.log(`Clicking "${steps[i].label}" at ${steps[i].x},${steps[i].y}`);
    await page.mouse.click(steps[i].x, steps[i].y);
  }
}

for (const game of GAMES) {
  test(`spin: ${game.name}`, async ({ page }, testInfo: TestInfo) => {
    const deviceType = deviceTypeFromProjectName(testInfo.project.name);
    const viewport = page.viewportSize()!;

    const launchUrl = deviceType === 'mobile' ? (game.mobileUrl ?? game.url) : game.url;
    await page.goto(launchUrl);

    const cached = getSteps(game.gameId, deviceType, viewport);

    if (cached) {
      await replaySteps(page, game, cached.steps);
    } else {
      const steps = await discoverSteps(page, game, viewport);
      setSteps(game.gameId, deviceType, viewport, {
        discoveredAt: new Date().toISOString(),
        steps,
      });
    }

    await page.waitForTimeout(POST_SPIN_WAIT_MS);
    await snap(page, `${game.gameId}/final.png`);

    // NOTE: No errors — clean up screenshots (kept on failure for debugging)
    fs.rmSync(path.resolve('screenshots', game.gameId), { recursive: true, force: true });
  });
}
