import type { ConsoleMessage, TestInfo } from '@playwright/test';
import { test } from '@playwright/test';
import * as dotenv from 'dotenv';
import { DiscoveryError, discoverSteps } from '../lib/discovery';
import { generateGif } from '../lib/gif-generator';
import { replaySteps } from '../lib/replay';
import { snap } from '../lib/screenshot';
import type { DeviceType } from '../lib/step-cache';
import { getSteps, setSteps } from '../lib/step-cache';
import { GAMES } from './games';

dotenv.config();

const SPIN_START_TIMEOUT_MS = 10_000;
const SPIN_END_WAIT_MS = 15_000;

function deviceTypeFromUrl(url: string): DeviceType {
  try {
    return new URL(url).searchParams.get('channelid') === 'mobile' ? 'mobile' : 'desktop';
  } catch {
    return 'desktop';
  }
}

for (const game of GAMES) {
  test(`spin: ${game.name}`, async ({ page }, testInfo: TestInfo) => {
    const isProjectMobile = /mobile/i.test(testInfo.project.name);
    const launchUrl = isProjectMobile ? (game.mobileUrl ?? game.url) : game.url;
    const deviceType = deviceTypeFromUrl(launchUrl);
    const projectDeviceType: DeviceType = isProjectMobile ? 'mobile' : 'desktop';

    test.skip(deviceType !== projectDeviceType, `URL channelid=${deviceType}; skipping ${testInfo.project.name}`);

    const viewport = page.viewportSize()!;

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

    const cached = getSteps(game.gameId, deviceType, viewport);

    let failure: Error | null = null;

    try {
      if (cached) {
        await test.step(`Replay ${cached.steps.length} cached step(s)`, () => {
          return replaySteps(page, game, cached.steps);
        });
      } else {
        await test.step('Discover steps', async () => {
          try {
            const steps = await discoverSteps(page, game, viewport, waitForSpinStart);

            setSteps(game.gameId, deviceType, viewport, {
              discoveredAt: new Date().toISOString(),
              steps,
            });
          } catch (err) {
            if (err instanceof DiscoveryError && err.partialSteps.length > 0) {
              setSteps(game.gameId, deviceType, viewport, {
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

      await snap(page, `${game.gameId}/final.png`);
    } catch (err) {
      failure = err as Error;
    }

    await test.step('Generate GIF', async () => {
      try {
        await generateGif(game.gameId);
      } catch (gifErr) {
        console.warn('[generate-gif] Failed to generate GIF:', gifErr);
      }
    });

    if (failure) {
      throw failure;
    }
  });
}
