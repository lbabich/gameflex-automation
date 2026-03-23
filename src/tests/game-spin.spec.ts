import type { ConsoleMessage, TestInfo } from '@playwright/test';
import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as discovery from '../lib/discovery';
import { readGames } from '../lib/games';
import type * as gelEvents from '../lib/gel-events';
import {
  GEL_EVENT,
  POST_SPIN_BUFFER_MS,
  SPIN_END_WAIT_MS,
  SPIN_START_TIMEOUT_MS,
} from '../lib/gel-events';
import * as gifGenerator from '../lib/gif-generator';
import * as preLaunch from '../lib/pre-launch';
import * as replay from '../lib/replay';
import * as screenshot from '../lib/screenshot';
import * as stepCache from '../lib/step-cache';
import type { DeviceType } from '../lib/types';
import { DEVICE_TYPE } from '../lib/types';
import { ANNOTATION } from './constants';

export type { GameEntry } from '../lib/games';

export const GAMES = readGames();

dotenv.config();

for (const game of GAMES) {
  test(`spin: ${game.name}`, async ({ page }, testInfo: TestInfo) => {
    const isProjectMobile = /mobile/i.test(testInfo.project.name);
    const deviceType: DeviceType = isProjectMobile ? DEVICE_TYPE.MOBILE : DEVICE_TYPE.DESKTOP;
    const projectDeviceType: DeviceType = isProjectMobile
      ? DEVICE_TYPE.MOBILE
      : DEVICE_TYPE.DESKTOP;

    const playmode = isProjectMobile ? game.mobilePlaymode : game.desktopPlaymode;

    testInfo.annotations.push({ type: ANNOTATION.PLAYMODE, description: playmode });

    const viewport = page.viewportSize();

    if (!viewport) {
      throw new Error('No viewport size available');
    }

    const isSpinStart = (msg: ConsoleMessage) => {
      return msg.text().includes(GEL_EVENT.SPIN_START);
    };

    const isSpinEnd = (msg: ConsoleMessage) => {
      return msg.text().includes(GEL_EVENT.SPIN_END);
    };

    let spinStarted = false;

    page.on('console', (msg) => {
      if (isSpinStart(msg)) {
        spinStarted = true;
      }
    });

    await test.step('Launch game via harness', () => {
      return preLaunch.launch(page, game, deviceType, playmode);
    });

    const cached = stepCache.getSteps(game.id, deviceType, viewport);

    let failure: Error | null = null;
    let gameReady: gelEvents.GameReadyResult | null = null;

    try {
      if (cached) {
        gameReady = await test.step(`Replay ${cached.steps.length} cached step(s)`, () => {
          return replay.replaySteps(page, game, cached.steps, projectDeviceType);
        });
      } else {
        await test.step('Discover steps', async () => {
          try {
            const result = await discovery.discoverSteps(page, game, viewport, projectDeviceType);

            gameReady = result.gameReady;

            stepCache.setSteps(game.id, deviceType, viewport, {
              discoveredAt: new Date().toISOString(),
              steps: result.steps,
            });
          } catch (err) {
            if (err instanceof discovery.DiscoveryError && err.partialSteps.length > 0) {
              stepCache.setSteps(game.id, deviceType, viewport, {
                discoveredAt: new Date().toISOString(),
                steps: err.partialSteps,
                partial: true,
              });
            }

            throw err;
          }
        });
      }

      if (gameReady) {
        testInfo.annotations.push({
          type: ANNOTATION.LOAD_TIME_MS,
          description: String(gameReady.loadTimeMs),
        });
        testInfo.annotations.push({
          type: ANNOTATION.HAD_LOAD_PROGRESS,
          description: String(gameReady.hadLoadProgress),
        });
      }

      await test.step(`Spin start: ${GEL_EVENT.SPIN_START}`, async () => {
        if (!spinStarted) {
          await page.waitForEvent('console', {
            predicate: isSpinStart,
            timeout: SPIN_START_TIMEOUT_MS,
          });
        }

        await screenshot.snap(page, `${game.id}/${projectDeviceType}/spin-start.png`);
      });

      await test.step(`Spin end: ${GEL_EVENT.SPIN_END}`, () => {
        return page.waitForEvent('console', {
          predicate: isSpinEnd,
          timeout: SPIN_END_WAIT_MS,
        });
      });

      await page.waitForTimeout(POST_SPIN_BUFFER_MS);
      await screenshot.snap(page, `${game.id}/${projectDeviceType}/final-1.png`);
      await page.waitForTimeout(1_500);
      await screenshot.snap(page, `${game.id}/${projectDeviceType}/final-2.png`);
      await page.waitForTimeout(1_500);
      await screenshot.snap(page, `${game.id}/${projectDeviceType}/final-3.png`);
    } catch (err) {
      failure = err as Error;

      await screenshot.snap(page, `${game.id}/${projectDeviceType}/failure-1.png`);
      await page.waitForTimeout(3_000);
      await screenshot.snap(page, `${game.id}/${projectDeviceType}/failure-2.png`);
      await page.waitForTimeout(3_000);
      await screenshot.snap(page, `${game.id}/${projectDeviceType}/failure-3.png`);
    }

    await test.step('Generate GIF', async () => {
      try {
        await gifGenerator.generateGif(game.id, projectDeviceType);
      } catch (gifErr) {
        console.warn('[generate-gif] Failed to generate GIF:', gifErr);
      }
    });

    if (failure) {
      throw failure;
    }
  });
}
