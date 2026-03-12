import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Page, TestInfo } from '@playwright/test';
import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import type { FailedButton } from '../lib/claude-vision';
import { detectNextClick, detectSpinButton } from '../lib/claude-vision';
import type { CachedStep, DeviceType } from '../lib/step-cache';
import { clearSteps, getSteps, setSteps } from '../lib/step-cache';
import type { GameEntry } from './games';
import { GAMES } from './games';

dotenv.config();

const DISCOVERY_INITIAL_WAIT_MS = 8_000;
const DISCOVERY_POLL_INTERVAL_MS = 1_000;
const DISCOVERY_LAUNCH_RETRIES = 3;
const DISCOVERY_ATTEMPTS_PER_LAUNCH = 10;
const SPIN_START_TIMEOUT_MS = 10_000;
const SPIN_START_POLL_INTERVAL_MS = 500;
const SPIN_END_TIMEOUT_MS = 15_000;
const SPIN_END_POLL_INTERVAL_MS = 500;

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
  launchUrl: string,
  viewport: { width: number; height: number },
  consoleLog: string[],
  waitForSpinStart: (fromIndex: number) => Promise<boolean>,
): Promise<CachedStep[]> {
  const allFailedButtons: FailedButton[] = [];

  for (let launch = 1; launch <= DISCOVERY_LAUNCH_RETRIES; launch++) {
    if (launch > 1) {
      console.log(
        `[discover] Launch retry ${launch}/${DISCOVERY_LAUNCH_RETRIES}, reloading game...`,
      );
      await page.goto(launchUrl);
    }

    await page.waitForTimeout(DISCOVERY_INITIAL_WAIT_MS);

    const preSpinSteps: CachedStep[] = [];

    for (let attempt = 1; attempt <= DISCOVERY_ATTEMPTS_PER_LAUNCH; attempt++) {
      const screenshot = await snap(page, `${game.gameId}/discovery-${launch}-${attempt}.png`);

      const spinResult = await detectSpinButton(screenshot, viewport, allFailedButtons);

      if (spinResult.found) {
        const spinStartIdx = consoleLog.length;
        await page.mouse.click(spinResult.x, spinResult.y);
        const spun = await waitForSpinStart(spinStartIdx);
        if (spun) {
          const waitMs =
            preSpinSteps.length === 0 ? DISCOVERY_INITIAL_WAIT_MS : DISCOVERY_POLL_INTERVAL_MS;
          preSpinSteps.push({ waitMs, x: spinResult.x, y: spinResult.y, label: spinResult.label });
          return preSpinSteps;
        }
        console.log(
          `[discover] False positive: "${spinResult.label}" at ${spinResult.x},${spinResult.y} — no gel.spin.start`,
        );
        allFailedButtons.push({ x: spinResult.x, y: spinResult.y, label: spinResult.label });
        await page.waitForTimeout(DISCOVERY_POLL_INTERVAL_MS);
        continue;
      }

      const nextResult = await detectNextClick(screenshot, viewport, allFailedButtons);

      if (nextResult.found) {
        const waitMs =
          preSpinSteps.length === 0 ? DISCOVERY_INITIAL_WAIT_MS : DISCOVERY_POLL_INTERVAL_MS;
        preSpinSteps.push({ waitMs, x: nextResult.x, y: nextResult.y, label: nextResult.label });
        await page.mouse.click(nextResult.x, nextResult.y);
      }

      await page.waitForTimeout(DISCOVERY_POLL_INTERVAL_MS);
    }

    console.log(`[discover] Launch ${launch}/${DISCOVERY_LAUNCH_RETRIES} exhausted attempts`);
  }

  await snap(page, `${game.gameId}/discovery-failed.png`);
  throw new Error(
    `Could not find spin button for ${game.name} (${game.gameId}) after ${DISCOVERY_LAUNCH_RETRIES} launches × ${DISCOVERY_ATTEMPTS_PER_LAUNCH} attempts. See screenshots/${game.gameId}/discovery-failed.png`,
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
    const isProjectMobile = /mobile/i.test(testInfo.project.name);
    const launchUrl = isProjectMobile ? (game.mobileUrl ?? game.url) : game.url;
    const deviceType = deviceTypeFromUrl(launchUrl);
    const projectDeviceType: DeviceType = isProjectMobile ? 'mobile' : 'desktop';
    test.skip(
      deviceType !== projectDeviceType,
      `URL channelid=${deviceType}; skipping ${testInfo.project.name}`,
    );

    const viewport = page.viewportSize()!;

    const consoleLog: string[] = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleLog.push(text);
    });

    async function waitForSpinStart(fromIndex: number): Promise<boolean> {
      const deadline = Date.now() + SPIN_START_TIMEOUT_MS;
      while (Date.now() < deadline) {
        if (
          consoleLog.slice(fromIndex).some((l) => {
            return l.includes('gel.spin.start');
          })
        ) {
          return true;
        }
        await page.waitForTimeout(SPIN_START_POLL_INTERVAL_MS);
      }
      return false;
    }

    async function waitForSpinEnd(fromIndex: number): Promise<boolean> {
      const deadline = Date.now() + SPIN_END_TIMEOUT_MS;
      while (Date.now() < deadline) {
        if (
          consoleLog.slice(fromIndex).some((l) => {
            return l.includes('gel.spin.end');
          })
        ) {
          return true;
        }
        await page.waitForTimeout(SPIN_END_POLL_INTERVAL_MS);
      }
      return false;
    }

    await page.goto(launchUrl);

    const cached = getSteps(game.gameId, deviceType, viewport);
    let spun = false;
    let spinIdx = 0;

    if (cached) {
      spinIdx = consoleLog.length;
      await replaySteps(page, game, cached.steps);
      spun = await waitForSpinStart(spinIdx);
      if (!spun) {
        console.log(
          `[test] Cached steps for ${game.name} did not produce gel.spin.start — clearing cache and re-discovering`,
        );
        clearSteps(game.gameId, deviceType, viewport);
        await page.goto(launchUrl);
      }
    }

    if (!spun) {
      spinIdx = consoleLog.length;
      const steps = await discoverSteps(
        page,
        game,
        launchUrl,
        viewport,
        consoleLog,
        waitForSpinStart,
      );
      setSteps(game.gameId, deviceType, viewport, {
        discoveredAt: new Date().toISOString(),
        steps,
      });
    }

    const spinEnded = await waitForSpinEnd(spinIdx);
    if (!spinEnded) {
      console.log(`[test] gel.spin.end not received for ${game.name} within timeout`);
    }

    await snap(page, `${game.gameId}/final.png`);

    // NOTE: No errors — clean up screenshots (kept on failure for debugging)
    fs.rmSync(path.resolve('screenshots', game.gameId), { recursive: true, force: true });
  });
}
