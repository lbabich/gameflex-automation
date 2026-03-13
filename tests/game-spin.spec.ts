import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import type { FailedButton } from '../lib/claude-vision';
import { detectNextClick, detectSpinButton } from '../lib/claude-vision';
import { generateGif } from '../lib/gif-generator';
import type { CachedStep, DeviceType } from '../lib/step-cache';
import { getSteps, setSteps } from '../lib/step-cache';
import type { GameEntry } from './games';
import { GAMES } from './games';

dotenv.config();

const DISCOVERY_INITIAL_WAIT_MS = 8_000;
const DISCOVERY_POLL_INTERVAL_MS = 1_000;
const DISCOVERY_MAX_ATTEMPTS = 20;
const SPIN_START_TIMEOUT_MS = 10_000;
const SPIN_END_WAIT_MS = 15_000;

function deviceTypeFromUrl(url: string): DeviceType {
  try {
    return new URL(url).searchParams.get('channelid') === 'mobile' ? 'mobile' : 'desktop';
  } catch {
    return 'desktop';
  }
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
  throw new Error(
    `Could not find spin button for ${game.name} (${game.gameId}) after ${DISCOVERY_MAX_ATTEMPTS} attempts. See screenshots/${game.gameId}/discovery-failed.png`,
  );
}

async function injectClickMarker(page: Page, x: number, y: number): Promise<void> {
  await page.evaluate(
    ({ x, y }) => {
      const existing = document.getElementById('__click_marker__');
      if (existing) {
        existing.remove();
      }
      const marker = document.createElement('div');
      marker.id = '__click_marker__';
      marker.style.cssText = `position:fixed;left:${x - 15}px;top:${y - 15}px;width:30px;height:30px;border-radius:50%;background:rgba(255,0,0,0.6);border:3px solid red;z-index:2147483647;pointer-events:none;`;
      document.body.appendChild(marker);
    },
    { x, y },
  );
}

async function replaySteps(page: Page, game: GameEntry, steps: CachedStep[]): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    await page.waitForTimeout(Math.max(steps[i].waitMs, 1_000));
    await injectClickMarker(page, steps[i].x, steps[i].y);
    await snap(page, `${game.gameId}/step-${i + 1}.png`);
    console.log(`Clicking "${steps[i].label}" at ${steps[i].x},${steps[i].y}`);
    await page.mouse.click(steps[i].x, steps[i].y);
  }
}

for (const game of GAMES) {
  test(`spin: ${game.name}`, async ({ page }, testInfo: TestInfo) => {
    const isProjectMobile = /mobile/i.test(testInfo.project.name);
    const launchUrl = isProjectMobile ? (game.mobileUrl ?? game.url) : game.url;
    const deviceType = deviceTypeFromUrl(launchUrl);
    const projectDeviceType: DeviceType = isProjectMobile ? 'mobile' : 'desktop';

    test.skip(
      deviceType !== projectDeviceType,
      `URL channelid=${deviceType}; skipping ${testInfo.project.name}`,
    );

    const viewport = page.viewportSize()!;

    let spinStarted = false;
    page.on('console', (msg) => {
      if (msg.text().includes('gel.spin.start')) {
        spinStarted = true;
      }
    });

    async function waitForSpinStart(): Promise<boolean> {
      try {
        await page.waitForEvent('console', {
          predicate: (msg) => {
            return msg.text().includes('gel.spin.start');
          },
          timeout: SPIN_START_TIMEOUT_MS,
        });
        return true;
      } catch {
        return false;
      }
    }

    await test.step('Navigate to game', () => {
      return page.goto(launchUrl);
    });

    const cached = getSteps(game.gameId, deviceType, viewport);

    if (cached) {
      await test.step(`Replay ${cached.steps.length} cached step(s)`, () => {
        return replaySteps(page, game, cached.steps);
      });
    } else {
      await test.step('Discover steps', async () => {
        const steps = await discoverSteps(page, game, viewport, waitForSpinStart);
        setSteps(game.gameId, deviceType, viewport, {
          discoveredAt: new Date().toISOString(),
          steps,
        });
      });
    }

    await test.step('Spin start: gel.spin.start', async () => {
      if (!spinStarted) {
        await page.waitForEvent('console', {
          predicate: (msg) => {
            return msg.text().includes('gel.spin.start');
          },
          timeout: SPIN_START_TIMEOUT_MS,
        });
      }
    });

    await test.step('Spin end: gel.spin.end', () => {
      return page.waitForEvent('console', {
        predicate: (msg) => {
          return msg.text().includes('gel.spin.end');
        },
        timeout: SPIN_END_WAIT_MS,
      });
    });

    await snap(page, `${game.gameId}/final.png`);

    await test.step('Generate GIF', () => {
      return generateGif(game.gameId);
    });
  });
}
