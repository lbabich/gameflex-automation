import type { ConsoleMessage, TestInfo } from '@playwright/test';
import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import * as discovery from '../lib/discovery';
import * as gifGenerator from '../lib/gif-generator';
import * as operatorWallet from '../lib/operator-wallet';
import * as replay from '../lib/replay';
import * as screenshot from '../lib/screenshot';
import * as stepCache from '../lib/step-cache';
import type { DeviceType } from '../lib/types';
import { buildSingleUrl } from '../server/url-builder';
import { GAMES } from './games';

dotenv.config();

const SPIN_START_TIMEOUT_MS = 10_000;
const SPIN_END_WAIT_MS = 15_000;

for (const game of GAMES) {
  test(`spin: ${game.name}`, async ({ page }, testInfo: TestInfo) => {
    const isProjectMobile = /mobile/i.test(testInfo.project.name);
    const channel: 'desktop' | 'mobile' = isProjectMobile ? 'mobile' : 'desktop';
    const gameId =
      channel === 'mobile' ? (game.mobileGameId ?? game.desktopGameId) : game.desktopGameId;
    const deviceType: DeviceType = channel;
    const projectDeviceType: DeviceType = isProjectMobile ? 'mobile' : 'desktop';

    test.skip(
      isProjectMobile ? !game.mobileEnabled : !game.desktopEnabled,
      `device disabled; skipping ${testInfo.project.name}`,
    );

    const playmode = isProjectMobile ? game.mobilePlaymode : game.desktopPlaymode;

    testInfo.annotations.push({ type: 'playmode', description: playmode });

    const launchUrl =
      playmode === 'real'
        ? await operatorWallet.getGameLaunchUrl(gameId, channel)
        : buildSingleUrl(gameId, channel, playmode);

    const viewport = page.viewportSize();

    if (!viewport) {
      throw new Error('No viewport size available');
    }

    const isSpinStart = (msg: ConsoleMessage) => {
      return msg.text().includes('gel.spin.start');
    };
    const isSpinEnd = (msg: ConsoleMessage) => {
      return msg.text().includes('gel.spin.end');
    };

    let spinStarted = false;

    page.on('console', (msg) => {
      if (isSpinStart(msg)) {
        spinStarted = true;
      }
    });

    async function waitForSpinStart(): Promise<boolean> {
      try {
        await page.waitForEvent('console', {
          predicate: isSpinStart,
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

    const cached = stepCache.getSteps(game.id, deviceType, viewport);

    let failure: Error | null = null;

    try {
      if (cached) {
        await test.step(`Replay ${cached.steps.length} cached step(s)`, () => {
          return replay.replaySteps(page, game, cached.steps, projectDeviceType);
        });
      } else {
        await test.step('Discover steps', async () => {
          try {
            const steps = await discovery.discoverSteps(
              page,
              game,
              viewport,
              waitForSpinStart,
              projectDeviceType,
            );

            stepCache.setSteps(game.id, deviceType, viewport, {
              discoveredAt: new Date().toISOString(),
              steps,
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

      await test.step('Spin start: gel.spin.start', async () => {
        if (!spinStarted) {
          await page.waitForEvent('console', {
            predicate: isSpinStart,
            timeout: SPIN_START_TIMEOUT_MS,
          });
        }
      });

      await test.step('Spin end: gel.spin.end', () => {
        return page.waitForEvent('console', {
          predicate: isSpinEnd,
          timeout: SPIN_END_WAIT_MS,
        });
      });

      await screenshot.snap(page, `${game.id}/${projectDeviceType}/final.png`);
    } catch (err) {
      failure = err as Error;
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
